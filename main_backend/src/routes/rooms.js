import express from 'express';
import { verifyToken } from '../auth/firebaseVerify.js';
import { prisma } from '../db/prisma.js';
import { deleteFromOCI, generateReadUrl, generateUploadUrl } from '../oci/client.js';
import { saveUserIfNotExists } from '../auth/saveUser.js';
const router = express.Router();

function sanitizeFilename(input) {
    const raw = typeof input === 'string' ? input : '';
    const base = raw.split(/[\\/]/).pop() || 'track.mp3';
    const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120) || 'track.mp3';
    return cleaned.toLowerCase().endsWith('.mp3') ? cleaned : `${cleaned}.mp3`;
}

function generateRoomCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

router.post("/create", verifyToken, async (req, res) => {
    try {
        await saveUserIfNotExists(req.user);

        let roomCode;
        let attempts = 0;
        
        while (attempts < 10) {
            roomCode = generateRoomCode();
            const existing = await prisma.room.findUnique({
                where: { code: roomCode }
            });
            if (!existing) break;
            attempts++;
        }

        const room = await prisma.room.create({
            data: {
                code: roomCode,
                ownerId: req.user.uid,
                objectKey: null,
            }
        });

        res.json({ roomId: room.code });
    } catch (error) {
        console.error(" Room creation error:", error);
        res.status(500).json({ error: error.message });
    }
});

router.get("/my-rooms", verifyToken, async (req, res) => {
    try {
        const rooms = await prisma.room.findMany({
            where: { ownerId: req.user.uid },
            orderBy: { createdAt: 'desc' }
        });

        res.json({ rooms });
    } catch (error) {
        console.error(" Fetch rooms error:", error);
        res.status(500).json({ error: error.message });
    }
});

router.get("/debug/all", verifyToken, async (req, res) => {
    try {
        const allRooms = await prisma.room.findMany({
            orderBy: { createdAt: 'desc' }
        });
        res.json({ total: allRooms.length, rooms: allRooms });
    } catch (error) {
        console.error(" Debug rooms error:", error);
        res.status(500).json({ error: error.message });
    }
});

router.get("/:roomId", verifyToken, async (req, res) => {
    try {
        const room = await prisma.room.findUnique({
            where: { code: req.params.roomId }
        });

        if (!room) {
            return res.status(404).json({ error: "Room not found" });
        }

        res.json({ room });
    } catch (error) {
        console.error(" Get room error:", error);
        res.status(500).json({ error: error.message });
    }
});

router.post("/:roomId/generate-upload", verifyToken, async (req, res) => {
    try {
        const roomId = req.params.roomId;
        const room = await prisma.room.findUnique({
            where: { code: roomId }
        });

        if (!room) {
            return res.status(404).json({ error: "Room not found" });
        }

        if (room.objectKey) {
            try {
                await deleteFromOCI(room.objectKey);
                console.log(` Deleted old object: ${room.objectKey}`);
            } catch (error) {
                console.error(` Failed to delete old object: ${error.message}`);
            }
        }

        const requestedName = sanitizeFilename(req.body?.filename);
        const filename = `room-${roomId}-${Date.now()}_${requestedName}`;
        const result = await generateUploadUrl(filename);

        await prisma.room.update({
            where: { code: roomId },
            data: { objectKey: result.objectName }
        });

        res.json({
            success: true,
            uploadUrl: result.uploadUrl,
            objectName: result.objectName,
            expiresAt: result.expiresAt
        });
    } catch (error) {
        console.error(" Upload URL generation error:", error);
        res.status(500).json({ error: error.message });
    }
});

router.get("/:roomId/playback-url", verifyToken, async (req, res) => {
    try {
        const roomId = req.params.roomId;
        const room = await prisma.room.findUnique({
            where: { code: roomId },
            select: { objectKey: true }
        });

        if (!room) {
            return res.status(404).json({ error: "Room not found" });
        }

        if (!room.objectKey) {
            return res.status(400).json({ error: "No track uploaded" });
        }

        const result = await generateReadUrl(room.objectKey);
        res.json({
            success: true,
            playbackUrl: result.playbackUrl,
            objectName: result.objectName,
            expiresAt: result.expiresAt
        });
    } catch (error) {
        console.error(" Playback URL generation error:", error);
        res.status(500).json({ error: error.message });
    }
});

router.post("/:roomId/generate-delete", verifyToken, async (req, res) => {
    try {
        const roomId = req.params.roomId;
        const room = await prisma.room.findUnique({
            where: { code: roomId }
        });

        if (!room) {
            return res.status(404).json({ error: "Room not found" });
        }

        if (!room.objectKey) {
            return res.status(400).json({ error: "No object to delete" });
        }

        await deleteFromOCI(room.objectKey);
        await prisma.room.update({
            where: { code: roomId },
            data: { objectKey: null }
        });

        res.json({ success: true });
    } catch (error) {
        console.error(" Delete URL generation error:", error);
        res.status(500).json({ error: error.message });
    }
});

export default router;