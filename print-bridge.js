#!/usr/bin/env node
// print-bridge.js
// ─────────────────────────────────────────────────────────────────
// Run this on the restaurant PC/tablet that has the Star TSP100
// connected via USB or LAN.
//
// Setup:
//   npm install node-fetch @vercel/kv net
//   node print-bridge.js
//
// The bridge polls Vercel KV every 5 seconds for new order IDs,
// fetches the full order, builds a StarPRNT receipt, and sends
// it directly to the printer via TCP (LAN) or /dev/usb/lp0 (USB).
// ─────────────────────────────────────────────────────────────────

import net  from "net";
import fs   from "fs";
import path from "path";
import fetch from "node-fetch";

// ── Config — edit these ──────────────────────────────────────────
const CONFIG = {
  // Ordering site API base
  apiBase: process.env.API_BASE ?? "https://ranimahal.food",

  // Manager secret (same as MANAGER_SECRET env var on Vercel)
  managerSecret: process.env.MANAGER_SECRET ?? "change-me",

  // Printer connection — choose ONE:
  printer: {
    type: "tcp",         // "tcp" for LAN printer, "usb" for USB
    host: "192.168.1.x", // LAN IP of the Star printer (check printer config page)
    port: 9100,          // Star default RAW port
    // usbPath: "/dev/usb/lp0", // uncomment for USB on Linux/Mac
  },

  // Poll interval
  pollMs: 5000,
};
// ────────────────────────────────────────────────────────────────

let isRunning = false;

async function poll() {
  if (isRunning) return; // prevent overlap
  isRunning = true;

  try {
    // Pop an order ID from the print queue (RPOP = right pop)
    const res = await fetch(`${CONFIG.apiBase}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-manager-secret": CONFIG.managerSecret,
      },
      body: JSON.stringify({ action: "dequeue" }),
    });

    if (!res.ok) {
      console.error(`Print queue fetch failed: ${res.status}`);
      return;
    }

    const { orderId } = await res.json();
    if (!orderId) return; // queue empty

    console.log(`[${new Date().toLocaleTimeString()}] Printing order ${orderId}...`);

    // Fetch full order
    const orderRes = await fetch(`${CONFIG.apiBase}/api/orders?id=${orderId}`, {
      headers: { "x-manager-secret": CONFIG.managerSecret },
    });

    if (!orderRes.ok) {
      console.error(`Order fetch failed for ${orderId}: ${orderRes.status}`);
      return;
    }

    const order = await orderRes.json();

    // Build receipt (dynamic import from shared lib)
    const { buildReceipt } = await import("./lib/printer.js");
    const receiptBuffer = buildReceipt(order);

    // Send to printer
    await sendToPrinter(receiptBuffer);

    // Mark as printed
    await fetch(`${CONFIG.apiBase}/api/orders`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-manager-secret": CONFIG.managerSecret,
      },
      body: JSON.stringify({ id: orderId, printed: true }),
    });

    console.log(`[${new Date().toLocaleTimeString()}] ✓ Printed & marked: ${orderId}`);

  } catch (err) {
    console.error(`Poll error: ${err.message}`);
  } finally {
    isRunning = false;
  }
}

function sendToPrinter(buffer) {
  return new Promise((resolve, reject) => {
    if (CONFIG.printer.type === "tcp") {
      // LAN printing via RAW TCP socket
      const socket = new net.Socket();
      socket.setNoDelay(true);
      socket.setTimeout(5000);

      socket.connect(CONFIG.printer.port, CONFIG.printer.host, () => {
        socket.write(buffer, () => {
          setTimeout(() => {
            socket.end();
            socket.destroy();
            resolve();
          }, 500);
        });
      });

      socket.on("timeout", () => { socket.destroy(); reject(new Error(`Printer timeout connecting to ${CONFIG.printer.host}:${CONFIG.printer.port}`)); });
      socket.on("error", (err) => { socket.destroy(); reject(err); });

    } else {
      // USB printing — write directly to device file
      fs.writeFile(CONFIG.printer.usbPath, buffer, err => {
        if (err) reject(err);
        else resolve();
      });
    }
  });
}

// The bridge's print-queue pop, single-order fetch, and printed-marking
// calls above are all handled by api/orders.js (action:"dequeue", ?id=,
// and PATCH respectively) — see that file for the server-side logic.

// ── Start polling ─────────────────────────────────────────────────
console.log(`
╔══════════════════════════════════════╗
║  Rani Mahal — Print Bridge           ║
║  Printer: ${CONFIG.printer.type === "tcp"
    ? `${CONFIG.printer.host}:${CONFIG.printer.port}`
    : CONFIG.printer.usbPath
  }
║  Polling every ${CONFIG.pollMs / 1000}s                   ║
╚══════════════════════════════════════╝
`);

poll(); // immediate first run
setInterval(poll, CONFIG.pollMs);

// Graceful shutdown
process.on("SIGINT",  () => { console.log("\nBridge stopped."); process.exit(0); });
process.on("SIGTERM", () => { console.log("\nBridge stopped."); process.exit(0); });
