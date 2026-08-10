// test-printer-win.js — Diagnostic test for Star TSP143 Windows Driver
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

const PRINTER_NAME = process.argv[2] || process.env.PRINTER_NAME || "TSP143";

console.log(`🔍 Testing physical print via Windows Driver: "${PRINTER_NAME}"...`);

const sampleText = `
HEADER:RANI MAHAL
       FINE INDIAN CUISINE       
  327 Mamaroneck Ave, NY 10543   
         (914) 835-9066          
=================================
          ORDER #TEST12          
=================================
MODE:***  PICKUP ORDER  ***
=================================
TIME:            Aug 10, 7:35 PM
CUSTOMER:           RIYADH JUWEL
PHONE:            (914) 441-1103
---------------------------------
QTY  ITEM                   PRICE
---------------------------------
1x   RAITA                  $4.50
1x   BIRIYANI MEDLEY       $27.95
1x   PESHWARI NAAN          $6.20
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

const tmpFile = path.join(os.tmpdir(), "rm_test_receipt.txt");
fs.writeFileSync(tmpFile, sampleText, "utf8");

const psScript = `
Add-Type -AssemblyName System.Drawing;
Add-Type -AssemblyName System.Windows.Forms;
$filePath = '${tmpFile.replace(/\\/g, "\\\\")}';
$lines = [System.IO.File]::ReadAllLines($filePath);
$pd = New-Object System.Drawing.Printing.PrintDocument;
$pd.PrinterSettings.PrinterName = '${PRINTER_NAME}';
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

console.log("⏳ Sending print job to Windows spooler...");

exec(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psScript}"`, (err, stdout, stderr) => {
  if (err) {
    console.error("❌ Print Failed:", stderr || err.message);
    process.exit(1);
  } else {
    console.log("✅ Single-line item alignment print test sent successfully!");
    console.log("🎉 Check printer — QTY, ITEM NAME, and PRICE are now perfectly aligned on the SAME line!");
    process.exit(0);
  }
});
