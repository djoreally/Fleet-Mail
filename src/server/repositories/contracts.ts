export type OrganizationId = string;

export interface PageRequest {
  limit?: number;
  offset?: number;
}

export interface TenantRecord {
  id: string;
  organizationId: OrganizationId;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailRecord extends TenantRecord {
  externalId: string;
  inboxId: string;
  threadId: string | null;
  fromAddress: string;
  fromName: string | null;
  toAddresses: string[];
  subject: string;
  textContent: string | null;
  htmlContent: string | null;
  isRead: boolean;
  isStarred: boolean;
  labels: string[];
  receivedAt: Date;
}

export type EmailWrite = Omit<EmailRecord, keyof TenantRecord | 'receivedAt'> & {
  id?: string;
  receivedAt?: Date;
};

export interface ThreadRecord extends TenantRecord {
  externalId: string;
  inboxId: string;
  subject: string;
  participantAddresses: string[];
  lastMessageAt: Date;
  messageCount: number;
}

export type ThreadWrite = Omit<ThreadRecord, keyof TenantRecord> & { id?: string };

export interface SummaryRecord extends TenantRecord {
  emailId: string | null;
  threadId: string | null;
  tldr: string;
  actionItems: string[];
  urgency: 'Low' | 'Medium' | 'High' | 'Critical';
  sentiment: 'Positive' | 'Neutral' | 'Urgent' | 'Informative';
  suggestedReplies: string[];
  keyPoints: string[];
  modelUsed: string;
}

export type SummaryWrite = Omit<SummaryRecord, keyof TenantRecord> & { id?: string };

export interface ContactRecord extends TenantRecord {
  name: string;
  email: string;
  company: string | null;
  role: string | null;
  phone: string | null;
  notes: string | null;
  tags: string[];
  isFavorite: boolean;
  source: string;
}

export type ContactWrite = Omit<ContactRecord, keyof TenantRecord> & { id?: string };

export interface CustomerRecord extends TenantRecord {
  name: string;
  billingEmail: string | null;
  phone: string | null;
  billingAddress: Record<string, unknown> | null;
  notes: string | null;
  status: string;
}
export type CustomerWrite = Omit<CustomerRecord, keyof TenantRecord> & { id?: string };

export interface VehicleRecord extends TenantRecord {
  customerId: string | null;
  unitNumber: string;
  vin: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  mileage: number | null;
  status: string;
}

export type VehicleWrite = Omit<VehicleRecord, keyof TenantRecord> & { id?: string };

export interface WorkOrderRecord extends TenantRecord {
  vehicleId: string;
  customerId: string | null;
  sourceEmailId: string | null;
  number: string;
  status: string;
  description: string | null;
  scheduledAt: Date | null;
  completedAt: Date | null;
}

export type WorkOrderWrite = Omit<WorkOrderRecord, keyof TenantRecord> & { id?: string };

export interface TenantCrudRepository<TRecord extends TenantRecord, TWrite> {
  getById(organizationId: OrganizationId, id: string): Promise<TRecord | null>;
  list(organizationId: OrganizationId, page?: PageRequest): Promise<TRecord[]>;
  upsert(organizationId: OrganizationId, value: TWrite): Promise<TRecord>;
  delete(organizationId: OrganizationId, id: string): Promise<boolean>;
}

export interface EmailRepository extends TenantCrudRepository<EmailRecord, EmailWrite> {
  getByExternalId(organizationId: OrganizationId, externalId: string): Promise<EmailRecord | null>;
  listByThread(organizationId: OrganizationId, threadId: string, page?: PageRequest): Promise<EmailRecord[]>;
}
export interface ThreadRepository extends TenantCrudRepository<ThreadRecord, ThreadWrite> {
  getByExternalId(organizationId: OrganizationId, externalId: string): Promise<ThreadRecord | null>;
}
export interface SummaryRepository extends TenantCrudRepository<SummaryRecord, SummaryWrite> {
  getForEmail(organizationId: OrganizationId, emailId: string): Promise<SummaryRecord | null>;
  getForThread(organizationId: OrganizationId, threadId: string): Promise<SummaryRecord | null>;
}
export interface ContactRepository extends TenantCrudRepository<ContactRecord, ContactWrite> {
  getByEmail(organizationId: OrganizationId, email: string): Promise<ContactRecord | null>;
}
export type CustomerRepository = TenantCrudRepository<CustomerRecord, CustomerWrite>;
export type VehicleRepository = TenantCrudRepository<VehicleRecord, VehicleWrite>;
export interface WorkOrderRepository extends TenantCrudRepository<WorkOrderRecord, WorkOrderWrite> {
  listByVehicle(organizationId: OrganizationId, vehicleId: string, page?: PageRequest): Promise<WorkOrderRecord[]>;
}

export interface FleetRepositories {
  emails: EmailRepository;
  threads: ThreadRepository;
  summaries: SummaryRepository;
  contacts: ContactRepository;
  customers: CustomerRepository;
  vehicles: VehicleRepository;
  workOrders: WorkOrderRepository;
}
