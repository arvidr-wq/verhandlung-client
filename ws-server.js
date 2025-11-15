// ws-server.js
// Einfacher WebSocket-Server, der Nachrichten an alle anderen Clients weitergibt

const WebSocket = require("ws");

// Der Server hört auf Port 5174
const PORT = 5174;
const wss = new WebSocket.Server({ port: PORT });

console.log("[WS] WebSocket-Server läuft auf ws://localhost:" + PORT);

wss.on("connection", (ws) => {
  console.log("[WS] Client verbunden.");

  ws.on("message", (message) => {
    // Nachricht an alle anderen weiterleiten
    for (const client of wss.clients) {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message.toString());
      }
    }
  });

  ws.on("close", () => {
    console.log("[WS] Client getrennt.");
  });
});