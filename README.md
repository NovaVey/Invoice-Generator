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

## Screenshots

<table>
<tr>
<td width="33%"><img src="screenshots/01-clients-list.png" alt="Clients list"><br><sub><b>Clients</b> — list view</sub></td>
<td width="33%"><img src="screenshots/02-add-client-form-filled.png" alt="Add client form filled in"><br><sub><b>Add Client</b> — filled form</sub></td>
<td width="33%"><img src="screenshots/03-clients-after-add.png" alt="Clients list after adding a client"><br><sub><b>Clients</b> — after add</sub></td>
</tr>
<tr>
<td width="33%"><img src="screenshots/04-create-invoice-filled.png" alt="Create Invoice form filled in with live totals"><br><sub><b>Create Invoice</b> — filled, live totals</sub></td>
<td width="33%"><img src="screenshots/05-invoice-created-success.png" alt="Invoice created success banner with PDF download link"><br><sub><b>Invoice created</b> — success + PDF link</sub></td>
<td width="33%"><img src="screenshots/06-invoices-list.png" alt="Invoices list view"><br><sub><b>Invoices</b> — list view</sub></td>
</tr>
<tr>
<td width="33%"><img src="screenshots/07-invoice-expanded-detail.png" alt="Expanded invoice detail with line items"><br><sub><b>Invoice</b> — expanded detail</sub></td>
<td width="33%"><img src="screenshots/08-invoice-status-changed-overdue.png" alt="Invoice status changed to Overdue"><br><sub><b>Status change</b> — marked Overdue</sub></td>
<td width="33%"><img src="screenshots/09-invoices-filtered-overdue.png" alt="Invoices filtered to Overdue only"><br><sub><b>Filter</b> — Overdue only</sub></td>
</tr>
<tr>
<td width="33%"><img src="screenshots/10-invoice-delete-confirmation.png" alt="Delete invoice confirmation modal"><br><sub><b>Delete invoice</b> — confirmation</sub></td>
<td width="33%"><img src="screenshots/11-invoice-after-delete.png" alt="Invoices list after deleting an invoice"><br><sub><b>Invoices</b> — after delete</sub></td>
<td width="33%"><img src="screenshots/12-client-delete-confirmation.png" alt="Delete client confirmation modal"><br><sub><b>Delete client</b> — confirmation</sub></td>
</tr>
<tr>
<td width="33%"><img src="screenshots/13-client-delete-cancelled.png" alt="Client delete cancelled, client still present"><br><sub><b>Delete client</b> — cancelled</sub></td>
<td width="33%"><img src="screenshots/14-client-after-delete.png" alt="Clients list after deleting a client"><br><sub><b>Clients</b> — after delete</sub></td>
<td width="33%"><img src="screenshots/15-pdf-preview.png" alt="Generated PDF invoice output"><br><sub><b>Generated PDF</b> — output</sub></td>
</tr>
</table>

## Demo Video

A full walkthrough covering every feature — adding a client, creating an invoice with live line-item totals, downloading the PDF, browsing and filtering invoices, changing status to Overdue, and deleting both an invoice and a client (with confirmation):

**[▶ Watch the demo video](screenshots/demo.webm)** — opens GitHub's built-in file viewer, which plays `.webm` natively.

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
screenshots/           # README screenshots + demo video
.env.example
package.json
```

## License

MIT — see [LICENSE](./LICENSE).
