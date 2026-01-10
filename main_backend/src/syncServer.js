// Simple time sync server for per-room audio sync
import { WebSocketServer } from "ws";

export class SyncServer {
  constructor(getTime) {
    this.getTime = getTime;
    this.rooms = new Map(); // roomId -> Set of sockets
  }

  attach(wss) {
    wss.on("connection", (socket, req) => {
      const url = new URL(req.url, "http://localhost");
      const roomId = url.searchParams.get("roomId") || "default";
      if (!this.rooms.has(roomId)) this.rooms.set(roomId, new Set());
      this.rooms.get(roomId).add(socket);
      socket.roomId = roomId;

      socket.on("close", () => {
        this.rooms.get(roomId)?.delete(socket);
        if (this.rooms.get(roomId)?.size === 0) this.rooms.delete(roomId);
      });

      socket.on("message", (msg) => {
        let data;
        try { data = JSON.parse(msg); } catch { return; }
        // [0, pingId, clientPingTime] = sync ping
        if (Array.isArray(data) && data[0] === 0) {
          const [_, pingId, clientPingTime] = data;
          const serverPingTime = this.getTime();
          const serverPongTime = this.getTime();
          socket.send(JSON.stringify([1, pingId, clientPingTime, serverPingTime, serverPongTime]));
        }
      });
    });
  }
}
