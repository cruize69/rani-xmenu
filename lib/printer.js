// ── Star TSP100/TSP143 receipt formatter ─────────────────────────
// Generates StarPRNT ESC/POS-compatible byte sequences
// Used by both the Vercel webhook (via print bridge) and local bridge script

const ESC = 0x1B;
const GS  = 0x1D;

const INIT      = Buffer.from([ESC, 0x40]); // Initialize/wake printer (ESC @)
const NORMAL    = Buffer.from([ESC, 0x21, 0x00]);
const BOLD      = Buffer.from([ESC, 0x21, 0x08, ESC, 0x45]); // Dual ESC/POS & Star Line bold
const DOUBLE    = Buffer.from([ESC, 0x21, 0x30, ESC, 0x69, 0x01, 0x01]); // Dual double size
const CENTER    = Buffer.from([ESC, 0x61, 0x01, ESC, GS, 0x61, 0x01]); // Dual center alignment
const LEFT      = Buffer.from([ESC, 0x61, 0x00, ESC, GS, 0x61, 0x00]); // Dual left alignment
const CUT       = Buffer.from([0x0A, 0x0A, ESC, 0x64, 0x02, GS, 0x56, 0x00, 0x0A]); // Dual Star Line & ESC/POS paper cut
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

  // Initialize printer & clear buffer
  chunks.push(INIT);
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
  if (order.ccFee > 0) {
    chunks.push(twoCol("CC Processing Fee", `$${order.ccFee.toFixed(2)}`));
  }
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

/**
 * Build plain text receipt string for Windows Out-Printer (TSP143)
 */
export function buildPlainTextReceipt(order) {
  const shortId = order.id.slice(-6).toUpperCase();
  const isDelivery = order.orderMode === "delivery";
  const lines = [];

  const W = 32; // 32 chars width (exact zero-wrap fit for 80mm thermal paper)
  const center = (str) => {
    const s = String(str ?? "").slice(0, W);
    const pad = Math.max(0, Math.floor((W - s.length) / 2));
    return " ".repeat(pad) + s;
  };
  const twoCol = (l, r) => {
    const left = String(l ?? "");
    const right = String(r ?? "");
    const space = Math.max(1, W - left.length - right.length);
    return (left + " ".repeat(space) + right).slice(0, W);
  };

  lines.push("================================");
  lines.push(center("RANI MAHAL"));
  lines.push(center("FINE INDIAN CUISINE"));
  lines.push(center("327 Mamaroneck Ave, NY 10543"));
  lines.push(center("(914) 835-9066"));
  lines.push("================================");
  lines.push(center(`ORDER #${shortId}`));
  lines.push(center(isDelivery ? "*** DELIVERY ORDER ***" : "--- PICKUP ORDER ---"));
  lines.push("================================");

  const time = new Date(order.createdAt).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
  lines.push(twoCol("TIME:", time));
  lines.push(twoCol("CUSTOMER:", (order.customerName || "Guest").toUpperCase()));
  if (order.customerPhone) lines.push(twoCol("PHONE:", order.customerPhone));

  if (isDelivery && order.deliveryAddress) {
    lines.push("--------------------------------");
    lines.push("DELIVER TO:");
    const addr = order.deliveryAddress;
    lines.push(`${addr.street}${addr.apt ? ' ' + addr.apt : ''}`.slice(0, W));
    lines.push(`${addr.city}, NY ${addr.zip || ''}`.slice(0, W));
    if (addr.notes) lines.push(`DRIVER NOTE: ${addr.notes}`.slice(0, W));
  }

  lines.push("--------------------------------");
  lines.push(twoCol("ITEM", "QTY   PRICE"));
  lines.push("--------------------------------");

  (order.items || []).forEach(item => {
    const name = item.name.toUpperCase();
    const qty = `${item.qty}x`;
    const price = `$${(item.price * item.qty).toFixed(2)}`;
    
    lines.push(name.slice(0, W));
    lines.push(twoCol(item.spice ? `  [SPICE: ${item.spice.toUpperCase()}]` : "  ", `${qty.padStart(3)} ${price.padStart(7)}`));
    if (item.note) lines.push(`  * Note: ${item.note}`.slice(0, W));
  });

  lines.push("--------------------------------");
  lines.push(twoCol("Subtotal:", `$${(order.subtotal || 0).toFixed(2)}`));
  if (isDelivery) {
    lines.push(twoCol("Delivery Fee:", (order.deliveryFee || 0) === 0 ? "FREE" : `$${order.deliveryFee.toFixed(2)}`));
  }
  lines.push(twoCol("Tax (8.375%):", `$${(order.tax || 0).toFixed(2)}`));
  if (order.ccFee > 0) {
    lines.push(twoCol("CC Processing Fee:", `$${order.ccFee.toFixed(2)}`));
  }
  lines.push("--------------------------------");
  lines.push(twoCol("TOTAL:", `$${(order.total || 0).toFixed(2)}`));
  lines.push(twoCol("Payment:", "Stripe (Paid)"));
  lines.push("================================");

  if (order.specialInstructions) {
    lines.push("SPECIAL INSTRUCTIONS:");
    lines.push(order.specialInstructions.toUpperCase());
    lines.push("================================");
  }

  lines.push(center("Thank you for your order!"));
  lines.push(center("ranimahal.food"));
  lines.push("\n\n\n\n");

  return lines.join("\r\n");
}
