#!/usr/bin/env node
// print-bridge.js — Rani Mahal Thermal Printer Bridge
// ─────────────────────────────────────────────────────────────────
// Automatic 2-Ticket Workflow:
//   Ticket 1: Guest Receipt (Full pricing, subtotal, tax, Stripe paid)
//   Ticket 2: Kitchen Ticket (Prices stripped — 26pt QTY & 17pt ITEM text)
// ─────────────────────────────────────────────────────────────────

import net  from "net";
import fs   from "fs";
import path from "path";
import os   from "os";
import { exec } from "child_process";
import { buildReceipt, buildPlainTextReceipt, buildKitchenChit } from "./lib/printer.js";

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

    console.log(`[${ts()}] 🖨️ New order received: ${orderId.slice(-6).toUpperCase()} — printing 2 tickets...`);

    // Fetch full order data
    const orderRes = await fetch(`${CONFIG.apiBase}/api/orders?id=${orderId}`, {
      headers: { "x-manager-secret": CONFIG.managerSecret },
    });

    if (!orderRes.ok) {
      console.error(`[${ts()}] Order fetch failed for ${orderId}: HTTP ${orderRes.status}`);
      return;
    }

    const order = await orderRes.json();

    // ── Ticket 1: Guest Receipt ─────────────────────────────────
    console.log(`[${ts()}] 🎟️ Printing Ticket 1: Guest Receipt (${orderId.slice(-6).toUpperCase()})...`);
    if (CONFIG.printer.type === "tcp") {
      const binaryReceipt = buildReceipt(order);
      await sendTcpRaw(CONFIG.printer.host, CONFIG.printer.port, binaryReceipt);
    } else {
      const guestText = buildPlainTextReceipt(order);
      await sendWindowsDriver(CONFIG.printer.winName, guestText);
    }

    // Small delay between print jobs
    await new Promise(r => setTimeout(r, 1000));

    // ── Ticket 2: Giant Kitchen Ticket ──────────────────────────
    console.log(`[${ts()}] 👨‍🍳 Printing Ticket 2: Giant Kitchen Ticket (${orderId.slice(-6).toUpperCase()})...`);
    if (CONFIG.printer.type === "tcp") {
      const binaryReceipt = buildReceipt(order); // TCP binary fallback
      await sendTcpRaw(CONFIG.printer.host, CONFIG.printer.port, binaryReceipt);
    } else {
      const kitchenText = buildKitchenChit(order);
      await sendWindowsDriver(CONFIG.printer.winName, kitchenText);
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

    console.log(`[${ts()}] ✅ Order ${orderId.slice(-6).toUpperCase()} printed 2 tickets successfully!`);

    // ── Ticket 3: Reorder Fast Pass Voucher ──────────────────────
    if (order.reorderToken) {
      console.log(`[${ts()}] 🎟️ Printing Ticket 3: Reorder Fast Pass Voucher (${orderId.slice(-6).toUpperCase()})...`);
      
      const qrPath = path.join(os.tmpdir(), `reorder_${order.reorderToken}.png`);
      try {
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`${CONFIG.apiBase}/?reorder=${order.reorderToken}`)}`;
        const qrRes = await fetch(qrUrl);
        if (qrRes.ok) {
          const buffer = await qrRes.arrayBuffer();
          fs.writeFileSync(qrPath, Buffer.from(buffer));
          
          const voucherText = buildReorderVoucherText(order, qrPath);
          if (CONFIG.printer.type === "tcp") {
            console.log("Reorder voucher skip in TCP mode (unsupported)");
          } else {
            await sendWindowsDriver(CONFIG.printer.winName, voucherText);
          }
        } else {
          console.error(`[${ts()}] QR Code API returned HTTP ${qrRes.status}`);
        }
      } catch (err) {
        console.error(`[${ts()}] Failed to download or print reorder voucher:`, err.message);
      }
    }

  } catch (err) {
    console.error(`[${ts()}] ❌ Print Error:`, err.message);
  } finally {
    isRunning = false;
  }
}

function buildReorderVoucherText(order, qrPath) {
  const expiryDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  const options = { weekday: "long", year: "numeric", month: "short", day: "numeric" };
  const expiryStr = expiryDate.toLocaleDateString("en-US", options);

  const lines = [];
  lines.push("========================================");
  lines.push("HEADER:RANI MAHAL");
  lines.push("========================================");
  lines.push("");
  lines.push("MODE:** 1-TAP FAST PASS **");
  lines.push(" (Scan to reorder these items)");
  lines.push("");
  lines.push("MODE:*** 10% OFF DISCOUNT ***");
  lines.push("");
  lines.push(`QRCODE:${qrPath}`);
  lines.push("");
  lines.push("          VALID FOR 14 DAYS UNTIL:");
  lines.push(`          ${expiryStr}`);
  lines.push("");
  lines.push("========================================");
  lines.push("\n\n\n");

  return lines.join("\r\n");
}

/**
 * Send receipt text to Windows printer driver using System.Drawing.Printing
 * Writes script to .ps1 file and executes via powershell -File for 100% syntax reliability
 */
function sendWindowsDriver(printerName, textContent) {
  return new Promise((resolve, reject) => {
    const tmpTxtFile = path.join(os.tmpdir(), "rm_print_job.txt");
    const tmpPs1File = path.join(os.tmpdir(), "rm_print_job.ps1");
    
    fs.writeFileSync(tmpTxtFile, textContent, "utf8");

    const psContent = `
# PowerShell Receipt Printer Script
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

$filePath = '${tmpTxtFile.replace(/\\/g, "\\\\")}'
$lines = [System.IO.File]::ReadAllLines($filePath)
$pd = New-Object System.Drawing.Printing.PrintDocument
$pd.PrinterSettings.PrinterName = '${printerName}'
$pd.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0,0,0,0)

