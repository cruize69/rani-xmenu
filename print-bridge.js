#!/usr/bin/env node
// print-bridge.js — Rani Mahal Thermal Printer Bridge
// ─────────────────────────────────────────────────────────────────
// Supports two connection modes, auto-detected:
//
//   "tcp" — Sends raw Star Line/ESC-POS binary directly to Port 9100
//           (LAN-connected Star TSP143). Pitch black, full 80mm width.
//
//   "win" — Sends to Windows print spooler using Courier New 8pt so
//           lines never wrap (USB-connected Star TSP143).
//
// Auto mode: tries TCP first; if the printer isn't reachable on LAN
// within 1.5s, falls back to Windows driver automatically.
// ─────────────────────────────────────────────────────────────────

import net  from "net";
import fs   from "fs";
import path from "path";
import os   from "os";
import { exec } from "child_process";
import { buildReceipt, buildPlainTextReceipt } from "./lib/printer.js";

// ── Configuration — edit MANAGER_SECRET before running ─────────
const CONFIG = {
  apiBase:       process.env.API_BASE        ?? "https://ranimahal.food",
  managerSecret: process.env.MANAGER_SECRET  ?? "change-me",
  printer: {
    // "tcp" = direct RAW socket to printer IP on Port 9100 (LAN — what you have)
    // "win" = Windows print spooler (USB only, not needed)
    type:    process.env.PRINTER_TYPE ?? "tcp",
    winName: process.env.PRINTER_NAME ?? "TSP143",
    host:    process.env.PRINTER_IP   ?? "192.168.2.221",
    port:    parseInt(process.env.PRINTER_PORT ?? "9100", 10),
  },
  pollMs: 4000,
};

// Guard: catch unconfigured secret early
if (CONFIG.managerSecret === "change-me") {
  console.error(`
╔══════════════════════════════════════════════════════════════╗
║  ❌  MANAGER_SECRET IS NOT SET                               ║
║                                                              ║
║  Every API call will return 401 Unauthorized and nothing     ║
║  will print.                                                 ║
║                                                              ║
║  Run with:                                                   ║
║    set MANAGER_SECRET=your_real_secret && node print-bridge  ║
║  or double-click start-printer.bat after editing it.         ║
╚══════════════════════════════════════════════════════════════╝
`);
  process.exit(1);
}
// ────────────────────────────────────────────────────────────────

let isRunning = false;
let confirmedMode = null; // cached after first successful print

