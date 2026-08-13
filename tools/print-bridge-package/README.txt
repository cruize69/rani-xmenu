========================================================================
  RANI MAHAL — STAR THERMAL PRINT BRIDGE SETUP GUIDE
========================================================================

Printer IP: 192.168.2.221 (Port 9100)

QUICK SETUP INSTRUCTIONS:
-------------------------

1. Extract RaniMahalPrintBridge.zip to any folder (e.g. C:\RaniMahalPrintBridge).

2. Test your printer immediately:
   Double-click test-printer.js (or run `node test-printer.js` in Command Prompt).
   Your printer should instantly print a test receipt and cut the paper!

3. Run the live Print Bridge:
   Double-click `start-printer.bat` (or run `node print-bridge.js`).

   The bridge will poll https://ranimahal.food every 4 seconds for new orders
   and automatically print pitch-black receipts with full 80mm width!

========================================================================
