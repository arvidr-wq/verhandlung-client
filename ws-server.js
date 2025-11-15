// ws-server.js
// Einfacher Broadcast-WebSocket-Server für das Verhandlungsspiel

const WebSocket = require("ws");

// Render (und andere Plattformen) geben den Port über process.env.PORT vor.
// Lokal verwenden wir Port 5174 wie bisher.
const PORT = process.env.PORT || 5174;

const wss = new WebSocket.Server({ port: PORT });

console.log(`[ws-server] Listening on ws://0.0.0.0:${PORT}`);

wss.on("connection", (ws) => {
  console.log("[ws-server] Client connected");

  ws.on("message", (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch (err) {
      console.error("[ws-server] Invalid JSON", err);
      return;
    }

    console.log("[ws-server] Message in:", msg);

    // An alle anderen Clients im selben Spiel (session) broadcasten
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(msg));
      }
    });
  });

  ws.on("close", () => {
    console.log("[ws-server] Client disconnected");
  });
});