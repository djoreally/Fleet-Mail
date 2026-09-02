import { randomUUID } from 'node:crypto';
import { Pool } from '@neondatabase/serverless';

export class PaymentReconciliationError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const money = (value: unknown, name: string) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) throw new PaymentReconciliationError(400, `${name} must be greater than zero`);
  return Math.round(amount * 100) / 100;
};

export class PaymentReconciliationService {
  async record(organizationId: string, invoiceId: string, input: Record<string, unknown>) {
    const url = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
    if (!url) throw new PaymentReconciliationError(503, 'Database is not configured');
    const amount = money(input.amount, 'Payment amount');
    const provider = String(input.provider || 'manual').trim().slice(0, 100) || 'manual';
    const externalPaymentId = input.externalPaymentId ? String(input.externalPaymentId).trim().slice(0, 300) : null;
    const status = String(input.status || 'paid');
    if (!['paid','pending'].includes(status)) throw new PaymentReconciliationError(400, 'Payment status must be paid or pending');
    const paidAt = status === 'paid' ? (input.paidAt ? new Date(String(input.paidAt)) : new Date()) : null;
    if (paidAt && Number.isNaN(paidAt.getTime())) throw new PaymentReconciliationError(400, 'paidAt must be a valid date');

    const pool = new Pool({ connectionString: url });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const invoiceResult = await client.query(
        'SELECT id,total,balance_due,status FROM public.invoices WHERE organization_id=$1 AND id=$2 FOR UPDATE',
        [organizationId, invoiceId],
      );
      const invoice = invoiceResult.rows[0];
      if (!invoice) throw new PaymentReconciliationError(404, 'Invoice not found');
      if (invoice.status === 'void') throw new PaymentReconciliationError(409, 'Void invoices cannot accept payments');

      if (externalPaymentId) {
        const existing = await client.query(
          'SELECT * FROM public.payments WHERE organization_id=$1 AND invoice_id=$2 AND provider=$3 AND external_payment_id=$4 LIMIT 1',
          [organizationId, invoiceId, provider, externalPaymentId],
        );
        if (existing.rows[0]) {
          const existingPayment = existing.rows[0];
          if (existingPayment.status === status) {
            await client.query('COMMIT');
            return { payment: existingPayment, invoice, idempotentReplay: true };
          }
          if (existingPayment.status !== 'pending' || status !== 'paid') {
            throw new PaymentReconciliationError(409, 'Payment status transition is not allowed');
          }
          const balance = Number(invoice.balance_due || 0);
          if (amount > balance + 0.001) throw new PaymentReconciliationError(409, 'Payment exceeds the invoice balance');
          if (Math.abs(Number(existingPayment.amount) - amount) > 0.001) {
            throw new PaymentReconciliationError(409, 'Provider payment amount does not match the pending payment');
          }
          const promoted = await client.query(
            `UPDATE public.payments SET status='paid',paid_at=$1
             WHERE organization_id=$2 AND id=$3 AND status='pending' RETURNING *`,
            [paidAt, organizationId, existingPayment.id],
          );
          const newBalance = Math.max(0, Math.round((balance - amount) * 100) / 100);
          const invoiceStatus = newBalance === 0 ? 'paid' : (invoice.status === 'draft' ? 'open' : invoice.status);
          const updated = await client.query(
            `UPDATE public.invoices SET balance_due=$1,status=$2,updated_at=now()
             WHERE organization_id=$3 AND id=$4 RETURNING *`,
            [newBalance.toFixed(2), invoiceStatus, organizationId, invoiceId],
          );
          await client.query('COMMIT');
          return { payment: promoted.rows[0], invoice: updated.rows[0], idempotentReplay: false, reconciledPending: true };
        }
      }

      const balance = Number(invoice.balance_due || 0);
      if (status === 'paid' && amount > balance + 0.001) throw new PaymentReconciliationError(409, 'Payment exceeds the invoice balance');

      const paymentId = randomUUID();
      const paymentResult = await client.query(
        `INSERT INTO public.payments(id,organization_id,invoice_id,provider,external_payment_id,amount,status,paid_at)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [paymentId, organizationId, invoiceId, provider, externalPaymentId, amount.toFixed(2), status, paidAt],
      );

      let updatedInvoice = invoice;
      if (status === 'paid') {
        const newBalance = Math.max(0, Math.round((balance - amount) * 100) / 100);
        const invoiceStatus = newBalance === 0 ? 'paid' : (invoice.status === 'draft' ? 'open' : invoice.status);
        const updated = await client.query(
          `UPDATE public.invoices SET balance_due=$1,status=$2,updated_at=now()
           WHERE organization_id=$3 AND id=$4 RETURNING *`,
          [newBalance.toFixed(2), invoiceStatus, organizationId, invoiceId],
        );
        updatedInvoice = updated.rows[0];
      }
      await client.query('COMMIT');
      return { payment: paymentResult.rows[0], invoice: updatedInvoice, idempotentReplay: false };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
      await pool.end();
    }
  }
}

export const paymentReconciliationService = new PaymentReconciliationService();
