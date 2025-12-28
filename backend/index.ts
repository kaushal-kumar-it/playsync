import express from "express";
import { WebSocketServer } from "ws";
import http from "http";
import { SyncServer } from "@ircam/sync";

const app = express();
const server = http.createServer(app);

const wss = new WebSocketServer({ server });

// create sync server
const startTime = process.hrtime();
const getTime = () => {
  const [s, ns] = process.hrtime(startTime);
  return s + ns * 1e-9; // seconds
};
const syncServer = new SyncServer(getTime);

wss.on("connection", (socket) => {
  console.log("Client connected");

  // receiveFunction
  const receiveFunction = (callback) => {
    socket.on("message", (msg) => {
      const data = JSON.parse(msg.toString());
      if (data[0] === 0) {
        callback(data[1], data[2]);
      }
    });
  };

  // sendFunction
  const sendFunction = (pingId, clientPingTime, serverPingTime, serverPongTime) => {
    const response = [1, pingId, clientPingTime, serverPingTime, serverPongTime];
    socket.send(JSON.stringify(response));
  };

  syncServer.start(sendFunction, receiveFunction);

  // -------------------------------
  // AUDIO SYNC EVENTS
  // -------------------------------
  socket.on("message", (msg) => {
    const data = JSON.parse(msg.toString());

    if (data.type === "play-request") {
      const executeAt = data.executeAt;
      const currentTime = data.currentTime || 0;

      console.log(`[BACKEND] Broadcasting PLAY: executeAt=${executeAt.toFixed(3)}, currentTime=${currentTime.toFixed(3)}`);

      // broadcast to all clients (forward the chosen executeAt and audio position)
      wss.clients.forEach((c) => c.send(JSON.stringify({ type: "play", executeAt, currentTime })));
    }

    if (data.type === "pause-request") {
      const executeAt = data.executeAt;
      const currentTime = data.currentTime || 0;

      console.log(`[BACKEND] Broadcasting PAUSE: executeAt=${executeAt.toFixed(3)}, currentTime=${currentTime.toFixed(3)}`);

      wss.clients.forEach((c) => c.send(JSON.stringify({ type: "pause", executeAt, currentTime })));
    }
  });
});

// bind to 0.0.0.0 so the server is reachable from other machines on the LAN
server.listen(3001, '0.0.0.0', () => console.log("Server running on 0.0.0.0:3001"));
