// ws-server.js
// Ein sehr einfacher WebSocket-Broker für dein Verhandlungsspiel.
// Er macht keine eigene Logik, sondern leitet nur alle Messages
// an alle verbundenen Clients weiter. Host & Join machen die Logik selbst.

const WebSocket = require("ws");

const PORT = process.env.PORT || 10000;

const wss = new WebSocket.Server({ port: PORT }, () => {
  console.log(`[WS] Server hört auf Port ${PORT}`);
});

const clients = new Set();

wss.on("connection", (socket) => {
  clients.add(socket);
  console.log("[WS] Client verbunden. Aktive Clients:", clients.size);

  socket.on("message", (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch (err) {
      console.error("[WS] Konnte Message nicht parsen:", err);
      return;
    }

    console.log("[WS] Message in:", msg);

    // 🔁 Broadcast an alle offenen Clients (Host + Teams)
    const payload = JSON.stringify(msg);
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  });

  socket.on("close", () => {
    clients.delete(socket);
    console.log("[WS] Client getrennt. Aktive Clients:", clients.size);
  });

  socket.on("error", (err) => {
    console.error("[WS] Socket-Fehler:", err);
  });
});

wss.on("error", (err) => {
  console.error("[WS] Server-Fehler:", err);
});

console.log("[WS] WebSocket-Server gestartet.");