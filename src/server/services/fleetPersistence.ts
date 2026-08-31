import type { EmailWrite, FleetRepositories, SummaryWrite, ThreadWrite, WorkOrderWrite } from '../repositories';

export class FleetPersistenceService {
  constructor(private readonly repositories: FleetRepositories) {}

  async ingestMessage(organizationId: string, thread: ThreadWrite, email: EmailWrite, summary?: SummaryWrite) {
    const savedThread = await this.repositories.threads.upsert(organizationId, thread);
    const savedEmail = await this.repositories.emails.upsert(organizationId, { ...email, threadId: savedThread.id });
    const savedSummary = summary
      ? await this.repositories.summaries.upsert(organizationId, { ...summary, emailId: savedEmail.id, threadId: savedThread.id })
      : null;
    return { thread: savedThread, email: savedEmail, summary: savedSummary };
  }

  async createWorkOrderFromEmail(organizationId: string, emailId: string, workOrder: WorkOrderWrite) {
    const email = await this.repositories.emails.getById(organizationId, emailId);
    if (!email) throw new Error('Email not found in organization');
    const vehicle = await this.repositories.vehicles.getById(organizationId, workOrder.vehicleId);
    if (!vehicle) throw new Error('Vehicle not found in organization');
    return this.repositories.workOrders.upsert(organizationId, { ...workOrder, sourceEmailId: email.id });
  }
}
