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
export async function generateInvoicePDF({ invoiceNumber, date, billTo, lineItems, totalCents, notes, business = {} }) {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = 612, H = 792, margin = 50;
  let y = margin;

  const logoDataUrl = await loadImageAsDataURL(LOGO_URL).catch(() => null);

  const businessName = business.name || "MORNING AROMA";
  const businessAddress = business.address || "";
  const businessEmail = business.email || "";
  const taxId = business.taxId || "";
  const taxRatePercent = business.taxRatePercent || 0;
  const taxCents = Math.round(totalCents * (taxRatePercent / 100));
  const grandTotalCents = totalCents + taxCents;

  drawWatermark(doc, logoDataUrl, W, H);

  const logoSize = 34;
  drawHeaderLogo(doc, logoDataUrl, margin, y - 24, logoSize);
  const textX = logoDataUrl ? margin + logoSize + 12 : margin;

  // The business name is admin-configurable (Settings) and can run much longer than the original
  // "Morning Aroma" default -- reserve space for the right-aligned INVOICE/number/date block and
  // shrink the name's font size (down to a floor) rather than let a long name run into it. If it
  // still doesn't fit even at the floor size, wrap onto a second line instead of overlapping.
  const invoiceBlockWidth = 130;
  const maxNameWidth = W - margin - textX - invoiceBlockWidth;
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
  doc.text("INVOICE", W - margin, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 80, 65);
  doc.text(`No. ${invoiceNumber}`, W - margin, y + 16, { align: "right" });
  doc.text(`Date: ${date}`, W - margin, y + 30, { align: "right" });

  y += 60 + nameExtraLineHeight;
  doc.setDrawColor(232, 213, 181);
  doc.setLineWidth(1);
  doc.line(margin, y, W - margin, y);

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

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(180, 160, 140);
  const footerLines = [businessName];
  if (businessAddress) footerLines.push(businessAddress);
  if (taxId) footerLines.push(`Tax ID: ${taxId}`);
  if (businessEmail) footerLines.push(businessEmail);
  const footerTextX = drawHeaderLogo(doc, logoDataUrl, margin, H - margin - 12, 14) ? margin + 14 + 8 : margin;
  doc.text(footerLines.join("  ·  "), footerTextX, H - margin);

  doc.save(`invoice-${invoiceNumber}.pdf`);
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
