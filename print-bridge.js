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
import { exec } from "child_process";

// ── Config — edit these ──────────────────────────────────────────
const CONFIG = {
  // Ordering site API base
  apiBase: process.env.API_BASE ?? "https://ranimahal.food",

  // Manager secret (same as MANAGER_SECRET env var on Vercel)
  managerSecret: process.env.MANAGER_SECRET ?? "change-me",

  // Printer connection details:
  printer: {
    type: process.env.PRINTER_TYPE ?? "win",       // "win" for Windows Driver, "tcp" for RAW LAN
    winName: process.env.PRINTER_NAME ?? "TSP143", // Windows printer name from Printers & Scanners
    host: process.env.PRINTER_IP ?? "192.168.2.221",
    port: 9100,
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

    console.log(`[${new Date().toLocaleTimeString()}] 🖨️ Printing order ${orderId.slice(-6).toUpperCase()} to ${CONFIG.printer.winName}...`);

    // Fetch full order
    const orderRes = await fetch(`${CONFIG.apiBase}/api/orders?id=${orderId}`, {
      headers: { "x-manager-secret": CONFIG.managerSecret },
    });

    if (!orderRes.ok) {
      console.error(`Order fetch failed for ${orderId}: ${orderRes.status}`);
      return;
    }

    const order = await orderRes.json();

    // Send to Windows printer driver or TCP socket
    if (CONFIG.printer.type === "win") {
      const { buildPlainTextReceipt } = await import("./lib/printer.js");
      await sendToWindowsPrinter(CONFIG.printer.winName, buildPlainTextReceipt(order));
    } else {
      const { buildReceipt } = await import("./lib/printer.js");
      await sendToPrinter(buildReceipt(order));
    }

    // Mark as printed
    await fetch(`${CONFIG.apiBase}/api/orders`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-manager-secret": CONFIG.managerSecret,
      },
      body: JSON.stringify({ id: orderId, printed: true }),
    });

    console.log(`[${new Date().toLocaleTimeString()}] ✅ Printed & marked: ${orderId.slice(-6).toUpperCase()}`);

  } catch (err) {
    console.error(`Poll error: ${err.message}`);
  } finally {
    isRunning = false;
  }
}

function sendToWindowsPrinter(printerName, textContent) {
  return new Promise((resolve, reject) => {
    const tempPath = path.join(process.cwd(), "temp_receipt.txt");
    fs.writeFileSync(tempPath, textContent, "utf8");

    const cmd = `powershell -Command "Get-Content -Path '${tempPath}' | Out-Printer -Name '${printerName}'"`;

    exec(cmd, (err, stdout, stderr) => {
      if (err) {
        console.error("Windows Print Error:", stderr || err.message);
        reject(err);
      } else {
        resolve();
      }
    });
  });
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