# Guest Receipt Fonts
$fontBody     = New-Object System.Drawing.Font('Courier New', 9.0,  [System.Drawing.FontStyle]::Bold)
$fontHeader   = New-Object System.Drawing.Font('Courier New', 15.0, [System.Drawing.FontStyle]::Bold)
$fontMode     = New-Object System.Drawing.Font('Courier New', 14.0, [System.Drawing.FontStyle]::Bold)

# Giant Kitchen Chit Fonts
$fontKHeader  = New-Object System.Drawing.Font('Courier New', 16.0, [System.Drawing.FontStyle]::Bold)
$fontKMode    = New-Object System.Drawing.Font('Courier New', 18.0, [System.Drawing.FontStyle]::Bold)
$fontKMeta    = New-Object System.Drawing.Font('Courier New', 12.0, [System.Drawing.FontStyle]::Bold)
$fontKQty     = New-Object System.Drawing.Font('Courier New', 14.0, [System.Drawing.FontStyle]::Bold)
$fontKItem    = New-Object System.Drawing.Font('Courier New', 17.0, [System.Drawing.FontStyle]::Bold)
$fontKItemBig = New-Object System.Drawing.Font('Courier New', 24.0, [System.Drawing.FontStyle]::Bold)
$fontKMod     = New-Object System.Drawing.Font('Courier New', 13.5, [System.Drawing.FontStyle]::Bold)
$fontKInstruct= New-Object System.Drawing.Font('Courier New', 15.0, [System.Drawing.FontStyle]::Bold)

