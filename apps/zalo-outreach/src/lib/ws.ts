import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import type { WSMessage } from "../types/index.js";

let wss: WebSocketServer | null = null;
const clients = new Set<WebSocket>();

export function initWebSocket(server: Server): void {
  wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws) => {
    clients.add(ws);
    console.log(`[WS] Client connected (total: ${clients.size})`);

    ws.on("close", () => {
      clients.delete(ws);
      console.log(`[WS] Client disconnected (total: ${clients.size})`);
    });

    ws.on("error", (err) => {
      console.error("[WS] Error:", err.message);
      clients.delete(ws);
    });

    // Send welcome
    ws.send(
      JSON.stringify({
        type: "connected",
        payload: { message: "Zalo Outreach WebSocket connected" },
        timestamp: new Date().toISOString(),
      })
    );
  });

  console.log("[WS] WebSocket server initialized on /ws");
}

export function broadcast(message: WSMessage): void {
  const data = JSON.stringify(message);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

export function getConnectedCount(): number {
  return clients.size;
}
