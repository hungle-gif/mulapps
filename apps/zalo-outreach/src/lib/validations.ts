import { z } from "zod";

// --- Group Link ---
export const zaloGroupLinkPattern = /^https:\/\/zalo\.me\/g\/.+$/;

export const scanGroupsSchema = z.object({
  group_links: z
    .array(z.string().regex(zaloGroupLinkPattern, "Invalid Zalo group link"))
    .min(1, "At least 1 link required")
    .max(50, "Max 50 links per scan"),
  account_id: z.string().optional(),
});

// --- Send Message ---
export const sendMessageSchema = z.object({
  contact_id: z.string().min(1),
  message: z.string().min(1).max(2000),
  account_id: z.string().optional(),
});

// --- Campaign ---
export const createCampaignSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  account_id: z.string().min(1),
  template_id: z.string().min(1),
  group_id: z.string().optional(),
  contact_ids: z.array(z.string()).min(1),
  delay_min_seconds: z.number().int().min(15).default(30),
  delay_max_seconds: z.number().int().min(30).default(120),
  max_per_day: z.number().int().min(1).max(200).default(50),
  active_hours_start: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .default("08:00"),
  active_hours_end: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .default("21:00"),
});

// --- Template ---
export const createTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  content: z.string().min(1).max(5000),
  variants: z.string().optional(), // JSON array string
  category: z
    .enum(["general", "greeting", "follow_up", "promotion", "closing"])
    .default("general"),
});

export const updateTemplateSchema = createTemplateSchema.partial();

// --- Contact ---
export const updateContactSchema = z.object({
  outreach_status: z
    .enum([
      "new",
      "pending",
      "sent",
      "replied",
      "interested",
      "not_interested",
      "blocked",
      "converted",
    ])
    .optional(),
  interest_score: z.number().int().min(0).max(100).optional(),
  tags: z.string().optional(),
  notes: z.string().max(5000).optional(),
});

// --- Pagination ---
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).default("desc"),
  search: z.string().optional(),
});

// --- Plugin Protocol Execute ---
export const executeSchema = z.object({
  capability_id: z.string().min(1),
  input: z.record(z.unknown()),
  options: z
    .object({
      timeout: z.number().optional(),
      priority: z.enum(["low", "normal", "high"]).optional(),
      callback_url: z.string().url().optional(),
    })
    .optional(),
});
