const PDFDocument = require('pdfkit');

const PAGE_MARGIN = 50;
const BOTTOM_LIMIT = 750;

function formatCurrency(amount) {
  return `$${Number(amount).toFixed(2)}`;
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function capitalize(value) {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function ensureSpace(doc, y, needed = 20) {
  if (y + needed > BOTTOM_LIMIT) {
    doc.addPage();
    return PAGE_MARGIN;
  }
  return y;
}

function drawHeader(doc, invoice) {
  doc
    .font('Helvetica-Bold')
    .fontSize(28)
    .text('INVOICE', PAGE_MARGIN, PAGE_MARGIN, { align: 'right' });

  doc
    .font('Helvetica')
    .fontSize(10)
    .text('Nova Vey Engineering', PAGE_MARGIN, doc.y + 2, { align: 'right' });

  let y = doc.y + 20;

  doc.font('Helvetica-Bold').fontSize(11).text(invoice.invoice_number, PAGE_MARGIN, y);
  y = doc.y + 4;

  doc.font('Helvetica').fontSize(10);
  doc.text(`Issue Date: ${formatDate(invoice.issue_date)}`, PAGE_MARGIN, y);
  y = doc.y + 2;
  doc.text(`Due Date: ${formatDate(invoice.due_date)}`, PAGE_MARGIN, y);
  y = doc.y + 2;
  doc.text(`Status: ${capitalize(invoice.status)}`, PAGE_MARGIN, y);

  return doc.y + 20;
}

function drawBillTo(doc, client, y) {
  doc.font('Helvetica-Bold').fontSize(11).text('Bill To', PAGE_MARGIN, y);
  y = doc.y + 4;

  doc.font('Helvetica').fontSize(10);

  if (client && client.name) {
    doc.text(client.name, PAGE_MARGIN, y);
    y = doc.y + 2;
  }
  if (client && client.email) {
    doc.text(client.email, PAGE_MARGIN, y);
    y = doc.y + 2;
  }
  if (client && client.address) {
    doc.text(client.address, PAGE_MARGIN, y, { width: 300 });
    y = doc.y + 2;
  }

  return y + 15;
}

function drawTableHeader(doc, y) {
  const descX = PAGE_MARGIN;
  const qtyX = 320;
  const priceX = 390;
  const totalX = 470;
  const rightEdge = 545;

  doc.font('Helvetica-Bold').fontSize(10);
  doc.text('Description', descX, y);
  doc.text('Qty', qtyX, y, { width: 50, align: 'right' });
  doc.text('Unit Price', priceX, y, { width: 60, align: 'right' });
  doc.text('Total', totalX, y, { width: rightEdge - totalX, align: 'right' });

  y = doc.y + 4;
  doc
    .moveTo(PAGE_MARGIN, y)
    .lineTo(rightEdge, y)
    .lineWidth(1)
    .strokeColor('#000000')
    .stroke();

  return y + 8;
}

function drawItemsTable(doc, items, y) {
  const descX = PAGE_MARGIN;
  const qtyX = 320;
  const priceX = 390;
  const totalX = 470;
  const rightEdge = 545;

  y = ensureSpace(doc, y, 30);
  y = drawTableHeader(doc, y);

  doc.font('Helvetica').fontSize(10);

  items.forEach((item) => {
    y = ensureSpace(doc, y, 24);

    const rowTop = y;
    doc.text(item.description || '', descX, rowTop, { width: qtyX - descX - 10 });
    const descHeight = doc.heightOfString(item.description || '', {
      width: qtyX - descX - 10,
    });

    doc.text(String(item.quantity), qtyX, rowTop, { width: 50, align: 'right' });
    doc.text(formatCurrency(item.unit_price), priceX, rowTop, { width: 60, align: 'right' });
    doc.text(formatCurrency(item.line_total), totalX, rowTop, {
      width: rightEdge - totalX,
      align: 'right',
    });

    y = rowTop + Math.max(descHeight, 14) + 8;
  });

  y = ensureSpace(doc, y, 15);
  doc
    .moveTo(PAGE_MARGIN, y)
    .lineTo(rightEdge, y)
    .lineWidth(1)
    .strokeColor('#000000')
    .stroke();

  return y + 15;
}

function drawTotals(doc, invoice, y) {
  const labelX = 380;
  const valueX = 470;
  const rightEdge = 545;

  y = ensureSpace(doc, y, 60);

  doc.font('Helvetica').fontSize(10);
  doc.text('Subtotal', labelX, y, { width: valueX - labelX, align: 'left' });
  doc.text(formatCurrency(invoice.subtotal), valueX, y, {
    width: rightEdge - valueX,
    align: 'right',
  });
  y = doc.y + 4;

  if (invoice.tax_amount > 0) {
    y = ensureSpace(doc, y, 20);
    doc.text(`Tax (${invoice.tax_rate}%)`, labelX, y, { width: valueX - labelX, align: 'left' });
    doc.text(formatCurrency(invoice.tax_amount), valueX, y, {
      width: rightEdge - valueX,
      align: 'right',
    });
    y = doc.y + 4;
  }

  y = ensureSpace(doc, y, 20);
  doc.font('Helvetica-Bold').fontSize(11);
  doc.text('Total', labelX, y, { width: valueX - labelX, align: 'left' });
  doc.text(formatCurrency(invoice.total), valueX, y, {
    width: rightEdge - valueX,
    align: 'right',
  });

  return doc.y + 25;
}

function drawNotes(doc, notes, y) {
  if (!notes || !String(notes).trim()) return;

  y = ensureSpace(doc, y, 40);

  doc.font('Helvetica-Bold').fontSize(11).text('Notes', PAGE_MARGIN, y);
  y = doc.y + 4;

  doc.font('Helvetica').fontSize(10).text(String(notes), PAGE_MARGIN, y, {
    width: 495,
  });
}

function generateInvoicePDF(invoice) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: PAGE_MARGIN, size: 'A4' });
      const chunks = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      let y = drawHeader(doc, invoice);
      y = drawBillTo(doc, invoice.client, y);
      y = drawItemsTable(doc, invoice.items || [], y);
      y = drawTotals(doc, invoice, y);
      drawNotes(doc, invoice.notes, y);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateInvoicePDF };
