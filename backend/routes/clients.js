const express = require('express');
const pool = require('../db/pool');

const router = express.Router();

function parseId(rawId) {
  if (!/^\d+$/.test(String(rawId))) return null;
  return Number(rawId);
}

router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM clients ORDER BY name ASC');
    res.status(200).json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, email, phone, address } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const result = await pool.query(
      `INSERT INTO clients (name, email, phone, address)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, email || null, phone || null, address || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) return res.status(404).json({ error: 'Client not found' });

    const result = await pool.query('DELETE FROM clients WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
