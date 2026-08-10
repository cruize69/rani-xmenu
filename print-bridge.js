#!/usr/bin/env node
// print-bridge.js — Rani Mahal Thermal Printer Bridge
// ─────────────────────────────────────────────────────────────────
// Connects directly to Star TSP143 / TSP100 thermal printers over
// RAW TCP socket (Port 9100) or USB RAW device file.
//
// Sends direct Star Line / ESC/POS hardware commands for:
//   - Pitch black 100% thermal density print
//   - Zero margin full 80mm paper width (42 columns)
//   - Hardware double-size headers
//   - Automatic receipt cutter activation
// ─────────────────────────────────────────────────────────────────

import net  from "net";
import fs   from "fs";
import path from "path";
import { exec } from "child_process";
import { buildReceipt, buildPlainTextReceipt } from "./lib/printer.js";

// ── Configuration ────────────────────────────────────────────────
const CONFIG = {
  // Ordering site API base
  apiBase: process.env.API_BASE ?? "https://ranimahal.food",

  // Manager secret
  managerSecret: process.env.MANAGER_SECRET ?? "change-me",

  // Printer connection configuration:
  // "tcp" sends RAW binary hardware commands directly over LAN socket to Port 9100.
  // This produces pitch-black thermal print, full 80mm width, and hardware paper cut.
  printer: {
    type: process.env.PRINTER_TYPE ?? "tcp",
    winName: process.env.PRINTER_NAME ?? "TSP143",
    host: process.env.PRINTER_IP ?? "192.168.2.221",
    port: parseInt(process.env.PRINTER_PORT ?? "9100", 10),
  },

  // Poll queue interval (milliseconds)
  pollMs: 4000,
};
// ────────────────────────────────────────────────────────────────

let isRunning = false;

async function poll() {
  if (isRunning) return;
  isRunning = true;

  try {
    // Pop an order ID from the print queue
    const res = await fetch(`${CONFIG.apiBase}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-manager-secret": CONFIG.managerSecret,
      },
      body: JSON.stringify({ action: "dequeue" }),
    });

    if (!res.ok) {
      console.error(`[${new Date().toLocaleTimeString()}] Queue fetch failed: HTTP ${res.status}`);
      return;
    }

    const { orderId } = await res.json();
    if (!orderId) return; // queue empty

    console.log(`[${new Date().toLocaleTimeString()}] 🖨️ Printing order ${orderId.slice(-6).toUpperCase()} to ${CONFIG.printer.host}:${CONFIG.printer.port}...`);

    // Fetch full order data
    const orderRes = await fetch(`${CONFIG.apiBase}/api/orders?id=${orderId}`, {
      headers: { "x-manager-secret": CONFIG.managerSecret },
    });

    if (!orderRes.ok) {
      console.error(`[${new Date().toLocaleTimeString()}] Order fetch failed for ${orderId}: HTTP ${orderRes.status}`);
      return;
    }

    const order = await orderRes.json();

    // Generate binary Star Line / ESC/POS buffer
    const binaryReceipt = buildReceipt(order);

    if (CONFIG.printer.type === "tcp") {
      // Direct RAW Socket Printing (Best Quality)
      await sendTcpRaw(CONFIG.printer.host, CONFIG.printer.port, binaryReceipt);
    } else if (CONFIG.printer.type === "win") {
      // Windows Spooler RAW printing
      await sendWindowsRaw(CONFIG.printer.winName, binaryReceipt, order);
    } else {
      // USB Device RAW file
      await sendUsbRaw(CONFIG.printer.usbPath ?? "/dev/usb/lp0", binaryReceipt);
    }

    // Mark as printed on server
    await fetch(`${CONFIG.apiBase}/api/orders`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-manager-secret": CONFIG.managerSecret,
      },
      body: JSON.stringify({ id: orderId, printed: true }),
    });

    console.log(`[${new Date().toLocaleTimeString()}] ✅ Order ${orderId.slice(-6).toUpperCase()} printed and cut successfully!`);

  } catch (err) {
    console.error(`[${new Date().toLocaleTimeString()}] ❌ Print Error:`, err.message);
  } finally {
    isRunning = false;
  }
}

/**
 * Send RAW Binary Buffer over TCP Socket directly to Star Printer on Port 9100
 */
function sendTcpRaw(host, port, buffer) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    socket.setNoDelay(true);
    socket.setTimeout(6000);

    socket.connect(port, host, () => {
      socket.write(buffer, () => {
        // Wait 500ms for buffer flush before closing socket
        setTimeout(() => {
          socket.end();
          socket.destroy();
          resolve();
        }, 500);
      });
    });

    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error(`Printer socket timeout connecting to ${host}:${port}`));
    });

    socket.on("error", (err) => {
      socket.destroy();
      reject(new Error(`Printer socket error: ${err.message}`));
    });
  });
}

/**
 * Send RAW binary data to Windows Print Spooler (bypasses Windows GDI formatting)
 */
function sendWindowsRaw(printerName, buffer, order) {
  return new Promise((resolve, reject) => {
    const tempBinPath = path.join(process.cwd(), "temp_receipt.bin");
    fs.writeFileSync(tempBinPath, buffer);

    // PowerShell script using Win32 Raw Print spooler API to bypass Windows page margins
    const psScript = `
    $bytes = [System.IO.File]::ReadAllBytes('${tempBinPath.replace(/\\/g, "/")}')
    $client = New-Object System.Net.Sockets.TcpClient('${CONFIG.printer.host}', 9100)
    $stream = $client.GetStream()
    $stream.Write($bytes, 0, $bytes.Length)
    $stream.Flush()
    $client.Close()
    `;

    exec(`powershell -Command "${psScript.replace(/\n/g, " ")}"`, (err, stdout, stderr) => {
      if (err) {
        // Fallback: try raw Out-Printer if TCP socket on Windows client fails
        const textContent = buildPlainTextReceipt(order);
        const tempTxtPath = path.join(process.cwd(), "temp_receipt.txt");
        fs.writeFileSync(tempTxtPath, textContent, "utf8");
        exec(`powershell -Command "Get-Content -Path '${tempTxtPath}' | Out-Printer -Name '${printerName}'"`, (err2) => {
          if (err2) reject(err2);
          else resolve();
        });
      } else {
        resolve();
      }
    });
  });
}

/**
 * Send RAW binary to USB Device file
 */
function sendUsbRaw(usbPath, buffer) {
  return new Promise((resolve, reject) => {
    fs.writeFile(usbPath, buffer, err => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// ── Startup Banner ────────────────────────────────────────────────
console.log(`
╔════════════════════════════════════════════════════════════╗
║  Rani Mahal — Star Thermal Print Bridge                    ║
║  Printer Mode: RAW TCP Socket (${CONFIG.printer.host}:${CONFIG.printer.port})     ║
║  Polling Queue: Every ${CONFIG.pollMs / 1000} seconds                         ║
╚════════════════════════════════════════════════════════════╝
`);

poll();
setInterval(poll, CONFIG.pollMs);

process.on("SIGINT",  () => { console.log("\nPrint bridge stopped."); process.exit(0); });
process.on("SIGTERM", () => { console.log("\nPrint bridge stopped."); process.exit(0); });
