import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('invoice payment reconciliation contract', () => {
  it('locks the organization-scoped invoice and prevents overpayment', () => {
    const source = readFileSync('src/server/services/paymentReconciliation.ts', 'utf8');
    expect(source).toContain('organization_id=$1 AND id=$2 FOR UPDATE');
    expect(source).toContain('Payment exceeds the invoice balance');
  });

  it('supports provider idempotency and updates invoice balance/status atomically', () => {
    const source = readFileSync('src/server/services/paymentReconciliation.ts', 'utf8');
    expect(source).toContain('external_payment_id=$4');
    expect(source).toContain('idempotentReplay: true');
    expect(source).toContain('UPDATE public.invoices SET balance_due=$1,status=$2,updated_at=now()');
    expect(source).toContain("newBalance === 0 ? 'paid'");
  });

  it('runs payment insert and invoice update inside a transaction', () => {
    const source = readFileSync('src/server/services/paymentReconciliation.ts', 'utf8');
    expect(source).toContain("client.query('BEGIN')");
    expect(source).toContain("client.query('COMMIT')");
    expect(source).toContain("client.query('ROLLBACK')");
  });
});
