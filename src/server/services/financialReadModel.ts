import { Pool } from '@neondatabase/serverless';

export class FinancialReadModelError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const number = (value: unknown) => Number(value || 0);
const currency = (value: unknown) => number(value).toFixed(2);

export class FinancialReadModelService {
  private pool() {
    const url = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
    if (!url) throw new FinancialReadModelError(503, 'Database is not configured');
    return new Pool({ connectionString: url });
  }

  async dashboard(organizationId: string, now = new Date()) {
    const pool = this.pool();
    try {
      const [invoiceResult, workOrderResult] = await Promise.all([
        pool.query(`
          SELECT i.id,i.number,i.customer_id,i.work_order_id,i.status,i.subtotal,i.tax,i.total,i.balance_due,
                 i.due_at,i.created_at,c.name AS customer_name,
                 COALESCE(SUM(CASE WHEN p.status='paid' THEN p.amount ELSE 0 END),0) AS paid_amount
          FROM public.invoices i
          JOIN public.customers c ON c.organization_id=i.organization_id AND c.id=i.customer_id
          LEFT JOIN public.payments p ON p.organization_id=i.organization_id AND p.invoice_id=i.id
          WHERE i.organization_id=$1
          GROUP BY i.id,c.name
          ORDER BY i.created_at DESC LIMIT 500`, [organizationId]),
        pool.query(`
          WITH service AS (
            SELECT work_order_id,
              COALESCE(SUM(quantity*unit_price),0) revenue,
              COALESCE(SUM(CASE WHEN kind='labor' THEN labor_minutes ELSE 0 END),0) labor_minutes
            FROM public.service_lines WHERE organization_id=$1 AND authorized=true GROUP BY work_order_id
          ), part AS (
            SELECT work_order_id,COALESCE(SUM(quantity*COALESCE(sell_price,0)),0) revenue,
              COALESCE(SUM(quantity*COALESCE(unit_cost,0)),0) cost
            FROM public.part_usage WHERE organization_id=$1 GROUP BY work_order_id
          ), fluid AS (
            SELECT work_order_id,COALESCE(SUM(quantity*COALESCE(sell_price,0)),0) revenue,
              COALESCE(SUM(quantity*COALESCE(unit_cost,0)),0) cost
            FROM public.fluid_usage WHERE organization_id=$1 GROUP BY work_order_id
          )
          SELECT w.id,w.number,w.status,w.customer_id,w.vehicle_id,w.completed_at,
            COALESCE(service.revenue,0) service_revenue,COALESCE(service.labor_minutes,0) labor_minutes,
            COALESCE(part.revenue,0) part_revenue,COALESCE(part.cost,0) part_cost,
            COALESCE(fluid.revenue,0) fluid_revenue,COALESCE(fluid.cost,0) fluid_cost
          FROM public.work_orders w
          LEFT JOIN service ON service.work_order_id=w.id
          LEFT JOIN part ON part.work_order_id=w.id
          LEFT JOIN fluid ON fluid.work_order_id=w.id
          WHERE w.organization_id=$1 ORDER BY w.updated_at DESC LIMIT 500`, [organizationId]),
      ]);

      const invoices = invoiceResult.rows.map((row) => {
        const balance = number(row.balance_due);
        const daysPastDue = row.due_at && balance > 0
          ? Math.max(0, Math.floor((now.getTime() - new Date(row.due_at).getTime()) / 86_400_000))
          : 0;
        const agingBucket = balance <= 0 ? 'paid' : daysPastDue === 0 ? 'current'
          : daysPastDue <= 30 ? '1-30' : daysPastDue <= 60 ? '31-60' : daysPastDue <= 90 ? '61-90' : '90+';
        return { ...row, total: currency(row.total), balanceDue: currency(balance), paidAmount: currency(row.paid_amount), daysPastDue, agingBucket };
      });
      const workOrders = workOrderResult.rows.map((row) => {
        const revenue = number(row.service_revenue) + number(row.part_revenue) + number(row.fluid_revenue);
        const directCost = number(row.part_cost) + number(row.fluid_cost);
        return {
          ...row,
          revenue: currency(revenue),
          directCost: currency(directCost),
          grossProfit: currency(revenue - directCost),
          grossMarginPercent: revenue > 0 ? (((revenue - directCost) / revenue) * 100).toFixed(1) : null,
        };
      });
      const openInvoices = invoices.filter((row) => number(row.balanceDue) > 0 && row.status !== 'void');
      const aging = Object.fromEntries(['current','1-30','31-60','61-90','90+'].map((bucket) => [
        bucket, currency(openInvoices.filter((row) => row.agingBucket === bucket).reduce((sum, row) => sum + number(row.balanceDue), 0)),
      ]));
      return {
        generatedAt: now.toISOString(),
        summary: {
          invoiced: currency(invoices.filter((row) => row.status !== 'void').reduce((sum, row) => sum + number(row.total), 0)),
          collected: currency(invoices.reduce((sum, row) => sum + number(row.paidAmount), 0)),
          outstanding: currency(openInvoices.reduce((sum, row) => sum + number(row.balanceDue), 0)),
          overdue: currency(openInvoices.filter((row) => row.daysPastDue > 0).reduce((sum, row) => sum + number(row.balanceDue), 0)),
          grossProfit: currency(workOrders.reduce((sum, row) => sum + number(row.grossProfit), 0)),
        },
        aging,
        invoices,
        workOrders,
        costingNote: 'Gross profit includes recorded parts and fluid direct costs; labor cost is unavailable because no canonical labor-cost field exists.',
      };
    } finally {
      await pool.end();
    }
  }
}

export const financialReadModelService = new FinancialReadModelService();