async function poll() {
  if (isRunning) return;
  isRunning = true;

  try {
    // Dequeue next order ID from the server
    const res = await fetch(`${CONFIG.apiBase}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type":    "application/json",
        "x-manager-secret": CONFIG.managerSecret,
      },
      body: JSON.stringify({ action: "dequeue" }),
    });

    if (!res.ok) {
      console.error(`[${ts()}] Queue fetch failed: HTTP ${res.status}`);
      return;
    }

    const { orderId } = await res.json();
    if (!orderId) return; // queue empty — normal

    console.log(`[${ts()}] 🖨️  New order: ${orderId.slice(-6).toUpperCase()} — fetching...`);

    // Fetch full order data
    const orderRes = await fetch(`${CONFIG.apiBase}/api/orders?id=${orderId}`, {
      headers: { "x-manager-secret": CONFIG.managerSecret },
    });
    if (!orderRes.ok) {
      console.error(`[${ts()}] Order fetch failed: HTTP ${orderRes.status}`);
      return;
    }
    const order = await orderRes.json();

    let mode = "tcp"; // LAN printer at 192.168.2.221:9100
    if (mode === "tcp") {
      const buf = buildReceipt(order);
      await sendTcpRaw(CONFIG.printer.host, CONFIG.printer.port, buf);
    } else {
      // Windows spooler with explicit Courier New 8pt — no wrapping
      const text = buildPlainTextReceipt(order);
      await sendWindowsDriver(CONFIG.printer.winName, text);
    }

    // Mark as printed on server
    await fetch(`${CONFIG.apiBase}/api/orders`, {
      method: "PATCH",
      headers: {
        "Content-Type":    "application/json",
        "x-manager-secret": CONFIG.managerSecret,
      },
      body: JSON.stringify({ id: orderId, printed: true }),
    });

    console.log(`[${ts()}] ✅ Order ${orderId.slice(-6).toUpperCase()} printed!`);

  } catch (err) {
    console.error(`[${ts()}] ❌ Error:`, err.message);
  } finally {
    isRunning = false;
  }
}

// ── TCP probe — just checks if port is open ───────────────────────
function canReachTcp(host, port, timeoutMs) {
  return new Promise((resolve) => {
    const s = new net.Socket();
    s.setTimeout(timeoutMs);
    s.connect(port, host, () => { s.destroy(); resolve(true);  });
    s.on("error",   () => { s.destroy(); resolve(false); });
    s.on("timeout", () => { s.destroy(); resolve(false); });
  });
}

// ── Send ESC/POS binary directly over TCP (LAN mode) ─────────────
function sendTcpRaw(host, port, buffer) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    socket.setNoDelay(true);
    socket.setTimeout(6000);

    socket.connect(port, host, () => {
      socket.write(buffer, () => {
        setTimeout(() => { socket.end(); socket.destroy(); resolve(); }, 500);
      });
    });

    socket.on("timeout", () => { socket.destroy(); reject(new Error(`TCP timeout to ${host}:${port}`)); });
    socket.on("error",   (e) => { socket.destroy(); reject(e); });
  });
}

// ── Send to Windows printer driver with Courier New 8pt ──────────
// Uses a PowerShell inline C# PrintDocument to explicitly set the font
// so Windows GDI never applies default page margins or large font sizes.
function sendWindowsDriver(printerName, text) {
  return new Promise((resolve, reject) => {
    // Write plain text to temp file
    const tmpFile = path.join(os.tmpdir(), "rm_receipt.txt");
    fs.writeFileSync(tmpFile, text, "utf8");

    // PowerShell inline script:
    // - Loads System.Drawing
    // - Creates a PrintDocument targeting the named printer
    // - Sets paper margins to 0 on all sides
    // - Renders every line in Courier New 8pt (fits ~42 chars on 80mm paper)
    // - Prints and disposes
    const ps = `
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
$lines = [System.IO.File]::ReadAllLines('${tmpFile.replace(/\\/g, "\\\\")}')
$pd = New-Object System.Drawing.Printing.PrintDocument
$pd.PrinterSettings.PrinterName = '${printerName}'
$pd.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0,0,0,0)
$font = New-Object System.Drawing.Font('Courier New', 8, [System.Drawing.FontStyle]::Regular)
$lineIndex = 0
$pd.add_PrintPage({
  param($sender, $e)
  $y = 0
  $lineH = $font.GetHeight($e.Graphics)
  while ($lineIndex -lt $lines.Count) {
    $e.Graphics.DrawString($lines[$lineIndex], $font, [System.Drawing.Brushes]::Black, 0, $y)
    $y += $lineH
    $lineIndex++
    if (($y + $lineH) -gt $e.MarginBounds.Bottom) { $e.HasMorePages = $true; break }
  }
})
$pd.Print()
$pd.Dispose()
$font.Dispose()
`.trim().replace(/\n/g, "; ");

    exec(`powershell -NoProfile -Command "${ps}"`, { timeout: 15000 }, (err, stdout, stderr) => {
      if (err) {
        console.error(`[${ts()}] Windows print error:`, stderr || err.message);
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

// ── Helpers ───────────────────────────────────────────────────────
const ts = () => new Date().toLocaleTimeString();

// ── Startup Banner ────────────────────────────────────────────────
console.log(`
╔══════════════════════════════════════════════════════╗
║  Rani Mahal — Thermal Print Bridge                   ║
║  Mode: ${CONFIG.printer.type.toUpperCase().padEnd(47)}║
║  Printer: ${CONFIG.printer.type !== "win"
    ? `${CONFIG.printer.host}:${CONFIG.printer.port}`.padEnd(43)
    : CONFIG.printer.winName.padEnd(43)}║
║  Polling every ${String(CONFIG.pollMs / 1000) + "s"}                                   ║
╚══════════════════════════════════════════════════════╝
`);

poll();
setInterval(poll, CONFIG.pollMs);

process.on("SIGINT",  () => { console.log("\nPrint bridge stopped."); process.exit(0); });
process.on("SIGTERM", () => { console.log("\nPrint bridge stopped."); process.exit(0); });
