# Invoice Generator

A full-stack invoice and receipt generator for small businesses. Manage clients, build invoices with itemized line items, track payment status, and export polished PDF invoices — all from a single lightweight web app.

## Features

- **Client management** — add clients with name, email, phone, and address, browse them in a searchable list, and delete a client (with an in-app confirmation dialog) when they're no longer needed.
- **Invoices with line items** — build an invoice against a client with any number of description / quantity / unit price line items.
- **Live totals** — subtotal, tax, and grand total recalculate in the browser as you edit line items and the tax rate.
- **Status tracking** — every invoice is `draft`, `sent`, `paid`, or `overdue`; update status inline and filter the invoice list by status.
- **Auto-numbered invoices** — each invoice is assigned a sequential number in the form `INV-YYYYMM-XXXX`, scoped to the month it's created.
- **PDF export** — download any invoice as a formatted PDF, generated on the server with [PDFKit](https://pdfkit.org/).
- **Delete with confirmation** — clients and invoices can each be permanently deleted from the UI, guarded by an in-app confirmation modal.

## Tech Stack

| Layer      | Technology                                   |
|------------|-----------------------------------------------|
| Backend    | Node.js, Express                              |
| Database   | PostgreSQL (via `pg`)                         |
| PDF export | PDFKit                                        |
| Frontend   | Vanilla HTML / CSS / JavaScript (no framework, no build step) |
| Dev tooling| nodemon                                       |

The frontend is a single static page (`frontend/public/index.html`) served directly by Express — there's no separate frontend build or dev server.

## Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/NovaVey/invoice-generator.git
   cd invoice-generator
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and set `DATABASE_URL` to point at your PostgreSQL instance:

   ```
   DATABASE_URL=postgresql://user:password@localhost:5432/invoice_generator
   PORT=3002
   ```

4. **Initialize the database schema**

   ```bash
   npm run db:init
   ```

   This runs `backend/db/schema.sql` against `DATABASE_URL`, creating the `clients`, `invoices`, and `invoice_items` tables.

5. **Run the app**

   ```bash
   npm run dev    # nodemon, auto-restarts on change
   # or
   npm start      # plain node
   ```

6. Open **http://localhost:3002** in your browser.

## API Reference

All request/response bodies use JSON with `snake_case` field names.

| Method | Path                        | Description                                                                 |
|--------|-----------------------------|-------------------------------------------------------------------------------|
| GET    | `/api/clients`               | List all clients, ordered by name ascending.                                 |
| POST   | `/api/clients`               | Create a client. Body: `{ name, email, phone, address }` (`name` required). |
| DELETE | `/api/clients/:id`            | Delete a client. Existing invoices are kept but unlinked (`client_id` set to `NULL`). |
| GET    | `/api/invoices`               | List invoices, newest first. Optional `?status=draft\|sent\|paid\|overdue` filter. |
| GET    | `/api/invoices/:id`           | Get full invoice detail, including client and line items.                    |
| POST   | `/api/invoices`               | Create an invoice. Body: `{ client_id, issue_date, due_date, tax_rate, notes, items: [{ description, quantity, unit_price }] }`. |
| PATCH  | `/api/invoices/:id/status`    | Update invoice status. Body: `{ status }`, one of `draft\|sent\|paid\|overdue`. |
| DELETE | `/api/invoices/:id`            | Delete an invoice and its line items (cascades via `ON DELETE CASCADE`).     |
| GET    | `/api/invoices/:id/pdf`       | Download the invoice as a PDF (`Content-Disposition: attachment`).           |

### Data Shapes

**Client**

```json
{ "id": 1, "name": "Acme Co", "email": "billing@acme.com", "phone": "555-0100", "address": "123 Main St", "created_at": "2026-01-01T00:00:00.000Z" }
```

**Invoice (list row)**

```json
{
  "id": 1, "invoice_number": "INV-202607-0001", "client_id": 1, "client_name": "Acme Co",
  "status": "draft", "issue_date": "2026-07-01", "due_date": "2026-07-31",
  "subtotal": 100, "tax_rate": 8.5, "tax_amount": 8.5, "total": 108.5,
  "notes": "", "created_at": "2026-07-01T00:00:00.000Z", "updated_at": "2026-07-01T00:00:00.000Z"
}
```

**Invoice (detail)** — same fields as above (minus `client_name`), plus:

```json
{
  "client": { "id": 1, "name": "Acme Co", "email": "billing@acme.com", "phone": "555-0100", "address": "123 Main St" },
  "items": [{ "id": 1, "description": "Consulting", "quantity": 2, "unit_price": 50, "line_total": 100 }]
}
```

## Project Structure

```
backend/
  db/
    pool.js        # shared pg Pool
    schema.sql      # table definitions
  routes/
    clients.js      # /api/clients
    invoices.js      # /api/invoices
  services/
    pdfService.js    # PDF generation with PDFKit
  server.js          # Express app entry point
frontend/
  public/
    index.html        # single-page frontend (static, served by Express)
.env.example
package.json
```

## License

MIT — see [LICENSE](./LICENSE).
