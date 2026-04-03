// ============================================
// Zalo Outreach — Types
// ============================================

// --- Plugin Protocol Types ---

export interface PluginHealthResponse {
  status: "healthy" | "degraded" | "unhealthy";
  version: string;
  uptime: number;
  checks: Record<string, "healthy" | "unhealthy">;
  error?: string;
}

export interface PluginExecuteRequest {
  capability_id: string;
  input: Record<string, unknown>;
  options?: {
    timeout?: number;
    priority?: "low" | "normal" | "high";
    callback_url?: string;
  };
}

export interface PluginResponse<T = unknown> {
  success: boolean;
  data?: T;
  meta?: {
    duration_ms?: number;
    page?: number;
    limit?: number;
    total?: number;
    total_pages?: number;
    credits_used?: number;
  };
  error?: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
    retry_after?: number | null;
  };
}

export interface AsyncJobResponse {
  success: boolean;
  request_id: string;
  job_id: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  progress?: number;
  estimated_completion?: string;
  poll_url: string;
  cancel_url: string;
  result?: unknown;
  started_at?: string;
  completed_at?: string;
  error?: string;
}

// --- Zalo Types ---

export interface ZaloGroupLinkInfo {
  groupId: string;
  name: string;
  desc?: string;
  type?: number;
  creatorId?: string;
  avt?: string;
  fullAvt?: string;
  adminIds?: string[];
  currentMems: ZaloGroupMember[];
  admins?: ZaloGroupMember[];
  hasMoreMember: number;
  totalMember: number;
  setting?: Record<string, unknown>;
  globalId?: string;
  subType?: number;
}

export interface ZaloGroupMember {
  id: string;
  dName: string;
  zaloName?: string;
  avatar?: string;
  avatar_25?: string;
  accountStatus?: number;
  type?: number;
}

export interface ZaloSession {
  cookie: string;
  imei: string;
  userAgent: string;
}

// --- Capability Input/Output Types ---

export interface ScanGroupMembersInput {
  group_links: string[];
  account_id?: string;
}

export interface ScanGroupMembersOutput {
  groups_scanned: number;
  total_members_found: number;
  unique_members: number;
  groups: Array<{
    group_id: string;
    group_name: string;
    group_link: string;
    total_members: number;
    members_extracted: number;
  }>;
}

export interface SendOutreachMessageInput {
  contact_id: string;
  message: string;
  account_id?: string;
}

export interface SendOutreachMessageOutput {
  sent: boolean;
  message_id: string;
  sent_at: string;
}

export interface RunCampaignInput {
  campaign_name: string;
  contact_ids: string[];
  template_id: string;
  settings?: {
    delay_min_seconds?: number;
    delay_max_seconds?: number;
    max_per_day?: number;
    active_hours_start?: string;
    active_hours_end?: string;
    account_id?: string;
  };
}

export interface RunCampaignOutput {
  campaign_id: string;
  status: string;
  total_contacts: number;
  estimated_completion: string;
}

export interface GetCampaignStatsInput {
  campaign_id: string;
}

export interface GetCampaignStatsOutput {
  campaign_id: string;
  campaign_name: string;
  status: string;
  stats: {
    total: number;
    pending: number;
    sent: number;
    replied: number;
    interested: number;
    not_interested: number;
    blocked: number;
    failed: number;
  };
}

export interface ExportContactsInput {
  format?: "csv" | "json";
  filters?: {
    group_ids?: string[];
    statuses?: string[];
    tags?: string[];
  };
}

export interface ExportContactsOutput {
  file_url: string;
  total_exported: number;
  format: string;
}

// --- WebSocket Message Types ---

export interface WSMessage {
  type: string;
  payload: unknown;
  timestamp: string;
}

export type OutreachStatus =
  | "new"
  | "pending"
  | "sent"
  | "replied"
  | "interested"
  | "not_interested"
  | "blocked"
  | "converted";

export type CampaignStatus =
  | "draft"
  | "queued"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export type ScanJobStatus =
  | "queued"
  | "scanning"
  | "completed"
  | "failed"
  | "cancelled";
