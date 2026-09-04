export interface EmailAttachment {
  id: string;
  filename: string;
  contentType?: string;
  size?: number;
  disposition?: string;
}

export interface EmailMessage {
  id: string;
  thread_id?: string;
  inbox_id?: string;
  from: string;
  fromName?: string;
  avatarUrl?: string;
  to: string[] | string;
  subject: string;
  text?: string;
  html?: string;
  created_at: string;
  formattedTime?: string;
  relativeTime?: string;
  read?: boolean;
  starred?: boolean;
  actionRequired?: string;
  labels?: string[];
  summary?: EmailSummary;
  attachments?: EmailAttachment[];
}

export interface EmailSummary {
  tldr: string;
  actionItems: string[];
  urgency: 'Low' | 'Medium' | 'High' | 'Critical';
  sentiment: 'Positive' | 'Neutral' | 'Urgent' | 'Informative';
  suggestedReplies: string[];
  keyPoints: string[];
  generatedAt: string;
  modelUsed: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  chips?: string[];
  calendarInvite?: { title: string; time: string };
  emailDraft?: { to: string; subject: string; body: string };
  emailSummary?: EmailSummary;
  actionProposal?: AgentActionProposal;
  isStreaming?: boolean;
  attachments?: ChatAttachment[];
}

export interface ChatAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  kind: 'image' | 'document';
  dataUrl?: string;
  text?: string;
}

export interface AgentActionProposal {
  proposal: {
    id: string;
    kind: 'email.send' | 'calendar.create';
    summary: string;
    payload: Record<string, unknown>;
    createdAt: string;
    expiresAt: string;
  };
  confirmationToken: string;
  state?: 'ready' | 'executing' | 'executed' | 'failed';
  error?: string;
}

export interface SystemStatus {
  atlasCloudConfigured: boolean;
  agentMailConfigured: boolean;
  defaultInbox: string;
  model: string;
  activeInbox: string;
}

export interface SendEmailPayload {
  inbox: string;
  to: string;
  subject: string;
  body: string;
  html?: string;
}

export interface BusinessProfileSettings {
  businessName: string;
  businessEmail: string;
  businessPhone: string;
  website: string;
  address: string;
  city: string;
  region: string;
  postalCode: string;
  timezone: string;
}

export interface AgentPreferenceSettings {
  allowWebResearch: boolean;
  allowNhtsaVinDecode: boolean;
  allowCameraOcr: boolean;
  requireConfirmationForWrites: boolean;
}

export interface PersonalizationSettings {
  personalityFocus: 'Professional' | 'Friendly' | 'Concise';
  importantEmailsOnly: boolean;
  dailyAIDigest: boolean;
  connectedAccounts: ConnectedAccount[];
  businessProfile: BusinessProfileSettings;
  agentPreferences: AgentPreferenceSettings;
}

export interface ConnectedAccount {
  id: string;
  name: string;
  type: 'google' | 'outlook' | 'agentmail' | 'custom';
  email: string;
  icon?: string;
}

export interface Contact {
  id: string;
  name: string;
  email: string;
  company?: string;
  role?: string;
  phone?: string;
  avatarUrl?: string;
  tags?: string[];
  notes?: string;
  lastContacted?: string;
  isFavorite?: boolean;
  source?: 'manual' | 'agentmail' | 'inbox' | 'google';
}
