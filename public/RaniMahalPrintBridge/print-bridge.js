#!/usr/bin/env node
// print-bridge.js — Rani Mahal Thermal Printer Bridge
// ─────────────────────────────────────────────────────────────────
// Supports Star TSP143 / TSP100 receipt printers on Windows
// Uses Windows Printer Driver Spooler with System.Drawing.Printing
// (0 margins, Courier New 9.0pt Bold, W=33 columns) for zero right edge truncation!
// Renders MODE: (*** PICKUP ORDER *** / *** DELIVERY ORDER ***) in 15pt Bold Centered!
// ─────────────────────────────────────────────────────────────────

import net  from "net";
import fs   from "fs";
import path from "path";
import os   from "os";
import { exec } from "child_process";
import { buildReceipt, buildPlainTextReceipt } from "./lib/printer.js";

// ── Configuration ────────────────────────────────────────────────
const CONFIG = {
  // Ordering site API URL
  apiBase: process.env.API_BASE ?? "https://ranimahal.food",

  // Manager secret password
  managerSecret: process.env.MANAGER_SECRET ?? "change-me",

  // Printer configuration:
  // "win" = Uses Windows Printer Driver (e.g. TSP143) — RECOMMENDED
  // "tcp" = Direct RAW socket to LAN IP (192.168.2.221:9100)
  printer: {
    type: process.env.PRINTER_TYPE ?? "win",
    winName: process.env.PRINTER_NAME ?? "TSP143",
    host: process.env.PRINTER_IP ?? "192.168.2.221",
    port: parseInt(process.env.PRINTER_PORT ?? "9100", 10),
  },

  // Queue polling interval (4 seconds)
  pollMs: 4000,
};

// Guard against missing secret
if (CONFIG.managerSecret === "change-me") {
  console.error(`
╔══════════════════════════════════════════════════════════════╗
║  ❌ MANAGER_SECRET IS NOT SET                                ║
║                                                              ║
║  Please edit start-printer.bat and set your secret:          ║
║    set MANAGER_SECRET=your_real_secret                       ║
╚══════════════════════════════════════════════════════════════╝
`);
  process.exit(1);
}

let isRunning = false;

