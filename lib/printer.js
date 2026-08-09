// ── Star TSP100/TSP143 receipt formatter ─────────────────────────
// Generates StarPRNT ESC/POS-compatible byte sequences
// Used by both the Vercel webhook (via print bridge) and local bridge script

const ESC = 0x1B;
const GS  = 0x1D;

// Text modes
const NORMAL    = Buffer.from([ESC, 0x21, 0x00]);
const BOLD      = Buffer.from([ESC, 0x21, 0x08]);
const DOUBLE    = Buffer.from([ESC, 0x21, 0x30]); // double width + height
const CENTER    = Buffer.from([ESC, 0x61, 0x01]);
const LEFT      = Buffer.from([ESC, 0x61, 0x00]);
const CUT       = Buffer.from([GS,  0x56, 0x41, 0x00]); // full cut
const FEED      = (n) => Buffer.from([ESC, 0x64, n]);   // feed n lines

const RECEIPT_WIDTH = 42; // chars per line for 80mm paper

function pad(str, width, align = "left") {
  const s = String(str ?? "").slice(0, width);
  if (align === "right") return s.padStart(width);
  if (align === "center") {
    const pad = Math.max(0, width - s.length);
    return " ".repeat(Math.floor(pad / 2)) + s + " ".repeat(Math.ceil(pad / 2));
  }
  return s.padEnd(width);
}

function line(text = "") {
  return Buffer.from(text.slice(0, RECEIPT_WIDTH) + "\n", "utf8");
}

function divider(char = "-") {
  return line(char.repeat(RECEIPT_WIDTH));
}

function twoCol(left, right, width = RECEIPT_WIDTH) {
  const r = String(right);
  const l = String(left).slice(0, width - r.length - 1);
  return line(l.padEnd(width - r.length) + r);
}

/**
 * Build full receipt buffer for Star TSP100
 */
export function buildReceipt(order) {
  const chunks = [];

  // Header
  chunks.push(FEED(1));
  chunks.push(CENTER);
  chunks.push(DOUBLE);
  chunks.push(line("Rani Mahal"));
  chunks.push(NORMAL);
  chunks.push(line("Fine Indian Cuisine"));
  chunks.push(line("327 Mamaroneck Ave, NY 10543"));
  chunks.push(line("(914) 835-9066"));
  chunks.push(FEED(1));

  // Order info
  chunks.push(divider("="));
  chunks.push(CENTER);
  chunks.push(BOLD);
  chunks.push(line(`ORDER #${order.id.slice(-6).toUpperCase()}`));
  if (order.orderMode === "delivery") {
    chunks.push(DOUBLE);
    chunks.push(line("*** DELIVERY ORDER ***"));
    chunks.push(NORMAL);
  } else {
    chunks.push(line("--- PICKUP ORDER ---"));
  }
  chunks.push(NORMAL);
  chunks.push(LEFT);

  const time = new Date(order.createdAt).toLocaleString("en-US", {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
  chunks.push(twoCol(`Time: ${time}`, ""));
  chunks.push(twoCol("Customer:", order.customerName));
  if (order.customerPhone) chunks.push(twoCol("Phone:", order.customerPhone));

  if (order.orderMode === "delivery" && order.deliveryAddress) {
    chunks.push(divider());
    chunks.push(BOLD);
    chunks.push(line("DELIVER TO:"));
    chunks.push(NORMAL);
    const addr = order.deliveryAddress;
    chunks.push(line(`${addr.street}${addr.apt ? ' ' + addr.apt : ''}`));
    chunks.push(line(`${addr.city}, NY ${addr.zip || ''}`));
    if (addr.notes) chunks.push(line(`Driver Note: ${addr.notes}`));
  }

  chunks.push(divider());

  // Items
  chunks.push(BOLD);
  chunks.push(twoCol("ITEM", "QTY   PRICE"));
  chunks.push(NORMAL);
  chunks.push(divider());

  order.items.forEach(item => {
    const price = `$${(item.price * item.qty).toFixed(2)}`;
    const qty   = `${item.qty}x`;
    // Item name line
    chunks.push(line(item.name.slice(0, RECEIPT_WIDTH)));
    // Spice + price on second line
    const spiceStr = item.spice ? `  (${item.spice})` : "  ";
    chunks.push(twoCol(spiceStr, `${qty.padStart(3)}  ${price.padStart(7)}`));
    // Note if present
    if (item.note) chunks.push(line(`  * ${item.note}`.slice(0, RECEIPT_WIDTH)));
  });

  chunks.push(divider());

  // Totals
  chunks.push(twoCol("Subtotal", `$${order.subtotal.toFixed(2)}`));
  if (order.orderMode === "delivery") {
    chunks.push(twoCol("Delivery Fee", (order.deliveryFee || 0) === 0 ? "FREE" : `$${(order.deliveryFee || 0).toFixed(2)}`));
  }
  chunks.push(twoCol("Tax (8.375%)", `$${order.tax.toFixed(2)}`));
  chunks.push(divider());
  chunks.push(BOLD);
  chunks.push(twoCol("TOTAL", `$${order.total.toFixed(2)}`));
  chunks.push(NORMAL);
  chunks.push(twoCol("Paid via", "Stripe (Online)"));
  chunks.push(divider());

  // Special instructions
  if (order.specialInstructions) {
    chunks.push(BOLD);
    chunks.push(line("SPECIAL INSTRUCTIONS:"));
    chunks.push(NORMAL);
    // Word-wrap instructions
    const words = order.specialInstructions.split(" ");
    let currentLine = "";
    words.forEach(word => {
      if ((currentLine + " " + word).trim().length > RECEIPT_WIDTH) {
        chunks.push(line(currentLine));
        currentLine = word;
      } else {
        currentLine = (currentLine + " " + word).trim();
      }
    });
    if (currentLine) chunks.push(line(currentLine));
    chunks.push(divider());
  }

  // Footer
  chunks.push(CENTER);
  chunks.push(FEED(1));
  chunks.push(line("Thank you for your order!"));
  chunks.push(line("ranimahal.food"));
  chunks.push(FEED(3));
  chunks.push(CUT);

  return Buffer.concat(chunks);
}
