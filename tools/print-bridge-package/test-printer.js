// test-printer.js — Immediate Star Printer Diagnostic Test
import net from "net";

const PRINTER_IP = process.argv[2] || process.env.PRINTER_IP || "192.168.2.221";
const PORT = 9100;

console.log(`Connecting to Star Printer at ${PRINTER_IP}:${PORT}...`);

const socket = new net.Socket();
socket.setNoDelay(true);
socket.setTimeout(5000);

const ESC = 0x1B;
const GS  = 0x1D;

// Build simple test receipt using Star & ESC/POS hardware control codes
const buffer = Buffer.concat([
  Buffer.from([ESC, 0x40]),                             // Initialize (ESC @)
  Buffer.from([ESC, 0x1D, 0x61, 0x01, ESC, 0x61, 0x01]), // Center
  Buffer.from([ESC, 0x69, 0x01, 0x01, ESC, 0x21, 0x30]), // Double size
  Buffer.from("Rani Mahal\n", "utf8"),
  Buffer.from([ESC, 0x69, 0x00, 0x00, ESC, 0x21, 0x00]), // Normal size
  Buffer.from("STAR PRINTER TEST OK!\n", "utf8"),
  Buffer.from("Pitch Black 100% Thermal Density\n\n", "utf8"),
  Buffer.from(new Date().toLocaleString() + "\n\n\n\n", "utf8"),
  Buffer.from([0x0A, 0x0A, ESC, 0x64, 0x02, GS, 0x56, 0x00, 0x0A]) // Feed & Auto Cut
]);

socket.connect(PORT, PRINTER_IP, () => {
  console.log("✅ Socket connected! Sending test receipt payload...");
  socket.write(buffer, () => {
    console.log("✅ Bytes written to socket buffer. Flushing & closing...");
    setTimeout(() => {
      socket.end();
      socket.destroy();
      console.log("🎉 Test completed! Printer should now print pitch-black and auto-cut.");
      process.exit(0);
    }, 500);
  });
});

socket.on("timeout", () => {
  console.error("❌ TIMEOUT: Could not reach printer. Check printer IP or network cable.");
  socket.destroy();
  process.exit(1);
});

socket.on("error", (err) => {
  console.error("❌ SOCKET ERROR:", err.message);
  socket.destroy();
  process.exit(1);
});
