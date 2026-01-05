import { deleteFromOCI } from "../oci/client.js";
import { prisma } from "../db/prisma.js";
import { randomBytes } from 'crypto';

const activeRooms = new Map();
const roomMessages = new Map();

setInterval(() => {
    if (activeRooms.size > 0) {
        console.log(`\n Active Rooms Status:`);
        activeRooms.forEach((connections, roomCode) => {
            console.log(`   Room ${roomCode}: ${connections.size} user(s) connected`);
        });
        console.log('');
    }
}, 30000); // Every 30 seconds

export function setupRoomWebsocket(wss){
    wss.on("connection", async (socket, req) => {
        const url = new URL(req.url, "http://localhost");
        const roomCode = url.searchParams.get("roomId");
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        
        console.log(`\n WebSocket connection attempt from ${clientIp} for room: ${roomCode}`);
        
        if (!roomCode) {
            console.log(` No roomId provided, closing connection`);
            socket.close();
            return;
        }

        const room = await prisma.room.findUnique({
            where: { code: roomCode }
        });
        
        if (!room) {
            console.log(` Room ${roomCode} not found in database, closing connection`);
            socket.close();
            return;
        }

        if (!activeRooms.has(roomCode)) {
            activeRooms.set(roomCode, new Set());
        }
        activeRooms.get(roomCode).add(socket);
        const userCount = activeRooms.get(roomCode).size;
        console.log(` User joined room ${roomCode} - Total users: ${userCount}`);
        
        socket.roomData = { code: roomCode, objectKey: room.objectKey };
        
        socket.on("message", async (data) => {
            try {
                const message = JSON.parse(data.toString());
                
                if (message.type === 'chat') {
                    console.log(` Chat message in room ${roomCode} from ${message.userName}: ${message.content}`);
                    
                    const chatMessage = {
                        id: randomBytes(16).toString('hex'),
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
                            if (client.readyState === 1) { // WebSocket.OPEN
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
            } catch (error) {
                console.error(` Error handling message: ${error.message}`);
            }
        });
        
        socket.on("close", async () => {
            console.log(`\n User disconnecting from room ${roomCode} (IP: ${clientIp})...`);
            const roomConnections = activeRooms.get(roomCode);
            if (roomConnections) {
                roomConnections.delete(socket);
                const remainingUsers = roomConnections.size;
                console.log(` User left room ${roomCode} - Remaining users: ${remainingUsers}`);

                if (remainingUsers === 0) {
                    console.log(`\n Last user left room ${roomCode}. Starting cleanup...`);
                    
                    if (socket.roomData.objectKey) {
                        console.log(` Room has objectKey: ${socket.roomData.objectKey}`);
                        try {
                            await deleteFromOCI(socket.roomData.objectKey);
                            console.log(` Deleted object: ${socket.roomData.objectKey}`);
                        } catch (error) {
                            console.error(` Failed to delete object: ${error.message}`);
                        }
                    } else {
                        console.log(` Room has no objectKey, skipping OCI deletion`);
                    }

                    try {
                        await prisma.room.delete({
                            where: { code: roomCode }
                        });
                        console.log(` Room ${roomCode} deleted from database`);
                    } catch (error) {
                        console.error(` Failed to delete room from database: ${error.message}`);
                    }

                    activeRooms.delete(roomCode);
                    roomMessages.delete(roomCode);
                    console.log(` Cleanup complete for room ${roomCode}\n`);
                } else {
                    console.log(` Room ${roomCode} still has ${remainingUsers} user(s), keeping it alive\n`);
                }
            }
        });
    });
}