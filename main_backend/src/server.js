import app from "./app.js";
import http from "http";
import { WebSocketServer } from "ws";
import dotenv from "dotenv";
import { setupRoomWebsocket } from "./rooms/websocket.js";
dotenv.config();

const PORT = process.env.PORT || 4000;

const server = http.createServer(app);
const wss = new WebSocketServer({ server });
setupRoomWebsocket(wss);

server.listen(PORT, () => {
    console.log(`server is running on ${PORT} thankyou`);
});
