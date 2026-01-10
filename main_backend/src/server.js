import app from "./app.js";
import http from "http";
import { WebSocketServer } from "ws";
import dotenv from "dotenv";
import { setupRoomWebsocket } from "./rooms/websocket.js";
import { SyncServer } from "./syncServer.js";
dotenv.config();

const PORT = process.env.PORT || 4000;

const server = http.createServer(app);
const wss = new WebSocketServer({ server });
setupRoomWebsocket(wss);

const syncServer = new SyncServer(() => Date.now() / 1000);
syncServer.attach(wss);

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
