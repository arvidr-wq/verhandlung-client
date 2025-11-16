// src/lib/transport.ts
// ------------------------------------------------------------
// WebSocket-Client für Host & Join
// ------------------------------------------------------------

export type Team = "A" | "B";
export type Mode = "fair" | "leicht" | "deutlich";
export type Reaction = "annehmen" | "zurückstellen" | "ablehnen";

// Zusammenfassung am Spielende (0–100-Skala)
export type SummarySnapshot = {
  cooperation: number;
  fairness: number;
  sensitivity: number;
  opportunism: number;
};

// ---------------------------------------------
// Nachrichtentypen
// ---------------------------------------------

export type PlayedMsg = {
  type: "played";
  session: string;
  who: Team;
  base: number;
  mode: Mode;
};

export type ReactionMsg = {
  type: "react";
  session: string;
  who: Team;
  reaction: Reaction;
};

export type TrustInvestMsg = {
  type: "trustInvest";
  session: string;
  who: Team;
  amount: number; // 0–10 (%)
};

export type RevealMsg = {
  type: "reveal";
  session: string;
  to: Team;
  oppCategory: "weak" | "medium" | "strong";
};

export type NextMsg = {
  type: "next";
  session: string;
  round: number; // Zielrunde
};

export type ResetMsg = {
  type: "reset";
  session: string;
};

export type StateSnapshot = {
  score: number;
  fairScore: number;
  trust: number;
  summary?: SummarySnapshot; // nur am Ende gesetzt
};

export type StateUpdateMsg = {
  type: "stateUpdate";
  session: string;
  A: StateSnapshot;
  B: StateSnapshot;
};

export type AnyMsg =
  | PlayedMsg
  | ReactionMsg
  | TrustInvestMsg
  | RevealMsg
  | NextMsg
  | ResetMsg
  | StateUpdateMsg;

// ---------------------------------------------
// WebSocket-Verbindung
// ---------------------------------------------

let socket: WebSocket | null = null;
let handlers: Array<(msg: AnyMsg) => void> = [];

// Entscheidet, welche WS-URL wir benutzen
function getWebSocketUrl(): string {
  const onlineUrl = import.meta.env.VITE_WS_URL as string | undefined;

  // 1) Wenn eine Online-URL per Env gesetzt ist, IMMER benutzen
  if (onlineUrl && onlineUrl.startsWith("wss://")) {
    console.log("[transport] using ONLINE ws url:", onlineUrl);
    return onlineUrl;
  }

  // 2) Sonst: lokaler Betrieb (Seminar, eigener Laptop)
  const host = window.location.hostname || "localhost";

  const isLocal =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.startsWith("192.168.") ||
    host.startsWith("10.") ||
    host.endsWith(".local");

  if (isLocal) {
    const url = `ws://${host}:5174`;
    console.log("[transport] using LOCAL ws url:", url);
    return url;
  }

  // 3) Notfall-Fallback – falls Env nicht gesetzt ist
  const fallback = "wss://verhandlung-ws-server.onrender.com";
  console.warn(
    "[transport] WARNING: VITE_WS_URL fehlt – nutze Fallback:",
    fallback
  );
  return fallback;
}

function ensureSocket() {
  if (
    socket &&
    (socket.readyState === WebSocket.OPEN ||
      socket.readyState === WebSocket.CONNECTING)
  ) {
    return;
  }

  const url = getWebSocketUrl();
  console.log("[transport] connecting to", url);

  socket = new WebSocket(url);

  socket.onopen = () => console.log("[transport] socket open");
  socket.onclose = () => console.warn("[transport] socket closed");

  socket.onmessage = (ev) => {
    try {
      const msg: AnyMsg = JSON.parse(ev.data);
      handlers.forEach((fn) => fn(msg));
    } catch (err) {
      console.error("WS parse error", err);
    }
  };
}

function send(msg: AnyMsg) {
  ensureSocket();
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(msg));
  } else {
    // kleiner Retry, falls der Socket noch am Verbinden ist
    setTimeout(() => send(msg), 200);
  }
}

// ---------------------------------------------
// SENDEN
// ---------------------------------------------

export function playArgument(
  session: string,
  m: { who: Team; base: number; mode: Mode }
) {
  send({
    type: "played",
    session,
    ...m
  });
}

export function reactToOpponent(
  session: string,
  m: { who: Team; reaction: Reaction }
) {
  send({
    type: "react",
    session,
    ...m
  });
}

export function sendTrustInvest(session: string, who: Team, amount: number) {
  send({
    type: "trustInvest",
    session,
    who,
    amount
  });
}

export function sendReveal(
  session: string,
  to: Team,
  oppCategory: "weak" | "medium" | "strong"
) {
  send({
    type: "reveal",
    session,
    to,
    oppCategory
  });
}

export function sendNext(session: string, round: number) {
  send({
    type: "next",
    session,
    round
  });
}

export function resetSession(session: string) {
  send({
    type: "reset",
    session
  });
}

export function sendStateUpdate(
  session: string,
  A: StateSnapshot,
  B: StateSnapshot
) {
  send({
    type: "stateUpdate",
    session,
    A,
    B
  });
}

// ---------------------------------------------
// ABONNIERUNG
// ---------------------------------------------

export function subscribeHost(
  session: string,
  handler: (msg: AnyMsg) => void
) {
  ensureSocket();

  const wrapped = (msg: AnyMsg) => {
    if ("session" in msg && msg.session !== session) return;
    handler(msg);
  };

  handlers.push(wrapped);

  return () => {
    handlers = handlers.filter((f) => f !== wrapped);
  };
}