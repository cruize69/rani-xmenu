// test-printer-win.js — Diagnostic test for Star TSP143 Windows Driver
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

const PRINTER_NAME = process.argv[2] || process.env.PRINTER_NAME || "TSP143";

console.log(`🔍 Testing physical print via Windows Driver: "${PRINTER_NAME}"...`);

const sampleText = `
==========================================
               RANI MAHAL                 
          FINE INDIAN CUISINE             
      327 Mamaroneck Ave, NY 10543        
             (914) 835-9066               
==========================================
              ORDER #TEST12               
          *** PICKUP ORDER ***            
==========================================
TIME:                      Aug 10, 6:50 PM
CUSTOMER:                      TEST GUEST 
PHONE:                     (914) 555-0199 
------------------------------------------
ITEM                           QTY   PRICE
------------------------------------------
CHICKEN TIKKA MASALA            1x  $18.00
  [SPICE: MEDIUM]                         
  * Note: Extra sauce on side             
GARLIC NAAN                     2x   $9.00
------------------------------------------
Subtotal:                           $27.00
Tax (8.375%):                        $2.26
==========================================
TOTAL:                              $29.26
Payment:                     Stripe (Paid)
==========================================
       Thank you for your order!          
             ranimahal.food               
`.trim();

const tmpFile = path.join(os.tmpdir(), "rm_test_receipt.txt");
fs.writeFileSync(tmpFile, sampleText, "utf8");

// PowerShell script using System.Drawing.Printing.PrintDocument
// Explicitly uses Courier New 8pt with 0 margins to prevent GDI line wrapping
const psScript = `
Add-Type -AssemblyName System.Drawing;
Add-Type -AssemblyName System.Windows.Forms;
$filePath = '${tmpFile.replace(/\\/g, "\\\\")}';
$lines = [System.IO.File]::ReadAllLines($filePath);
$pd = New-Object System.Drawing.Printing.PrintDocument;
$pd.PrinterSettings.PrinterName = '${PRINTER_NAME}';
$pd.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0,0,0,0);
$font = New-Object System.Drawing.Font('Courier New', 8, [System.Drawing.FontStyle]::Bold);
$lineIndex = 0;
$pd.add_PrintPage({
  param($sender, $e)
  $y = 0;
  $lineH = $font.GetHeight($e.Graphics) + 1;
  while ($lineIndex -lt $lines.Count) {
    $e.Graphics.DrawString($lines[$lineIndex], $font, [System.Drawing.Brushes]::Black, 0, $y);
    $y += $lineH;
    $lineIndex++;
  }
});
$pd.Print();
$pd.Dispose();
$font.Dispose();
`.trim().replace(/\r?\n/g, " ");

console.log("⏳ Sending print job to Windows spooler...");

exec(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psScript}"`, (err, stdout, stderr) => {
  if (err) {
    console.error("❌ Print Failed:", stderr || err.message);
    console.log("\n💡 TIP: Check if your printer name in Windows 'Printers & Scanners' is exact (e.g. TSP143).");
    process.exit(1);
  } else {
    console.log("✅ Print job sent successfully to Windows Spooler!");
    console.log("🎉 Check your printer — paper should print full-width and bold!");
    process.exit(0);
  }
});
