import { deleteFromOCI } from "../oci/client.js";
import { prisma } from "../db/prisma.js";
import { randomBytes } from 'crypto';
import admin from 'firebase-admin';
import '../auth/firebaseVerify.js';

const activeRooms = new Map();
const roomMessages = new Map();

const HEARTBEAT_INTERVAL_MS = 30000;
const ROOM_EMPTY_GRACE_MS = Number.parseInt(
    process.env.ROOM_EMPTY_GRACE_MS || '30000',
    10
);

const roomCleanupTimers = new Map();

function newConnId() {
    return randomBytes(6).toString('hex');
}

function roomSnapshot(roomCode) {
    const set = activeRooms.get(roomCode);
    if (!set) return [];
    return Array.from(set)
        .map((s) => s?.connId)
        .filter(Boolean);
}

async function verifyWsToken(token) {
    if (!token) return null;
    try {
        const decoded = await admin.auth().verifyIdToken(token);
        return decoded;
    } catch (err) {
        console.error(` WS AUTH ERROR msg=${err?.message || err}`);
        return null;
    }
}

function dedupeUserInRoom(roomCode, userId, incomingConnId) {
    const connections = activeRooms.get(roomCode);
    if (!connections || !userId) return;

    for (const s of connections) {
        if (s?.userId === userId) {
            console.log(` WS DEDUPE room=${roomCode} user=${userId} closingOldConn=${s.connId} newConn=${incomingConnId}`);
            try {
                s.close(4000, 'duplicate-connection');
            } catch {}
            connections.delete(s);
        }
    }
}

function removeSocketFromRoom(roomCode, socket) {
    const roomConnections = activeRooms.get(roomCode);
    if (!roomConnections) return 0;
    roomConnections.delete(socket);
    return roomConnections.size;
}

function cleanupRoomIfEmpty(roomCode, lastSocket) {
    const roomConnections = activeRooms.get(roomCode);
    const remainingUsers = roomConnections ? roomConnections.size : 0;
    if (remainingUsers !== 0) return;

    if (roomCleanupTimers.has(roomCode)) return;

    console.log(
        `\n Last user left room ${roomCode}. Scheduling cleanup in ${ROOM_EMPTY_GRACE_MS}ms...`
    );

    const timer = setTimeout(async () => {
        roomCleanupTimers.delete(roomCode);

        const currentConnections = activeRooms.get(roomCode);
        if (currentConnections && currentConnections.size > 0) {
            console.log(
                ` Cleanup cancelled for room ${roomCode} (user rejoined). users=${currentConnections.size}`
            );
            return;
        }

        console.log(`\n Starting cleanup for room ${roomCode}...`);

        let objectKey = null;
        try {
            const room = await prisma.room.findUnique({
                where: { code: roomCode },
                select: { objectKey: true },
            });
            objectKey = room?.objectKey || null;
        } catch (error) {
            console.error(
                ` Failed to load room from database for cleanup: ${error.message}`
            );
        }

        if (objectKey) {
            console.log(` Room has objectKey: ${objectKey}`);
            try {
                await deleteFromOCI(objectKey);
                console.log(` Deleted object: ${objectKey}`);
            } catch (error) {
                console.error(` Failed to delete object: ${error.message}`);
            }
        } else {
            const fallbackKey = lastSocket?.roomData?.objectKey || null;
            if (fallbackKey) {
                console.log(` Room DB missing objectKey; using socket fallback: ${fallbackKey}`);
                try {
                    await deleteFromOCI(fallbackKey);
                    console.log(` Deleted object: ${fallbackKey}`);
                } catch (error) {
                    console.error(` Failed to delete object: ${error.message}`);
                }
            } else {
                console.log(` Room has no objectKey, skipping OCI deletion`);
            }
        }

        try {
            await prisma.room.delete({ where: { code: roomCode } });
            console.log(` Room ${roomCode} deleted from database`);
        } catch (error) {
            console.error(` Failed to delete room from database: ${error.message}`);
        }

        activeRooms.delete(roomCode);
        roomMessages.delete(roomCode);
        console.log(` Cleanup complete for room ${roomCode}\n`);
    }, ROOM_EMPTY_GRACE_MS);

    roomCleanupTimers.set(roomCode, timer);
}

