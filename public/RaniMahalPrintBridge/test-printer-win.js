// test-printer-win.js — Diagnostic test for 2-Ticket Printing (Guest + Kitchen Ticket)
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

const PRINTER_NAME = process.argv[2] || process.env.PRINTER_NAME || "TSP143";

console.log(`🔍 Testing 2-Ticket Physical Print via Windows Driver: "${PRINTER_NAME}"...`);

// Ticket 1: Guest Receipt
const guestText = `
HEADER:RANI MAHAL
       FINE INDIAN CUISINE       
  327 Mamaroneck Ave, NY 10543   
         (914) 835-9066          
=================================
          ORDER #TEST12          
=================================
MODE:***  PICKUP ORDER  ***
=================================
TIME:            Aug 10, 8:15 PM
CUSTOMER:           RIYADH JUWEL
PHONE:            (914) 441-1103
---------------------------------
QTY  ITEM                   PRICE
---------------------------------
1x   RAITA                  $4.50
1x   BIRIYANI MEDLEY       $27.95
1x   PESHWARI NAAN          $6.20
     [SPICE: MILD]
1x   MIXED APPETIZERS       $9.95
1x   NIMBU PANI             $6.00
---------------------------------
Subtotal:                 $54.60
Tax (8.375%):              $4.57
---------------------------------
TOTAL:                    $72.49
Payment:           Stripe (Paid)
=================================
    Thank you for your order!    
          ranimahal.cc           
`.trim() + "\r\n\r\n\r\n\r\n";

// Ticket 2: Giant Kitchen Ticket (NO PRICES)
const kitchenText = `
KHEADER:*** KITCHEN TICKET ***
---------------------------------
KMODE:PICKUP  #TEST12
---------------------------------
KMETA:TIME:  8:15 PM
KMETA:GUEST: RIYADH JUWEL
KMETA:PHONE: (914) 441-1103
=================================
KQTY:[ 1x ]
KITEM:RAITA
---------------------------------
KQTY:[ 1x ]
KITEM:BIRIYANI MEDLEY
---------------------------------
KQTY:[ 1x ]
KITEM:PESHWARI NAAN
KMOD:   ↳ SPICE: MILD
---------------------------------
KQTY:[ 1x ]
KITEM:MIXED APPETIZERS
---------------------------------
KQTY:[ 1x ]
KITEM:NIMBU PANI
---------------------------------
KINSTRUCT:📝 SPECIAL INSTRUCTIONS:
KINSTRUCT:PACK EXTRA CHUTNEY ON SIDE
=================================
`.trim() + "\r\n\r\n\r\n\r\n";

function printJob(textContent) {
  return new Promise((resolve, reject) => {
    const tmpTxtFile = path.join(os.tmpdir(), "rm_test_job.txt");
    const tmpPs1File = path.join(os.tmpdir(), "rm_test_job.ps1");
    
    fs.writeFileSync(tmpTxtFile, textContent, "utf8");

    const psContent = `
# PowerShell Receipt Printer Script
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

$filePath = '${tmpTxtFile.replace(/\\/g, "\\\\")}'
$lines = [System.IO.File]::ReadAllLines($filePath)
$pd = New-Object System.Drawing.Printing.PrintDocument
$pd.PrinterSettings.PrinterName = '${PRINTER_NAME}'
$pd.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0,0,0,0)

# Guest Receipt Fonts
$fontBody     = New-Object System.Drawing.Font('Courier New', 9.0,  [System.Drawing.FontStyle]::Bold)
$fontHeader   = New-Object System.Drawing.Font('Courier New', 15.0, [System.Drawing.FontStyle]::Bold)
$fontMode     = New-Object System.Drawing.Font('Courier New', 14.0, [System.Drawing.FontStyle]::Bold)

# Giant Kitchen Chit Fonts
$fontKHeader  = New-Object System.Drawing.Font('Courier New', 16.0, [System.Drawing.FontStyle]::Bold)
$fontKMode    = New-Object System.Drawing.Font('Courier New', 18.0, [System.Drawing.FontStyle]::Bold)
$fontKMeta    = New-Object System.Drawing.Font('Courier New', 12.0, [System.Drawing.FontStyle]::Bold)
$fontKQty     = New-Object System.Drawing.Font('Courier New', 26.0, [System.Drawing.FontStyle]::Bold)
$fontKItem    = New-Object System.Drawing.Font('Courier New', 17.0, [System.Drawing.FontStyle]::Bold)
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
    elseif ($line.StartsWith('KQTY:')) {
      $txt = $line.Substring(5)
      $e.Graphics.DrawString($txt, $fontKQty, [System.Drawing.Brushes]::Black, 0, $y)
      $y += $fontKQty.GetHeight($e.Graphics) + 2
    }
    elseif ($line.StartsWith('KITEM:')) {
      $txt = $line.Substring(6)
      $words = $txt.Split(' ')
      $curLine = ''
      foreach ($word in $words) {
        $test = ($curLine + ' ' + $word).Trim()
        $sz = $e.Graphics.MeasureString($test, $fontKItem)
        if ($sz.Width -gt $e.PageBounds.Width) {
          $e.Graphics.DrawString($curLine, $fontKItem, [System.Drawing.Brushes]::Black, 0, $y)
          $y += $fontKItem.GetHeight($e.Graphics) + 1
          $curLine = $word
        } else {
          $curLine = $test
        }
      }
      if ($curLine.Length -gt 0) {
        $e.Graphics.DrawString($curLine, $fontKItem, [System.Drawing.Brushes]::Black, 0, $y)
        $y += $fontKItem.GetHeight($e.Graphics) + 3
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
$fontHeader.Dispose();
$fontMode.Dispose();
$fontKHeader.Dispose();
$fontKMode.Dispose();
$fontKMeta.Dispose();
$fontKQty.Dispose();
$fontKItem.Dispose();
$fontKMod.Dispose();
$fontKInstruct.Dispose();
`;

    fs.writeFileSync(tmpPs1File, psContent, "utf8");

    exec(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tmpPs1File.replace(/\\/g, "\\\\")}"`, { timeout: 15000 }, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function runTest() {
  try {
    console.log("⏳ Sending Ticket 1 (Guest Receipt)...");
    await printJob(guestText);
    console.log("✅ Ticket 1 sent! Pausing 1s...");

    await new Promise(r => setTimeout(r, 1000));

    console.log("⏳ Sending Ticket 2 (Giant Kitchen Ticket)...");
    await printJob(kitchenText);
    console.log("✅ Ticket 2 sent!");

    console.log("\n🎉 2-Ticket test completed successfully!");
    console.log("Check printer — you should have 2 cut receipts: Ticket 1 (Guest Receipt) & Ticket 2 (Giant Kitchen Chit with 26pt QTY & 17pt ITEM text)!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Print Failed:", err.message);
    process.exit(1);
  }
}

runTest();
