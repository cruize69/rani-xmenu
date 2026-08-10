// ── Star TSP100/TSP143 receipt formatter ─────────────────────────
// Generates Star Line Mode & ESC/POS dual-compatible byte sequences
// Supported by Star TSP143, TSP100, TSP654, and ESC/POS thermal receipt printers

const ESC = 0x1B;
const GS  = 0x1D;

// Control Command Buffers
const INIT         = Buffer.from([ESC, 0x40]);                                        // ESC @  (Initialize printer)
const BOLD_ON      = Buffer.from([ESC, 0x45, ESC, 0x45, ESC, 0x21, 0x08]);            // ESC E  (Star & ESC/POS Bold ON)
const BOLD_OFF     = Buffer.from([ESC, 0x46, ESC, 0x46, ESC, 0x21, 0x00]);            // ESC F  (Star & ESC/POS Bold OFF)
const DOUBLE_ON    = Buffer.from([ESC, 0x69, 0x01, 0x01, ESC, 0x21, 0x30]);           // ESC i 1 1 (Star & ESC/POS Double size)
const DOUBLE_OFF   = Buffer.from([ESC, 0x69, 0x00, 0x00, ESC, 0x21, 0x00]);           // ESC i 0 0 (Normal size)
const ALIGN_CENTER = Buffer.from([ESC, 0x1D, 0x61, 0x01, ESC, 0x61, 0x01]);           // ESC GS a 1 & ESC a 1 (Center)
const ALIGN_LEFT   = Buffer.from([ESC, 0x1D, 0x61, 0x00, ESC, 0x61, 0x00]);           // ESC GS a 0 & ESC a 0 (Left)
const CUT_PAPER    = Buffer.from([0x0A, 0x0A, ESC, 0x64, 0x02, GS, 0x56, 0x00, 0x0A]); // Star & ESC/POS Auto Cut

const RECEIPT_WIDTH = 42; // Standard 80mm thermal paper width (42 mono chars)

function line(text = "") {
  return Buffer.from(text.slice(0, RECEIPT_WIDTH) + "\n", "utf8");
}

function divider(char = "-") {
  return line(char.repeat(RECEIPT_WIDTH));
}

function twoCol(left, right, width = RECEIPT_WIDTH) {
  const r = String(right ?? "");
  const l = String(left ?? "").slice(0, width - r.length - 1);
  const space = Math.max(1, width - l.length - r.length);
  return line(l + " ".repeat(space) + r);
}

/**
 * Build full binary receipt buffer for Star TSP143 / TSP100 thermal printers
 */
export function buildReceipt(order) {
  const chunks = [];

  // Initialize printer
  chunks.push(INIT);
  chunks.push(ALIGN_CENTER);

  // Store Header (Double-wide & Double-high)
  chunks.push(DOUBLE_ON);
  chunks.push(line("RANI MAHAL"));
  chunks.push(DOUBLE_OFF);

  chunks.push(BOLD_ON);
  chunks.push(line("FINE INDIAN CUISINE"));
  chunks.push(BOLD_OFF);
  chunks.push(line("327 Mamaroneck Ave, NY 10543"));
  chunks.push(line("Tel: (914) 835-9066"));
  chunks.push(line("www.ranimahal.food"));

  chunks.push(divider("="));

  // Order Header
  chunks.push(BOLD_ON);
  const shortId = "#" + (order.id ? order.id.slice(-6).toUpperCase() : "------");
  chunks.push(line(`ORDER ${shortId}`));

  const isDelivery = order.orderMode === "delivery";
  chunks.push(DOUBLE_ON);
  chunks.push(line(isDelivery ? "*** DELIVERY ***" : "*** PICKUP ***"));
  chunks.push(DOUBLE_OFF);
  chunks.push(BOLD_OFF);

  chunks.push(divider("="));
  chunks.push(ALIGN_LEFT);

  // Order Metadata
  const time = new Date(order.createdAt || Date.now()).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
  chunks.push(twoCol("TIME:", time));
  chunks.push(twoCol("CUSTOMER:", (order.customerName || "Walk-in Guest").toUpperCase()));
  if (order.customerPhone) {
    chunks.push(twoCol("PHONE:", order.customerPhone));
  }

  // Delivery Address Section
  if (isDelivery && order.deliveryAddress) {
    chunks.push(divider("-"));
    chunks.push(BOLD_ON);
    chunks.push(line("DELIVER TO:"));
    chunks.push(BOLD_OFF);
    const addr = order.deliveryAddress;
    chunks.push(line(`${addr.street}${addr.apt ? ' Apt ' + addr.apt : ''}`));
    chunks.push(line(`${addr.city || 'Mamaroneck'}, NY ${addr.zip || ''}`));
    if (addr.notes) {
      chunks.push(BOLD_ON);
      chunks.push(line(`NOTE: ${addr.notes}`));
      chunks.push(BOLD_OFF);
    }
  }

  chunks.push(divider("-"));

  // Items Header
  chunks.push(BOLD_ON);
  chunks.push(twoCol("ITEM", "QTY   PRICE"));
  chunks.push(BOLD_OFF);
  chunks.push(divider("-"));

  // Item List
  (order.items || []).forEach(item => {
    const qty = `${item.qty}x`;
    const price = `$${(item.price * item.qty).toFixed(2)}`;
    
    // Item name in bold
    chunks.push(BOLD_ON);
    chunks.push(line(item.name.toUpperCase()));
    chunks.push(BOLD_OFF);

    // Spice & Price line
    const spiceStr = item.spice ? `  [SPICE: ${item.spice.toUpperCase()}]` : "  ";
    chunks.push(twoCol(spiceStr, `${qty.padStart(3)} ${price.padStart(8)}`));

    if (item.note) {
      chunks.push(line(`  * Note: ${item.note}`));
    }
  });

  chunks.push(divider("-"));

  // Financial Totals
  chunks.push(twoCol("Subtotal:", `$${(order.subtotal || 0).toFixed(2)}`));
  if (isDelivery) {
    chunks.push(twoCol("Delivery Fee:", (order.deliveryFee || 0) === 0 ? "FREE" : `$${order.deliveryFee.toFixed(2)}`));
  }
  chunks.push(twoCol("Tax (8.375%):", `$${(order.tax || 0).toFixed(2)}`));
  if (order.ccFee > 0) {
    chunks.push(twoCol("Processing Fee:", `$${order.ccFee.toFixed(2)}`));
  }

  chunks.push(divider("="));

  // Grand Total
  chunks.push(BOLD_ON);
  chunks.push(DOUBLE_ON);
  chunks.push(twoCol("TOTAL:", `$${(order.total || 0).toFixed(2)}`));
  chunks.push(DOUBLE_OFF);
  chunks.push(BOLD_OFF);

  chunks.push(twoCol("Payment:", "Stripe (PAID ONLINE)"));
  chunks.push(divider("="));

  // Special Kitchen Instructions
  if (order.specialInstructions) {
    chunks.push(BOLD_ON);
    chunks.push(line("SPECIAL INSTRUCTIONS:"));
    chunks.push(line(order.specialInstructions.toUpperCase()));
    chunks.push(BOLD_OFF);
    chunks.push(divider("="));
  }

  // Footer & Paper Cut
  chunks.push(ALIGN_CENTER);
  chunks.push(line("Thank you for dining with us!"));
  chunks.push(line("Order online at ranimahal.food"));
  chunks.push(Buffer.from([0x0A, 0x0A, 0x0A, 0x0A])); // Line feed 4 lines
  chunks.push(CUT_PAPER);

  return Buffer.concat(chunks);
}

/**
 * Build plain text receipt string (legacy fallback)
 */
export function buildPlainTextReceipt(order) {
  const shortId = order.id ? order.id.slice(-6).toUpperCase() : "------";
  const isDelivery = order.orderMode === "delivery";
  const lines = [];

  const W = 32;
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

  const time = new Date(order.createdAt || Date.now()).toLocaleString("en-US", {
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
  lines.push("\r\n\r\n\r\n\r\n");

  return lines.join("\r\n");
}
