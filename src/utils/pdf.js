import { fmtPrice, slugify } from "./helpers";

// Fetches an image and converts it to a base64 data URL, since jsPDF's addImage() needs the
// actual image data in-hand rather than a URL it can fetch itself.
async function loadImageAsDataURL(url) {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Draws the logo, large and very faint, centered on the page and behind everything else --
// must be called before any other content is drawn, since jsPDF layers draw calls in the order
// they're issued (nothing drawn after this can be "under" it, only on top).
function drawWatermark(doc, logoDataUrl, W, H) {
  if (!logoDataUrl) return;
  const size = Math.min(W, H) * 0.6;
  doc.saveGraphicsState();
  doc.setGState(new doc.GState({ opacity: 0.06 }));
  doc.addImage(logoDataUrl, "PNG", (W - size) / 2, (H - size) / 2, size, size);
  doc.restoreGraphicsState();
}

// A small, crisp logo mark for the header — full opacity, fixed size, top-left aligned like a
// letterhead.
function drawHeaderLogo(doc, logoDataUrl, x, y, size = 34) {
  if (!logoDataUrl) return 0;
  doc.addImage(logoDataUrl, "PNG", x, y, size, size);
  return size;
}

const LOGO_URL = "/logo-mark.png";

// Shared header + footer, used by every customer-facing document this app generates (invoices,
// receipts, quotations, and any future document type) so they can't silently drift apart in
// layout -- a fix or tweak made here applies everywhere at once, rather than needing to be
// re-applied by hand across several near-duplicate drawing functions the way this file used to
// work before this round.
//
//   docType: "INVOICE" | "RECEIPT" | "QUOTATION" (or any future short, all-caps document title)
//   docNumber: string, issueDate: "YYYY-MM-DD" string, dueDate: "YYYY-MM-DD" string (optional --
//     invoices with payment terms use this; a receipt confirming an already-completed payment or
//     a quotation don't)
//   business: { name, address, email, phone, website, taxId, bankDetails } -- every field
//     optional; a document simply omits whichever aren't set rather than printing an empty line
//     or a fabricated placeholder. Real values come from admin-editable Settings
//     (server/src/routes/settings.js's businessName/businessAddress/etc.), never invented here.
// Returns the y-coordinate directly below the header's divider line, so the caller knows where
// its own body content can safely start.
function drawDocumentHeader(doc, { W, margin, logoDataUrl, business, docType, docNumber, issueDate, dueDate }) {
  let y = margin;
  const businessName = business.name || "MORNING AROMA";

  const logoSize = 34;
  drawHeaderLogo(doc, logoDataUrl, margin, y - 24, logoSize);
  const textX = logoDataUrl ? margin + logoSize + 12 : margin;

  // The business name is admin-configurable and can run much longer than the original "Morning
  // Aroma" default -- reserve space for the right-aligned doc-type/number/date block and shrink
  // the name's font size (down to a floor) rather than let a long name run into it. If it still
  // doesn't fit even at the floor size, wrap onto a second line instead of overlapping.
  const docBlockWidth = 150;
  const maxNameWidth = W - margin - textX - docBlockWidth;
  const nameUpper = businessName.toUpperCase();
  doc.setFont("helvetica", "bold");
  let nameFontSize = 20;
  while (nameFontSize > 12 && doc.setFontSize(nameFontSize).getTextWidth(nameUpper) > maxNameWidth) {
    nameFontSize -= 1;
  }
  doc.setFontSize(nameFontSize);
  const nameLines = doc.getTextWidth(nameUpper) > maxNameWidth ? doc.splitTextToSize(nameUpper, maxNameWidth) : [nameUpper];
  doc.setTextColor(62, 44, 35);
  doc.text(nameLines, textX, y);
  const nameExtraLineHeight = (nameLines.length - 1) * (nameFontSize * 1.15);

  doc.setFont("helvetica", "italic");
  doc.setFontSize(10);
  doc.setTextColor(139, 90, 58);
  doc.text("Where quality meets its scent.", textX, y + 16 + nameExtraLineHeight);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(62, 44, 35);
  doc.text(docType, W - margin, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 80, 65);
  let metaY = y + 16;
  doc.text(`No. ${docNumber}`, W - margin, metaY, { align: "right" });
  metaY += 14;
  doc.text(`Date: ${issueDate}`, W - margin, metaY, { align: "right" });
  if (dueDate) {
    metaY += 14;
    doc.text(`Due: ${dueDate}`, W - margin, metaY, { align: "right" });
  }

  y += 60 + nameExtraLineHeight + (dueDate ? 14 : 0);
  doc.setDrawColor(232, 213, 181);
  doc.setLineWidth(1);
  doc.line(margin, y, W - margin, y);

  return y;
}

// Draws directly at the bottom margin of the CURRENT page -- callers with real multi-page content
// (generateLessonPDF, or a long enough invoice/quotation line-item table) call this once per page,
// passing that page's own 1-based index and the total page count once known. pageNum/totalPages
// are both optional -- a genuinely single-page document can omit them and this simply won't print
// a page-number line, rather than always claiming "Page 1 of 1". showBankDetails defaults to true
// (an unpaid invoice is exactly where a customer needs payment instructions) but a quotation
// explicitly opts out -- nothing is being paid yet, so printing bank details there would
// misleadingly suggest otherwise, directly contradicting the "not an invoice" note already on
// that document.
function drawDocumentFooter(doc, { W, H, margin, logoDataUrl, business, pageNum, totalPages, showBankDetails = true }) {
  const businessName = business.name || "MORNING AROMA";
  const footerLines = [businessName];
  if (business.address) footerLines.push(business.address);
  if (business.phone) footerLines.push(business.phone);
  if (business.email) footerLines.push(business.email);
  if (business.website) footerLines.push(business.website);
  if (business.taxId) footerLines.push(`Tax ID: ${business.taxId}`);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(180, 160, 140);
  const footerLogoSize = drawHeaderLogo(doc, logoDataUrl, margin, H - margin - 12, 14) ? 14 + 8 : 0;
  const footerTextX = margin + footerLogoSize;
  const footerTextWidth = W - margin * 2 - footerLogoSize - (pageNum ? 70 : 0);
  const footerText = footerLines.join("  ·  ");
  // Wraps rather than overflows off the page edge if the combined business details run long --
  // real business names/addresses/bank details can genuinely be longer than the original 4-field
  // footer this was designed around.
  const wrapped = doc.getTextWidth(footerText) > footerTextWidth ? doc.splitTextToSize(footerText, footerTextWidth) : [footerText];
  doc.text(wrapped, footerTextX, H - margin);

  // Bank details get their own line above the main footer strip, only when set -- kept visually
  // distinct (its own row) rather than folded into the same dot-separated line as the rest, since
  // it's meaningfully more important on an unpaid invoice than a phone number or tax ID.
  if (business.bankDetails && showBankDetails) {
    doc.setFontSize(8);
    doc.setTextColor(139, 90, 58);
    const bankLines = doc.splitTextToSize(`Payment details: ${business.bankDetails}`, W - margin * 2);
    doc.text(bankLines, margin, H - margin - 14 - (bankLines.length - 1) * 10);
  }

  if (pageNum && totalPages) {
    doc.setFontSize(8.5);
    doc.setTextColor(180, 160, 140);
    doc.text(`Page ${pageNum} of ${totalPages}`, W - margin, H - margin, { align: "right" });
  }
}

// Generates a downloadable PDF invoice from a normalized shape, so any source (a customer order,
// a green-coffee wholesale order, or a paid consultation) can produce one through the same
// function rather than three separate PDF layouts to maintain.
//   invoiceNumber: string, date: "YYYY-MM-DD" string
//   billTo: { name, email, company? }
//   lineItems: [{ description, qty, unitPriceCents, totalCents }]
//   totalCents: number (pre-tax subtotal)
//   notes: string (optional)
//   business: { name, address, taxId, taxRatePercent, invoiceNotes } (optional — falls back to
//     generic Morning Aroma defaults if not provided, so existing callers don't break)
export async function generateInvoicePDF({ invoiceNumber, date, dueDate, billTo, lineItems, totalCents, notes, business = {} }) {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = 612, H = 792, margin = 50;

  const logoDataUrl = await loadImageAsDataURL(LOGO_URL).catch(() => null);

  const taxRatePercent = business.taxRatePercent || 0;
  const taxCents = Math.round(totalCents * (taxRatePercent / 100));
  const grandTotalCents = totalCents + taxCents;

  // A dedicated due date beats defaulting to invoiceNotes' free-text payment terms (e.g. "due
  // within 14 days") for the header itself -- computed from that same note only when the caller
  // hasn't already supplied a real due date, so an existing order/service invoice caller with no
  // concept of "days from now" still gets an honest header (no due date shown at all) rather than
  // a wrong or guessed one.
  const drawPage = (isFirstPage) => {
    doc.setFillColor(253, 248, 240);
    doc.rect(0, 0, W, H, "F");
    drawWatermark(doc, logoDataUrl, W, H);
  };

  drawPage(true);
  let y = drawDocumentHeader(doc, {
    W, margin, logoDataUrl, business, docType: "INVOICE",
    docNumber: invoiceNumber, issueDate: date, dueDate,
  });

  y += 30;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(139, 90, 58);
  doc.text("BILL TO", margin, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(62, 44, 35);
  doc.text(billTo.name || "—", margin, y);
  if (billTo.company) { y += 15; doc.text(billTo.company, margin, y); }
  if (billTo.email && billTo.email !== billTo.name) {
    y += 15;
    doc.setTextColor(100, 80, 65);
    doc.setFontSize(10);
    doc.text(billTo.email, margin, y);
  }

  y += 34;
  doc.setFillColor(253, 248, 240);
  doc.rect(margin, y, W - margin * 2, 22, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(139, 90, 58);
  doc.text("DESCRIPTION", margin + 8, y + 15);
  doc.text("QTY", W - margin - 190, y + 15, { align: "right" });
  doc.text("UNIT PRICE", W - margin - 100, y + 15, { align: "right" });
  doc.text("TOTAL", W - margin - 8, y + 15, { align: "right" });
  y += 22;

  // Real pagination -- a genuinely long line-item list (a large wholesale order, dozens of
  // products) can run past one page; previously this had none at all, silently letting text run
  // off the bottom of the page with no visual sign anything was cut off. Tracks how many pages
  // get used so the footer's "Page X of Y" can be filled in accurately once known, then makes a
  // second pass to actually stamp every page's footer -- jsPDF doesn't support drawing on a page
  // that's already been advanced past without switching back to it via setPage().
  const bottomLimit = H - margin - 70; // leaves room for totals/notes/footer on the last page
  let pageCount = 1;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(62, 44, 35);
  lineItems.forEach((item) => {
    const lines = doc.splitTextToSize(item.description, 260);
    const rowHeight = 22 + Math.max(0, lines.length - 1) * 13;
    if (y + rowHeight > bottomLimit) {
      doc.addPage();
      pageCount += 1;
      drawPage(false);
      y = margin;
    }
    y += 22;
    doc.text(lines, margin + 8, y);
    doc.text(String(item.qty), W - margin - 190, y, { align: "right" });
    doc.text(fmtPrice(item.unitPriceCents), W - margin - 100, y, { align: "right" });
    doc.text(fmtPrice(item.totalCents), W - margin - 8, y, { align: "right" });
    y += Math.max(0, (lines.length - 1)) * 13;
  });

  y += 20;
  doc.setDrawColor(232, 213, 181);
  doc.line(margin, y, W - margin, y);
  y += 24;

  if (taxRatePercent > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(100, 80, 65);
    doc.text("Subtotal", W - margin - 100, y, { align: "right" });
    doc.text(fmtPrice(totalCents), W - margin - 8, y, { align: "right" });
    y += 16;
    doc.text(`Tax (${taxRatePercent}%)`, W - margin - 100, y, { align: "right" });
    doc.text(fmtPrice(taxCents), W - margin - 8, y, { align: "right" });
    y += 20;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(62, 44, 35);
  doc.text("TOTAL", W - margin - 100, y, { align: "right" });
  doc.text(fmtPrice(grandTotalCents), W - margin - 8, y, { align: "right" });

  const finalNotes = notes || business.invoiceNotes;
  if (finalNotes) {
    y += 40;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9.5);
    doc.setTextColor(100, 80, 65);
    const noteLines = doc.splitTextToSize(finalNotes, W - margin * 2);
    doc.text(noteLines, margin, y);
  }

  // Second pass: now that pageCount is known, stamp every page's footer (page 1 was already
  // drawn once above with jsPDF's implicit "current page" -- setPage() revisits it along with
  // every subsequent page added since).
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    drawDocumentFooter(doc, { W, H, margin, logoDataUrl, business, pageNum: p, totalPages: pageCount });
  }

  doc.save(`invoice-${invoiceNumber}.pdf`);
}

// A real, distinct document from an invoice -- confirms a payment that has ALREADY been made
// (an invoice requests payment; this is proof one was received), so it deliberately has no due
// date, no unpaid-balance framing, and the total is always labeled "Amount Paid," not "Total."
// Shares the exact same header/footer as every other document type here -- see
// drawDocumentHeader/drawDocumentFooter above.
//   receiptNumber: string, date: "YYYY-MM-DD", paymentMethod: string (e.g. "Paystack"),
//   paidTo/billTo: same shape as generateInvoicePDF's billTo
export async function generateReceiptPDF({ receiptNumber, date, paymentMethod, billTo, lineItems, totalCents, business = {} }) {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = 612, H = 792, margin = 50;

  const logoDataUrl = await loadImageAsDataURL(LOGO_URL).catch(() => null);

  doc.setFillColor(253, 248, 240);
  doc.rect(0, 0, W, H, "F");
  drawWatermark(doc, logoDataUrl, W, H);

  let y = drawDocumentHeader(doc, {
    W, margin, logoDataUrl, business, docType: "RECEIPT",
    docNumber: receiptNumber, issueDate: date,
  });

  y += 30;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(139, 90, 58);
  doc.text("RECEIVED FROM", margin, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(62, 44, 35);
  doc.text(billTo.name || "—", margin, y);
  if (billTo.company) { y += 15; doc.text(billTo.company, margin, y); }
  if (billTo.email && billTo.email !== billTo.name) {
    y += 15;
    doc.setTextColor(100, 80, 65);
    doc.setFontSize(10);
    doc.text(billTo.email, margin, y);
  }
  if (paymentMethod) {
    y += 15;
    doc.setTextColor(100, 80, 65);
    doc.setFontSize(10);
    doc.text(`Payment method: ${paymentMethod}`, margin, y);
  }

  y += 34;
  doc.setFillColor(253, 248, 240);
  doc.rect(margin, y, W - margin * 2, 22, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(139, 90, 58);
  doc.text("DESCRIPTION", margin + 8, y + 15);
  doc.text("QTY", W - margin - 190, y + 15, { align: "right" });
  doc.text("UNIT PRICE", W - margin - 100, y + 15, { align: "right" });
  doc.text("TOTAL", W - margin - 8, y + 15, { align: "right" });
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(62, 44, 35);
  lineItems.forEach((item) => {
    y += 22;
    const lines = doc.splitTextToSize(item.description, 260);
    doc.text(lines, margin + 8, y);
    doc.text(String(item.qty), W - margin - 190, y, { align: "right" });
    doc.text(fmtPrice(item.unitPriceCents), W - margin - 100, y, { align: "right" });
    doc.text(fmtPrice(item.totalCents), W - margin - 8, y, { align: "right" });
    y += Math.max(0, (lines.length - 1)) * 13;
  });

  y += 20;
  doc.setDrawColor(232, 213, 181);
  doc.line(margin, y, W - margin, y);
  y += 24;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(62, 44, 35);
  doc.text("AMOUNT PAID", W - margin - 130, y, { align: "right" });
  doc.text(fmtPrice(totalCents), W - margin - 8, y, { align: "right" });

  y += 26;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9.5);
  doc.setTextColor(100, 80, 65);
  doc.text("Payment received in full — thank you for your order.", margin, y);

  drawDocumentFooter(doc, { W, H, margin, logoDataUrl, business });
  doc.save(`receipt-${receiptNumber}.pdf`);
}

// A response to a real "Request a Quotation" submission (see Services.jsx's wholesale form and
// addQuotation) -- previously this flow had no generated document at all, just the raw request
// sitting in Admin for someone to follow up on by hand. Deliberately time-bound (validUntil),
// since a quoted price is never open-ended, and every line total is explicitly "Estimated" rather
// than "Total," since nothing has actually been ordered or paid yet.
//   quotationNumber: string, date/validUntil: "YYYY-MM-DD", quotedTo: same shape as billTo
export async function generateQuotationPDF({ quotationNumber, date, validUntil, quotedTo, lineItems, totalCents, notes, business = {} }) {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = 612, H = 792, margin = 50;

  const logoDataUrl = await loadImageAsDataURL(LOGO_URL).catch(() => null);

  doc.setFillColor(253, 248, 240);
  doc.rect(0, 0, W, H, "F");
  drawWatermark(doc, logoDataUrl, W, H);

  let y = drawDocumentHeader(doc, {
    W, margin, logoDataUrl, business, docType: "QUOTATION",
    docNumber: quotationNumber, issueDate: date,
  });

  y += 30;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(139, 90, 58);
  doc.text("PREPARED FOR", margin, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(62, 44, 35);
  doc.text(quotedTo.name || "—", margin, y);
  if (quotedTo.company) { y += 15; doc.text(quotedTo.company, margin, y); }
  if (quotedTo.email && quotedTo.email !== quotedTo.name) {
    y += 15;
    doc.setTextColor(100, 80, 65);
    doc.setFontSize(10);
    doc.text(quotedTo.email, margin, y);
  }

  if (validUntil) {
    y += 15;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(139, 90, 58);
    doc.text(`Valid until ${validUntil}`, margin, y);
  }

  y += 30;
  doc.setFillColor(253, 248, 240);
  doc.rect(margin, y, W - margin * 2, 22, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(139, 90, 58);
  doc.text("DESCRIPTION", margin + 8, y + 15);
  doc.text("QTY", W - margin - 190, y + 15, { align: "right" });
  doc.text("EST. UNIT PRICE", W - margin - 100, y + 15, { align: "right" });
  doc.text("EST. TOTAL", W - margin - 8, y + 15, { align: "right" });
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(62, 44, 35);
  lineItems.forEach((item) => {
    y += 22;
    const lines = doc.splitTextToSize(item.description, 260);
    doc.text(lines, margin + 8, y);
    doc.text(String(item.qty), W - margin - 190, y, { align: "right" });
    doc.text(fmtPrice(item.unitPriceCents), W - margin - 100, y, { align: "right" });
    doc.text(fmtPrice(item.totalCents), W - margin - 8, y, { align: "right" });
    y += Math.max(0, (lines.length - 1)) * 13;
  });

  y += 20;
  doc.setDrawColor(232, 213, 181);
  doc.line(margin, y, W - margin, y);
  y += 24;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(62, 44, 35);
  doc.text("ESTIMATED TOTAL", W - margin - 160, y, { align: "right" });
  doc.text(fmtPrice(totalCents), W - margin - 8, y, { align: "right" });

  const finalNotes = notes || "Final pricing may vary based on confirmed quantity, delivery terms, and current availability at time of order. This quotation is not an invoice and does not constitute a binding order.";
  y += 34;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9.5);
  doc.setTextColor(100, 80, 65);
  const noteLines = doc.splitTextToSize(finalNotes, W - margin * 2);
  doc.text(noteLines, margin, y);

  drawDocumentFooter(doc, { W, H, margin, logoDataUrl, business, showBankDetails: false });
  doc.save(`quotation-${quotationNumber}.pdf`);
}

export async function generateRecipeCardPDF(course, recipe) {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: [420, 580] });
  const W = 420, H = 580, margin = 24;

  const logoDataUrl = await loadImageAsDataURL(LOGO_URL).catch(() => null);

  // background + border
  doc.setFillColor(253, 248, 240);
  doc.rect(0, 0, W, H, "F");
  drawWatermark(doc, logoDataUrl, W, H);
  doc.setDrawColor(139, 90, 58);
  doc.setLineWidth(1.5);
  doc.rect(margin, margin, W - margin * 2, H - margin * 2);
  doc.setDrawColor(232, 213, 181);
  doc.setLineWidth(0.75);
  doc.rect(margin + 6, margin + 6, W - (margin + 6) * 2, H - (margin + 6) * 2);

  let y = margin + 40;
  if (logoDataUrl) {
    const logoSize = 26;
    doc.addImage(logoDataUrl, "PNG", (W - logoSize) / 2, y - logoSize + 4, logoSize, logoSize);
    y += 14;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(197, 161, 129);
  doc.text("MORNING AROMA", W / 2, y, { align: "center" });

  y += 26;
  doc.setFontSize(22);
  doc.setTextColor(62, 44, 35);
  doc.text(course.name, W / 2, y, { align: "center" });

  y += 18;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(10.5);
  doc.setTextColor(139, 90, 58);
  doc.text("Recipe Card", W / 2, y, { align: "center" });

  y += 30;
  doc.setDrawColor(232, 213, 181);
  doc.line(margin + 30, y, W - margin - 30, y);

  y += 24;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(139, 90, 58);
  doc.text("RATIO", margin + 30, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(62, 44, 35);
  doc.text(recipe.ratio, margin + 30, y + 16);

  y += 44;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(139, 90, 58);
  doc.text("INGREDIENTS", margin + 30, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(62, 44, 35);
  recipe.ingredients.forEach((ing, i) => {
    doc.text(`•  ${ing}`, margin + 30, y + 18 + i * 15);
  });

  y += 18 + recipe.ingredients.length * 15 + 22;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(139, 90, 58);
  doc.text("METHOD", margin + 30, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(62, 44, 35);
  let stepY = y + 20;
  recipe.steps.forEach((step, i) => {
    const lines = doc.splitTextToSize(`${i + 1}.  ${step}`, W - margin * 2 - 60);
    doc.text(lines, margin + 30, stepY);
    stepY += lines.length * 14 + 6;
  });

  if (logoDataUrl) {
    const footerLogoSize = 18;
    doc.addImage(logoDataUrl, "PNG", (W - footerLogoSize) / 2, H - margin - 44, footerLogoSize, footerLogoSize);
  }
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(197, 161, 129);
  doc.text("Where quality meets its scent.", W / 2, H - margin - 20, { align: "center" });

  doc.save(`${slugify(course.name)}-recipe-card.pdf`);
}

// A real, verifiable certificate -- landscape format, matching the design convention certificates
// generally use. Everything printed on it (student name, course, date, code) comes from the real
// certificate record the backend issued (see server/src/routes/certificates.js), not anything the
// browser made up -- the verification_code specifically is what lets anyone confirm this is
// genuine via /certificates/verify/:code, independent of the PDF file itself.
export async function generateCertificatePDF(certificate) {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter", orientation: "landscape" });
  const W = 792, H = 612, margin = 40;

  const logoDataUrl = await loadImageAsDataURL(LOGO_URL).catch(() => null);

  doc.setFillColor(253, 248, 240);
  doc.rect(0, 0, W, H, "F");
  drawWatermark(doc, logoDataUrl, W, H);
  doc.setDrawColor(139, 90, 58);
  doc.setLineWidth(2);
  doc.rect(margin, margin, W - margin * 2, H - margin * 2);
  doc.setDrawColor(232, 213, 181);
  doc.setLineWidth(1);
  doc.rect(margin + 8, margin + 8, W - (margin + 8) * 2, H - (margin + 8) * 2);

  let y = margin + 56;
  if (logoDataUrl) {
    const logoSize = 40;
    doc.addImage(logoDataUrl, "PNG", (W - logoSize) / 2, y - logoSize + 6, logoSize, logoSize);
    y += 20;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(197, 161, 129);
  doc.text("MORNING AROMA ACADEMY", W / 2, y, { align: "center" });

  y += 36;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(15);
  doc.setTextColor(139, 90, 58);
  doc.text("Certificate of Completion", W / 2, y, { align: "center" });

  y += 50;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(62, 44, 35);
  doc.text("This certifies that", W / 2, y, { align: "center" });

  y += 42;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(62, 44, 35);
  doc.text(certificate.studentName, W / 2, y, { align: "center" });

  y += 36;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(62, 44, 35);
  doc.text("has successfully completed", W / 2, y, { align: "center" });

  y += 30;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(139, 90, 58);
  doc.text(certificate.courseName, W / 2, y, { align: "center" });

  const dateStr = new Date(certificate.issuedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  y = H - margin - 56;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(139, 90, 58);
  doc.text(`Issued ${dateStr}`, margin + 30, y);
  doc.text(`Verification code: ${certificate.verificationCode}`, W - margin - 30, y, { align: "right" });
  doc.setFontSize(8);
  doc.setTextColor(197, 161, 129);
  doc.text("Verify at morning-aroma.com/verify-certificate", W / 2, H - margin - 20, { align: "center" });

  doc.save(`${slugify(certificate.courseName)}-certificate.pdf`);
}

// A real, downloadable PDF for one lesson's full content -- unlike the recipe card and
// certificate above, lesson content can genuinely run to multiple pages, so this handles real
// pagination: each paragraph is measured and wrapped, and a new page starts automatically once
// the current one runs out of room, rather than assuming everything fits on a single page.
export async function generateLessonPDF(course, chapter, content) {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = 612, H = 792, margin = 56;
  const contentWidth = W - margin * 2;

  const logoDataUrl = await loadImageAsDataURL(LOGO_URL).catch(() => null);

  const drawPageChrome = () => {
    doc.setFillColor(253, 248, 240);
    doc.rect(0, 0, W, H, "F");
    drawWatermark(doc, logoDataUrl, W, H);
  };

  drawPageChrome();
  let y = margin;
  const headerLogoSize = drawHeaderLogo(doc, logoDataUrl, margin, y, 22);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(197, 161, 129);
  doc.text("MORNING AROMA ACADEMY", margin + headerLogoSize + 10, y + 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(139, 90, 58);
  doc.text(course.name, W - margin, y + 16, { align: "right" });

  y += 50;
  doc.setDrawColor(232, 213, 181);
  doc.setLineWidth(0.75);
  doc.line(margin, y, W - margin, y);

  y += 34;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(62, 44, 35);
  const titleLines = doc.splitTextToSize(chapter.title, contentWidth);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 26 + 24;

  // Real pagination -- paragraphs are split on blank lines (matching how the content was
  // written), each wrapped to the page width, and a fresh page starts whenever the next line
  // would run past the bottom margin, rather than letting text run off the page.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11.5);
  doc.setTextColor(62, 44, 35);
  const lineHeight = 17;
  const paragraphs = content.split(/\n\n+/);

  const ensureRoom = (neededHeight) => {
    if (y + neededHeight > H - margin - 30) {
      doc.addPage();
      drawPageChrome();
      y = margin;
    }
  };

  paragraphs.forEach((para) => {
    const lines = doc.splitTextToSize(para.trim(), contentWidth);
    ensureRoom(lines.length * lineHeight);
    doc.text(lines, margin, y);
    y += lines.length * lineHeight + 16;
  });

  // Footer on the final page only -- matches the recipe card / certificate sign-off style.
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(197, 161, 129);
  doc.text("Where quality meets its scent.", W / 2, H - margin + 10, { align: "center" });

  doc.save(`${slugify(course.name)}-lesson-${chapter.number}.pdf`);
}
