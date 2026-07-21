require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');

const clientsRouter = require('./routes/clients');
const invoicesRouter = require('./routes/invoices');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, '..', 'frontend', 'public')));

app.use('/api/clients', clientsRouter);
app.use('/api/invoices', invoicesRouter);

app.listen(PORT, () => {
  console.log(`Invoice Generator server listening on port ${PORT}`);
});
