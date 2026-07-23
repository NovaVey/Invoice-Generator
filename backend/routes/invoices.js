const express = require('express');
const pool = require('../db/pool');
const { generateInvoicePDF } = require('../services/pdfService');

const router = express.Router();

const VALID_STATUSES = ['draft', 'sent', 'paid', 'overdue'];

function toNumber(value) {
  return value === null || value === undefined ? value : Number(value);
}

function parseId(rawId) {
  if (!/^\d+$/.test(String(rawId))) return null;
  return Number(rawId);
}

async function getInvoiceDetail(queryable, id) {
  const invoiceResult = await queryable.query(
    `SELECT i.*, c.name AS client_name, c.email AS client_email,
            c.phone AS client_phone, c.address AS client_address
     FROM invoices i
     LEFT JOIN clients c ON c.id = i.client_id
     WHERE i.id = $1`,
    [id]
  );

  if (invoiceResult.rows.length === 0) return null;
  const row = invoiceResult.rows[0];

  const itemsResult = await queryable.query(
    `SELECT id, description, quantity, unit_price, line_total
     FROM invoice_items
     WHERE invoice_id = $1
     ORDER BY id ASC`,
    [id]
  );

  return {
    id: row.id,
    invoice_number: row.invoice_number,
    client_id: row.client_id,
    status: row.status,
    issue_date: row.issue_date,
    due_date: row.due_date,
    subtotal: toNumber(row.subtotal),
    tax_rate: toNumber(row.tax_rate),
    tax_amount: toNumber(row.tax_amount),
    total: toNumber(row.total),
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
    client: row.client_id
      ? {
          id: row.client_id,
          name: row.client_name,
          email: row.client_email,
          phone: row.client_phone,
          address: row.client_address,
        }
      : null,
    items: itemsResult.rows.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: toNumber(item.quantity),
      unit_price: toNumber(item.unit_price),
      line_total: toNumber(item.line_total),
    })),
  };
}

router.get('/', async (req, res, next) => {
  try {
    const { status } = req.query;

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'invalid status filter' });
    }

    const params = [];
    let where = '';
    if (status) {
      params.push(status);
      where = 'WHERE i.status = $1';
    }

    const result = await pool.query(
      `SELECT i.id, i.invoice_number, i.client_id, c.name AS client_name,
              i.status, i.issue_date, i.due_date, i.subtotal, i.tax_rate,
              i.tax_amount, i.total, i.notes, i.created_at, i.updated_at
       FROM invoices i
       LEFT JOIN clients c ON c.id = i.client_id
       ${where}
       ORDER BY i.created_at DESC`,
      params
    );

    const rows = result.rows.map((row) => ({
      ...row,
      subtotal: toNumber(row.subtotal),
      tax_rate: toNumber(row.tax_rate),
      tax_amount: toNumber(row.tax_amount),
      total: toNumber(row.total),
    }));

    res.status(200).json(rows);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) return res.status(404).json({ error: 'Invoice not found' });

    const invoice = await getInvoiceDetail(pool, id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    res.status(200).json(invoice);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  const { client_id, issue_date, due_date, tax_rate, notes, items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items is required and must be a non-empty array' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const now = new Date();
    const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `INV-${yyyymm}-`;

    const countResult = await client.query(
      `SELECT COUNT(*)::int AS count FROM invoices WHERE invoice_number LIKE $1`,
      [`${prefix}%`]
    );
    const sequence = countResult.rows[0].count + 1;
    const invoiceNumber = `${prefix}${String(sequence).padStart(4, '0')}`;

    const subtotal = items.reduce(
      (sum, item) => sum + Number(item.quantity) * Number(item.unit_price),
      0
    );
    const taxRate = tax_rate === undefined || tax_rate === null ? 0 : Number(tax_rate);
    const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
    const total = subtotal + taxAmount;

    const invoiceInsert = await client.query(
      `INSERT INTO invoices
         (invoice_number, client_id, status, issue_date, due_date, subtotal, tax_rate, tax_amount, total, notes)
       VALUES ($1, $2, 'draft', COALESCE($3::date, CURRENT_DATE), $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        invoiceNumber,
        client_id || null,
        issue_date || null,
        due_date || null,
        subtotal,
        taxRate,
        taxAmount,
        total,
        notes || null,
      ]
    );

    const invoiceId = invoiceInsert.rows[0].id;

    for (const item of items) {
      await client.query(
        `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price)
         VALUES ($1, $2, $3, $4)`,
        [invoiceId, item.description, item.quantity, item.unit_price]
      );
    }

    await client.query('COMMIT');

    const invoice = await getInvoiceDetail(client, invoiceId);
    res.status(201).json(invoice);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

router.patch('/:id/status', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) return res.status(404).json({ error: 'Invoice not found' });

    const { status } = req.body;
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'status must be one of draft|sent|paid|overdue' });
    }

    const updateResult = await pool.query(
      `UPDATE invoices SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id`,
      [status, id]
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const invoice = await getInvoiceDetail(pool, id);
    res.status(200).json(invoice);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) return res.status(404).json({ error: 'Invoice not found' });

    const result = await pool.query('DELETE FROM invoices WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.get('/:id/pdf', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) return res.status(404).json({ error: 'Invoice not found' });

    const invoice = await getInvoiceDetail(pool, id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const pdfInvoice = {
      invoice_number: invoice.invoice_number,
      issue_date: invoice.issue_date,
      due_date: invoice.due_date,
      status: invoice.status,
      notes: invoice.notes,
      subtotal: invoice.subtotal,
      tax_rate: invoice.tax_rate,
      tax_amount: invoice.tax_amount,
      total: invoice.total,
      client: {
        name: invoice.client ? invoice.client.name : null,
        email: invoice.client ? invoice.client.email : null,
        address: invoice.client ? invoice.client.address : null,
      },
      items: invoice.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        line_total: item.line_total,
      })),
    };

    const buffer = await generateInvoicePDF(pdfInvoice);

    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="${invoice.invoice_number}.pdf"`);
    res.status(200).send(buffer);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