function cancelRoomCleanup(roomCode) {
    const timer = roomCleanupTimers.get(roomCode);
    if (!timer) return;
    clearTimeout(timer);
    roomCleanupTimers.delete(roomCode);
    console.log(` Cleanup timer cleared for room ${roomCode}`);
}

setInterval(() => {
    for (const [roomCode, connections] of activeRooms.entries()) {
        for (const socket of connections) {
            if (!socket) continue;

            if (socket.isAlive === false) {
                console.log(` WS HEARTBEAT TERMINATE connId=${socket.connId} room=${roomCode}`);
                try {
                    socket.terminate();
                } catch {}
                removeSocketFromRoom(roomCode, socket);
                cleanupRoomIfEmpty(roomCode, socket);
                continue;
            }

            socket.isAlive = false;
            try {
                socket.ping();
            } catch {}
        }
    }
}, HEARTBEAT_INTERVAL_MS);

setInterval(() => {
    if (activeRooms.size > 0) {
        console.log(`\n Active Rooms Status:`);
        activeRooms.forEach((connections, roomCode) => {
            console.log(`   Room ${roomCode}: ${connections.size} user(s) connected`);
        });
        console.log('');
    }
}, 30000);

export function setupRoomWebsocket(wss){
    wss.on("connection", async (socket, req) => {
        const url = new URL(req.url, "http://localhost");
        const roomCode = url.searchParams.get("roomId");
        const token = url.searchParams.get("token");
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const connId = newConnId();
        socket.connId = connId;
        const wsKey = req.headers['sec-websocket-key'];
        const userAgent = req.headers['user-agent'];

        socket.isAlive = true;
        socket.on('pong', () => {
            socket.isAlive = true;
        });
        
        console.log(`\n WS CONNECT connId=${connId} ip=${clientIp} room=${roomCode} key=${wsKey} ua=${userAgent}`);
        
        if (!roomCode) {
            console.log(` WS CLOSE connId=${connId} reason=no-roomId`);
            socket.close();
            return;
        }

        const decoded = await verifyWsToken(token);
        if (!decoded?.uid) {
            console.log(` WS CLOSE connId=${connId} room=${roomCode} reason=unauthorized`);
            socket.close(1008, 'unauthorized');
            return;
        }
        socket.userId = decoded.uid;

        const room = await prisma.room.findUnique({
            where: { code: roomCode }
        });
        
        if (!room) {
            console.log(` WS CLOSE connId=${connId} room=${roomCode} reason=room-not-found`);
            socket.close();
            return;
        }

        if (!activeRooms.has(roomCode)) {
            activeRooms.set(roomCode, new Set());
        }

        cancelRoomCleanup(roomCode);

        dedupeUserInRoom(roomCode, socket.userId, connId);

        socket.userName = decoded.name || decoded.email?.split('@')[0] || 'Anonymous';
        socket.userEmail = decoded.email || '';

        activeRooms.get(roomCode).add(socket);
        const userCount = activeRooms.get(roomCode).size;
        console.log(` WS JOIN connId=${connId} room=${roomCode} user=${socket.userId} users=${userCount} conns=${JSON.stringify(roomSnapshot(roomCode))}`);
        
        socket.roomData = { code: roomCode, objectKey: room.objectKey };

        try {
            const messages = roomMessages.get(roomCode) || [];
            socket.send(
                JSON.stringify({
                    type: 'messageHistory',
                    messages,
                })
            );
        } catch {}

        const getUsersList = (roomCode) => {
            const connections = activeRooms.get(roomCode);
            if (!connections) return [];
            return Array.from(connections).map(s => ({
                userId: s.userId,
                userName: s.userName || 'Anonymous',
                userEmail: s.userEmail || '',
                isAdmin: s.userId === room.ownerId
            }));
        };

        const users = getUsersList(roomCode);
        const roomConnections = activeRooms.get(roomCode);
        if (roomConnections) {
            const userJoinedPayload = JSON.stringify({
                type: 'userJoined',
                userId: socket.userId,
                userName: socket.userName,
                userEmail: socket.userEmail,
                users
            });
            roomConnections.forEach(client => {
                if (client.readyState === 1) {
                    client.send(userJoinedPayload);
                }
            });
        }

        socket.on("error", (err) => {
            console.error(` WS ERROR connId=${connId} room=${roomCode} msg=${err?.message}`);
        });
        
        socket.on("message", async (data) => {
            try {
                const message = JSON.parse(data.toString());

                // --- SYNC PLAY/PAUSE ---
                if (message.type === 'play' || message.type === 'pause') {
                    const roomConnections = activeRooms.get(roomCode);
                    if (roomConnections) {
                        roomConnections.forEach(client => {
                            if (client.readyState === 1) {
                                client.send(JSON.stringify({
                                    type: message.type,
                                    executeAt: message.executeAt,
                                    currentTime: message.currentTime
                                }));
                            }
                        });
                    }
                    return;
                }

                if (message.type === 'chat') {
                    // ...existing code...
                    const chatMessage = {
                        id: randomBytes(16).toString('hex'),
                        clientId: message.clientId || null,
                        userId: message.userId,
                        userName: message.userName,
                        content: message.content,
                        createdAt: new Date().toISOString()
                    };
                    if (!roomMessages.has(roomCode)) {
                        roomMessages.set(roomCode, []);
                    }
                    roomMessages.get(roomCode).push(chatMessage);
                    const broadcastData = JSON.stringify({
                        type: 'chat',
                        ...chatMessage
                    });
                    const roomConnections = activeRooms.get(roomCode);
                    if (roomConnections) {
                        roomConnections.forEach(client => {
                            if (client.readyState === 1) {
                                client.send(broadcastData);
                            }
                        });
                    }
                }

                if (message.type === 'getMessages') {
                    const messages = roomMessages.get(roomCode) || [];
                    socket.send(JSON.stringify({
                        type: 'messageHistory',
                        messages: messages
                    }));
                }

                if (message.type === 'getUsers') {
                    const connections = activeRooms.get(roomCode);
                    if (!connections) return;
                    const users = Array.from(connections).map(s => ({
                        userId: s.userId,
                        userName: s.userName || 'Anonymous',
                        userEmail: s.userEmail || '',
                        isAdmin: s.userId === room.ownerId
                    }));
                    socket.send(JSON.stringify({
                        type: 'usersList',
                        users
                    }));
                }

                if (message.type === 'trackUpdated') {
                    const payload = JSON.stringify({ type: 'trackUpdated' });
                    const roomConnections = activeRooms.get(roomCode);
                    if (roomConnections) {
                        roomConnections.forEach(client => {
                            if (client.readyState === 1) {
                                client.send(payload);
                            }
                        });
                    }
                }
            } catch (error) {
                console.error(` WS MSG ERROR connId=${connId} room=${roomCode} msg=${error.message}`);
            }
        });
        
        socket.on("close", async (code, reason) => {
            const reasonText = Buffer.isBuffer(reason) ? reason.toString() : String(reason || '');
            console.log(`\n WS CLOSE connId=${connId} room=${roomCode} code=${code} reason=${reasonText}`);

            const remainingUsers = removeSocketFromRoom(roomCode, socket);
            console.log(` WS LEAVE connId=${connId} room=${roomCode} user=${socket.userId} users=${remainingUsers} conns=${JSON.stringify(roomSnapshot(roomCode))}`);

            const roomConnections = activeRooms.get(roomCode);
            if (roomConnections && roomConnections.size > 0) {
                const connections = activeRooms.get(roomCode);
                const users = Array.from(connections).map(s => ({
                    userId: s.userId,
                    userName: s.userName || 'Anonymous',
                    userEmail: s.userEmail || '',
                    isAdmin: s.userId === room.ownerId
                }));
                const userLeftPayload = JSON.stringify({
                    type: 'userLeft',
                    userId: socket.userId,
                    users
                });
                roomConnections.forEach(client => {
                    if (client.readyState === 1) {
                        client.send(userLeftPayload);
                    }
                });
            }

            if (remainingUsers === 0) {
                cleanupRoomIfEmpty(roomCode, socket);
            } else {
                console.log(` Room ${roomCode} still has ${remainingUsers} user(s), keeping it alive\n`);
            }
        });
    });
}