async function poll() {
  if (isRunning) return;
  isRunning = true;

  try {
    // Pop next order ID from print queue
    const res = await fetch(`${CONFIG.apiBase}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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

    console.log(`[${ts()}] 🖨️ New order received: ${orderId.slice(-6).toUpperCase()} — printing...`);

    // Fetch full order data
    const orderRes = await fetch(`${CONFIG.apiBase}/api/orders?id=${orderId}`, {
      headers: { "x-manager-secret": CONFIG.managerSecret },
    });

    if (!orderRes.ok) {
      console.error(`[${ts()}] Order fetch failed for ${orderId}: HTTP ${orderRes.status}`);
      return;
    }

    const order = await orderRes.json();

    // Print receipt based on mode
    if (CONFIG.printer.type === "tcp") {
      const binaryReceipt = buildReceipt(order);
      await sendTcpRaw(CONFIG.printer.host, CONFIG.printer.port, binaryReceipt);
    } else {
      const textContent = buildPlainTextReceipt(order);
      await sendWindowsDriver(CONFIG.printer.winName, textContent);
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

    console.log(`[${ts()}] ✅ Order ${orderId.slice(-6).toUpperCase()} printed successfully!`);

  } catch (err) {
    console.error(`[${ts()}] ❌ Print Error:`, err.message);
  } finally {
    isRunning = false;
  }
}

/**
 * Send receipt text to Windows printer driver using System.Drawing.Printing
 * Enforces 0 margins, Courier New 9.0pt Bold body text (W=33 cols), 15pt Header, and 15pt MODE Header!
 */
function sendWindowsDriver(printerName, textContent) {
  return new Promise((resolve, reject) => {
    const tmpFile = path.join(os.tmpdir(), "rm_print_job.txt");
    fs.writeFileSync(tmpFile, textContent, "utf8");

    const psScript = `
    Add-Type -AssemblyName System.Drawing;
    Add-Type -AssemblyName System.Windows.Forms;
    $filePath = '${tmpFile.replace(/\\/g, "\\\\")}';
    $lines = [System.IO.File]::ReadAllLines($filePath);
    $pd = New-Object System.Drawing.Printing.PrintDocument;
    $pd.PrinterSettings.PrinterName = '${printerName}';
    $pd.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0,0,0,0);
    
    $fontBody   = New-Object System.Drawing.Font('Courier New', 9.0, [System.Drawing.FontStyle]::Bold);
    $fontHeader = New-Object System.Drawing.Font('Courier New', 15.0, [System.Drawing.FontStyle]::Bold);
    $fontMode   = New-Object System.Drawing.Font('Courier New', 14.0, [System.Drawing.FontStyle]::Bold);

    $lineIndex = 0;
    $pd.add_PrintPage({
      param($sender, $e)
      $y = 0;
      while ($lineIndex -lt $lines.Count) {
        $line = $lines[$lineIndex];
        if ($line.StartsWith('HEADER:')) {
          $txt = $line.Substring(7);
          $size = $e.Graphics.MeasureString($txt, $fontHeader);
          $x = [Math]::Max(0, ($e.PageBounds.Width - $size.Width) / 2);
          $e.Graphics.DrawString($txt, $fontHeader, [System.Drawing.Brushes]::Black, $x, $y);
          $y += $fontHeader.GetHeight($e.Graphics) + 2;
        }
        elseif ($line.StartsWith('MODE:')) {
          $txt = $line.Substring(5);
          $size = $e.Graphics.MeasureString($txt, $fontMode);
          $x = [Math]::Max(0, ($e.PageBounds.Width - $size.Width) / 2);
          $e.Graphics.DrawString($txt, $fontMode, [System.Drawing.Brushes]::Black, $x, $y);
          $y += $fontMode.GetHeight($e.Graphics) + 4;
        }
        else {
          $e.Graphics.DrawString($line, $fontBody, [System.Drawing.Brushes]::Black, 0, $y);
          $y += $fontBody.GetHeight($e.Graphics) + 1;
        }
        $lineIndex++;
      }
    });
    $pd.Print();
    $pd.Dispose();
    $fontBody.Dispose();
    $fontHeader.Dispose();
    $fontMode.Dispose();
    `.trim().replace(/\r?\n/g, " ");

    exec(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psScript}"`, { timeout: 15000 }, (err, stdout, stderr) => {
      if (err) {
        console.error(`[${ts()}] Windows Spooler Error:`, stderr || err.message);
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Send RAW Binary Buffer over TCP Socket directly to Port 9100
 */
function sendTcpRaw(host, port, buffer) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    socket.setNoDelay(true);
    socket.setTimeout(6000);

    socket.connect(port, host, () => {
      socket.write(buffer, () => {
        setTimeout(() => {
          socket.end();
          socket.destroy();
          resolve();
        }, 500);
      });
    });

    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error(`Printer timeout connecting to ${host}:${port}`));
    });

    socket.on("error", (err) => {
      socket.destroy();
      reject(err);
    });
  });
}

const ts = () => new Date().toLocaleTimeString();

console.log(`
╔════════════════════════════════════════════════════════════╗
║  Rani Mahal — Star Thermal Print Bridge                    ║
║  Mode: Windows Driver (${CONFIG.printer.winName})                  ║
║  Polling Queue: Every ${CONFIG.pollMs / 1000} seconds                         ║
╚════════════════════════════════════════════════════════════╝
`);

poll();
setInterval(poll, CONFIG.pollMs);

process.on("SIGINT",  () => { console.log("\nBridge stopped."); process.exit(0); });
process.on("SIGTERM", () => { console.log("\nBridge stopped."); process.exit(0); });