$lineIndex = 0
$pd.add_PrintPage({
  param($sender, $e)
  $y = 0
  while ($lineIndex -lt $lines.Count) {
    $line = $lines[$lineIndex]

    # Guest Receipt Lines
    if ($line.StartsWith('HEADER:')) {
      $txt = $line.Substring(7)
      $size = $e.Graphics.MeasureString($txt, $fontHeader)
      $x = [Math]::Max(0, ($e.PageBounds.Width - $size.Width) / 2)
      $e.Graphics.DrawString($txt, $fontHeader, [System.Drawing.Brushes]::Black, $x, $y)
      $y += $fontHeader.GetHeight($e.Graphics) + 2
    }
    elseif ($line.StartsWith('MODE:')) {
      $txt = $line.Substring(5)
      $size = $e.Graphics.MeasureString($txt, $fontMode)
      $x = [Math]::Max(0, ($e.PageBounds.Width - $size.Width) / 2)
      $e.Graphics.DrawString($txt, $fontMode, [System.Drawing.Brushes]::Black, $x, $y)
      $y += $fontMode.GetHeight($e.Graphics) + 4
    }

    # Kitchen Chit Lines (Giant Fonts)
    elseif ($line.StartsWith('KHEADER:')) {
      $txt = $line.Substring(8)
      $size = $e.Graphics.MeasureString($txt, $fontKHeader)
      $x = [Math]::Max(0, ($e.PageBounds.Width - $size.Width) / 2)
      $e.Graphics.DrawString($txt, $fontKHeader, [System.Drawing.Brushes]::Black, $x, $y)
      $y += $fontKHeader.GetHeight($e.Graphics) + 2
    }
    elseif ($line.StartsWith('KMODE:')) {
      $txt = $line.Substring(6)
      $size = $e.Graphics.MeasureString($txt, $fontKMode)
      $x = [Math]::Max(0, ($e.PageBounds.Width - $size.Width) / 2)
      $e.Graphics.DrawString($txt, $fontKMode, [System.Drawing.Brushes]::Black, $x, $y)
      $y += $fontKMode.GetHeight($e.Graphics) + 4
    }
    elseif ($line.StartsWith('KMETA:')) {
      $txt = $line.Substring(6)
      $e.Graphics.DrawString($txt, $fontKMeta, [System.Drawing.Brushes]::Black, 0, $y)
      $y += $fontKMeta.GetHeight($e.Graphics) + 2
    }
    elseif ($line.StartsWith('KLINE:')) {
      # Qty (small) flush against item name (large) on one line — item name
      # is what the kitchen actually reads, so it gets the most px.
      $payload = $line.Substring(6)
      $parts = $payload.Split('|', 2)
      $qtyTxt = "$($parts[0]) "
      $nameTxt = $parts[1]

      $qtySize = $e.Graphics.MeasureString($qtyTxt, $fontKQty)
      $itemHeight = $fontKItemBig.GetHeight($e.Graphics)
      $qtyBaselineOffset = [Math]::Max(0, ($itemHeight - $fontKQty.GetHeight($e.Graphics)) / 2)

      $words = $nameTxt.Split(' ')
      $curLine = ''
      $firstLine = $true
      foreach ($word in $words) {
        $test = ($curLine + ' ' + $word).Trim()
        $availWidth = if ($firstLine) { $e.PageBounds.Width - $qtySize.Width } else { $e.PageBounds.Width }
        $sz = $e.Graphics.MeasureString($test, $fontKItemBig)
        if ($sz.Width -gt $availWidth -and $curLine.Length -gt 0) {
          if ($firstLine) {
            $e.Graphics.DrawString($qtyTxt, $fontKQty, [System.Drawing.Brushes]::Black, 0, $y + $qtyBaselineOffset)
            $e.Graphics.DrawString($curLine, $fontKItemBig, [System.Drawing.Brushes]::Black, $qtySize.Width, $y)
          } else {
            $e.Graphics.DrawString($curLine, $fontKItemBig, [System.Drawing.Brushes]::Black, 0, $y)
          }
          $y += $itemHeight + 1
          $curLine = $word
          $firstLine = $false
        } else {
          $curLine = $test
        }
      }
      if ($curLine.Length -gt 0) {
        if ($firstLine) {
          $e.Graphics.DrawString($qtyTxt, $fontKQty, [System.Drawing.Brushes]::Black, 0, $y + $qtyBaselineOffset)
          $e.Graphics.DrawString($curLine, $fontKItemBig, [System.Drawing.Brushes]::Black, $qtySize.Width, $y)
        } else {
          $e.Graphics.DrawString($curLine, $fontKItemBig, [System.Drawing.Brushes]::Black, 0, $y)
        }
        $y += $itemHeight + 3
      }
    }
    elseif ($line.StartsWith('KMOD:')) {
      $txt = $line.Substring(5)
      $e.Graphics.DrawString($txt, $fontKMod, [System.Drawing.Brushes]::Black, 0, $y)
      $y += $fontKMod.GetHeight($e.Graphics) + 2
    }
    elseif ($line.StartsWith('KINSTRUCT:')) {
      $txt = $line.Substring(10)
      $e.Graphics.DrawString($txt, $fontKInstruct, [System.Drawing.Brushes]::Black, 0, $y)
      $y += $fontKInstruct.GetHeight($e.Graphics) + 2
    }
    elseif ($line.StartsWith('QRCODE:')) {
      $path = $line.Substring(7)
      if (Test-Path $path) {
        $img = [System.Drawing.Image]::FromFile($path)
        $x = [Math]::Max(0, ($e.PageBounds.Width - 144) / 2)
        $e.Graphics.DrawImage($img, $x, $y, 144, 144)
        $y += 144 + 8
        $img.Dispose()
      }
    }

    # Regular Lines
    else {
      $e.Graphics.DrawString($line, $fontBody, [System.Drawing.Brushes]::Black, 0, $y)
      $y += $fontBody.GetHeight($e.Graphics) + 1
    }
    $lineIndex++
  }
})
$pd.Print()
$pd.Dispose()
$fontBody.Dispose()
$fontHeader.Dispose()
$fontMode.Dispose()
$fontKHeader.Dispose()
$fontKMode.Dispose()
$fontKMeta.Dispose()
$fontKQty.Dispose()
$fontKItem.Dispose()
$fontKItemBig.Dispose()
$fontKMod.Dispose()
$fontKInstruct.Dispose()
`;

    fs.writeFileSync(tmpPs1File, psContent, "utf8");

    exec(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tmpPs1File.replace(/\\/g, "\\\\")}"`, { timeout: 15000 }, (err, stdout, stderr) => {
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
║  Rani Mahal — Star Thermal Print Bridge (2-Ticket Mode)    ║
║  Mode: Windows Driver (${CONFIG.printer.winName})                  ║
║  Tickets: [1] Guest Receipt + [2] Giant Kitchen Ticket     ║
║  Polling Queue: Every ${CONFIG.pollMs / 1000} seconds                         ║
╚════════════════════════════════════════════════════════════╝
`);

poll();
setInterval(poll, CONFIG.pollMs);

process.on("SIGINT",  () => { console.log("\nBridge stopped."); process.exit(0); });
process.on("SIGTERM", () => { console.log("\nBridge stopped."); process.exit(0); });
