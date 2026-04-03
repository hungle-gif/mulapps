# Hub Architecture — Bộ Não Trung Tâm

> Hub là nơi DUY NHẤT có giao diện, có AI, có logic quyết định.
> Các app con chỉ là "tay chân" — thực thi lệnh + trả data thô.
> Tài liệu này định nghĩa CHI TIẾT cấu trúc Hub để mọi app con sau này đều tương thích.

---

## 1. Tổng Quan Module

```
hub/
│
├── 🧠 AI Brain              — Suy nghĩ, phân tích, ra quyết định
├── 🔌 App Registry           — Quản lý app con (cài/gỡ/health)
├── 🚦 Gateway                — Điều phối request đến đúng app con
├── 🔗 Workflow Engine         — Nối chuỗi capabilities giữa các app
├── 📡 Event Bus               — Nhận/chuyển events giữa các app
├── 🖥️ UI Layer               — Dashboard, chat, quản lý (giao diện duy nhất)
├── 👤 User & Auth             — Quản lý user, phân quyền
├── 💾 Data Store              — Database Hub (users, workflows, logs, conversations)
└── 📊 Analytics               — Tổng hợp metrics từ tất cả app con
```

### Sơ đồ chi tiết

```
┌─────────────────────────────────────────────────────────────────┐
│                        HUB (Brain)                              │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                     UI LAYER                             │   │
│  │  Dashboard │ App Store │ Workflows │ Chat │ Settings     │   │
│  └──────────────────────────┬───────────────────────────────┘   │
│                              │                                  │
│  ┌───────────────────────────▼──────────────────────────────┐   │
│  │                    AI BRAIN                              │   │
│  │                                                          │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐   │   │
│  │  │ Orchestrator │  │ Conversation │  │ Decision      │   │   │
│  │  │              │  │ Manager      │  │ Engine        │   │   │
│  │  │ "Làm gì     │  │              │  │               │   │   │
│  │  │  tiếp theo?" │  │ "Hiểu ngữ   │  │ "Phân loại   │   │   │
│  │  │              │  │  cảnh chat"  │  │  & ưu tiên"  │   │   │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬────────┘  │   │
│  │         │                 │                  │           │   │
│  └─────────┼─────────────────┼──────────────────┼───────────┘   │
│            │                 │                  │               │
│  ┌─────────▼─────────────────▼──────────────────▼───────────┐   │
│  │                 WORKFLOW ENGINE                           │   │
│  │                                                          │   │
│  │  Step 1 ──→ Step 2 ──→ Step 3 ──→ Step 4               │   │
│  │  (scan)     (filter)    (compose)   (send)              │   │
│  │                                                          │   │
│  │  Mỗi step = 1 capability call đến 1 app con            │   │
│  │  Output step N → Input step N+1 (auto-mapped)           │   │
│  └──────────────────────────┬───────────────────────────────┘   │
│                              │                                  │
│  ┌───────────────────────────▼──────────────────────────────┐   │
│  │                    GATEWAY                               │   │
│  │  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌────────┐ │   │
│  │  │ Auth     │  │ Rate      │  │ Router   │  │ Logger │ │   │
│  │  │ Verify   │  │ Limiter   │  │          │  │        │ │   │
│  │  └──────────┘  └───────────┘  └──────────┘  └────────┘ │   │
│  └───────┬──────────────┬──────────────┬────────────────────┘   │
│          │              │              │                        │
│  ┌───────▼──────┐ ┌────▼──────┐ ┌─────▼─────┐                 │
│  │ APP REGISTRY │ │ EVENT BUS │ │ DATA      │                 │
│  │              │ │           │ │ STORE     │                 │
│  │ manifests    │ │ pub/sub   │ │ PostgreSQL│                 │
│  │ health check │ │ webhooks  │ │ Redis     │                 │
│  └──────────────┘ └───────────┘ └───────────┘                 │
└────────┬──────────────┬──────────────┬──────────────────────────┘
         │              │              │
    Plugin Protocol (HTTP REST + WebSocket)
         │              │              │
    ┌────▼───┐    ┌────▼────┐   ┌────▼────┐
    │ Zalo   │    │ SEO     │   │ Design  │    ... N apps
    │ :3010  │    │ :3011   │   │ :3012   │
    └────────┘    └─────────┘   └─────────┘
```

---

## 2. AI Brain — Chi Tiết

Hub là nơi DUY NHẤT có AI. Gồm 3 module:

### 2.1 Orchestrator — "Làm gì tiếp theo?"

```
Vai trò:
├── Nhận yêu cầu từ user (qua UI hoặc chat)
├── Phân tích yêu cầu → xác định cần gọi app con nào, capability nào
├── Lên kế hoạch thực thi (workflow)
├── Gọi app con theo thứ tự
├── Tổng hợp kết quả → trả user

Ví dụ:
  User: "Quét nhóm ABC và nhắn tin giới thiệu khóa học SEO"

  Orchestrator suy nghĩ:
  1. Cần quét nhóm → gọi zalo-outreach.scan-group-members
  2. Lọc thành viên phù hợp → Hub tự xử lý (filter logic)
  3. Viết tin nhắn → Hub AI soạn (hoặc gọi content-writer nếu có)
  4. Gửi tin nhắn → gọi zalo-outreach.run-campaign
  5. Theo dõi reply → listen events từ zalo-outreach
  6. Phân loại reply → Hub AI phân tích
```

### 2.2 Conversation Manager — "Hiểu ngữ cảnh chat"

```
Vai trò:
├── Nhận raw reply từ app con (ví dụ: tin nhắn Zalo)
├── Hiểu ngữ cảnh: đây là hội thoại đang ở giai đoạn nào
├── Nhớ lịch sử: user đã nói gì, mình đã trả lời gì
├── Tạo reply phù hợp dựa trên context

Ví dụ:
  Zalo contact reply: "Giá bao nhiêu vậy?"

  Conversation Manager:
  1. Context: đang trong campaign giới thiệu khóa học SEO
  2. Giai đoạn: contact đã hỏi giá = QUAN TÂM CAO
  3. Tạo reply: "Khóa học SEO đang ưu đãi 1.990.000đ (giảm 40%)..."
  4. Gửi qua zalo-outreach.send-outreach-message
  5. Cập nhật status: interested, interest_score: 80
```

### 2.3 Decision Engine — "Phân loại & ưu tiên"

```
Vai trò:
├── Phân loại data nhận được (reply = quan tâm? spam? từ chối?)
├── Scoring: đánh giá mức độ quan tâm của contact
├── Ưu tiên: ai nên nhắn trước, ai nên bỏ qua
├── An toàn: detect khi nào nên dừng (bị cảnh báo, rate limit)

Rules (configurable):
├── Reply chứa "giá", "bao nhiêu", "mua" → interested (score +30)
├── Reply chứa "không", "thôi", "bỏ" → not_interested (score -50)
├── Reply chứa "block", "spam" → blocked (dừng ngay)
├── Không reply sau 48h → giảm score, chuyển follow-up
├── Reply > 50 ký tự, có câu hỏi → interested (score +20)
└── Patterns được AI tự học thêm theo thời gian
```

---

## 3. App Registry — Quản Lý App Con

### 3.1 Database Schema (Hub)

```sql
-- Apps đã đăng ký
CREATE TABLE apps (
  id            TEXT PRIMARY KEY,       -- "zalo-outreach"
  name          TEXT NOT NULL,
  version       TEXT NOT NULL,
  description   TEXT,
  icon          TEXT,
  category      TEXT,                   -- marketing, design, content...
  base_url      TEXT NOT NULL,          -- "http://localhost:3010"

  -- Status
  status        TEXT DEFAULT 'active',  -- active, degraded, offline, disabled
  health_status TEXT DEFAULT 'unknown',

  -- Tokens
  app_token     TEXT NOT NULL,          -- Hub dùng token này gọi app
  hub_token     TEXT NOT NULL,          -- App dùng token này gọi Hub
  webhook_secret TEXT NOT NULL,

  -- Metadata
  manifest_raw  TEXT,                   -- Full manifest JSON
  installed_at  TIMESTAMP DEFAULT NOW(),
  last_health_at TIMESTAMP,

  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

-- Capabilities đã đăng ký (denormalized từ manifest)
CREATE TABLE app_capabilities (
  id              TEXT PRIMARY KEY,
  app_id          TEXT REFERENCES apps(id),
  capability_id   TEXT NOT NULL,         -- "scan-group-members"
  name            TEXT NOT NULL,
  description     TEXT,
  category        TEXT,                  -- analysis, generation, transformation...
  input_schema    TEXT,                  -- JSON Schema
  output_schema   TEXT,                  -- JSON Schema
  is_async        BOOLEAN DEFAULT FALSE,
  estimated_duration INTEGER,

  UNIQUE(app_id, capability_id)
);

-- Event subscriptions
CREATE TABLE app_event_subscriptions (
  id          TEXT PRIMARY KEY,
  app_id      TEXT REFERENCES apps(id),
  event_type  TEXT NOT NULL,             -- "content:page-published"
  webhook_url TEXT NOT NULL,

  UNIQUE(app_id, event_type)
);

-- Workflows (chuỗi capabilities)
CREATE TABLE workflows (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  trigger     TEXT,                      -- manual, schedule, event
  status      TEXT DEFAULT 'draft',
  steps       TEXT NOT NULL,             -- JSON array of steps
  created_by  TEXT REFERENCES users(id),

  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

-- Workflow executions
CREATE TABLE workflow_runs (
  id          TEXT PRIMARY KEY,
  workflow_id TEXT REFERENCES workflows(id),
  status      TEXT DEFAULT 'running',
  current_step INTEGER DEFAULT 0,
  results     TEXT,                      -- JSON: results per step
  error       TEXT,
  started_at  TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Hub conversations (AI Brain tracking)
CREATE TABLE hub_conversations (
  id              TEXT PRIMARY KEY,
  source_app      TEXT REFERENCES apps(id),  -- App nào gửi data này
  external_id     TEXT,                      -- ID ở app con (contact_id, etc.)
  external_name   TEXT,                      -- Tên hiển thị

  -- AI Context
  context         TEXT,                      -- JSON: ngữ cảnh hội thoại
  stage           TEXT DEFAULT 'new',        -- new, greeting, follow_up, negotiation, closed
  sentiment       TEXT,                      -- positive, neutral, negative
  interest_score  INTEGER DEFAULT 0,

  -- Tracking
  total_messages  INTEGER DEFAULT 0,
  last_message_at TIMESTAMP,

  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

-- Hub activity log (audit trail)
CREATE TABLE hub_activity_log (
  id          TEXT PRIMARY KEY,
  type        TEXT NOT NULL,             -- app_called, event_received, ai_decision, workflow_step
  app_id      TEXT,
  details     TEXT,                      -- JSON
  created_at  TIMESTAMP DEFAULT NOW()
);
```

### 3.2 App Registration Flow

```
Khi thêm app con mới vào Hub:

1. Admin nhập base_url (ví dụ: http://localhost:3010)

2. Hub gọi GET {base_url}/manifest
   → Nhận manifest.json

3. Hub validate manifest:
   ├── protocol_version tương thích?
   ├── id unique (chưa có app trùng)?
   ├── capabilities có input/output schema hợp lệ?
   └── Permissions OK?

4. Hub generate tokens:
   ├── app_token (Hub → App): crypto random 64 bytes
   ├── hub_token (App → Hub): crypto random 64 bytes
   └── webhook_secret: crypto random 32 bytes

5. Hub gọi POST {base_url}/register (nếu app có endpoint này)
   → Gửi tokens cho app con lưu

6. Hub lưu vào database:
   ├── apps table: thông tin cơ bản
   ├── app_capabilities: từng capability
   └── app_event_subscriptions: events app muốn nhận

7. Hub bắt đầu health check mỗi 30 giây

8. Hub thông báo AI Brain: "Có app mới, capabilities mới"
   → AI Brain cập nhật danh sách tools có thể dùng
```

### 3.3 Health Monitor

```
Mỗi 30 giây, với MỖI app:

Hub gọi GET {base_url}/health
├── 200 + status: "healthy"   → app.status = "active"
├── 200 + status: "degraded"  → app.status = "degraded" (vẫn route, hiện warning)
├── 503 hoặc timeout          → miss_count++
│   ├── miss_count = 1-2      → app.status = "degraded"
│   └── miss_count >= 3       → app.status = "offline" (ngừng route)
└── Connection refused         → app.status = "offline" ngay

Khi app từ offline → healthy lại:
├── Reset miss_count
├── app.status = "active"
├── Gọi GET /manifest → check nếu capabilities thay đổi
└── Thông báo AI Brain
```

---

## 4. Gateway — Điều Phối Request

### 4.1 Luồng xử lý

```
User/AI request
    │
    ▼
┌─────────────┐
│ Auth Check   │ → Verify user session / API key
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Rate Limiter │ → Per-user, per-app, global limits
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Router       │ → Xác định app + capability từ request
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ App Check    │ → App đang active? Capability tồn tại?
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Input        │ → Validate input theo capability's input_schema
│ Validation   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Forward      │ → POST {app.base_url}/execute
│ Request      │   + Authorization: Bearer {app_token}
│              │   + X-Request-ID, X-Hub-User-ID
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Response     │ → Validate output, log, cache if needed
│ Handler      │
└──────┬──────┘
       │
       ▼
Return to caller (UI / AI Brain / Workflow Engine)
```

### 4.2 Cách Gateway tìm đúng app

```typescript
// Gateway nhận request: "Tôi cần quét nhóm Zalo"
//
// Cách 1: Explicit — caller chỉ định app + capability
gateway.execute("zalo-outreach", "scan-group-members", input);

// Cách 2: Discovery — AI Brain chỉ biết "tôi cần scan group"
//   Gateway tìm trong app_capabilities table:
//   SELECT * FROM app_capabilities
//   WHERE category = 'analysis'
//   AND (name LIKE '%scan%' OR description LIKE '%group%member%')
//   → Tìm thấy: zalo-outreach.scan-group-members
//   → Return cho AI Brain chọn

// Cách 3: Workflow — đã map sẵn step → capability
workflow.steps[0] = {
  app_id: "zalo-outreach",
  capability_id: "scan-group-members",
  input_mapping: { group_links: "{{trigger.links}}" }
}
```

---

## 5. Workflow Engine — Nối Chuỗi App

### 5.1 Workflow Definition

```jsonc
{
  "id": "wf_auto_outreach",
  "name": "Auto Outreach từ nhóm Zalo",
  "trigger": "manual",       // manual | schedule | event
  "steps": [
    {
      "id": "step_1",
      "name": "Quét nhóm",
      "app_id": "zalo-outreach",
      "capability_id": "scan-group-members",
      "input": {
        "group_links": "{{trigger.group_links}}"     // Từ trigger input
      },
      "on_success": "step_2",
      "on_failure": "stop"
    },
    {
      "id": "step_2",
      "name": "AI Lọc & soạn tin",
      "type": "ai_brain",                            // Không gọi app con, Hub AI xử lý
      "action": "filter_and_compose",
      "input": {
        "members": "{{step_1.output.groups[*].members}}",
        "product": "{{trigger.product_name}}",
        "instructions": "Lọc bỏ admin. Soạn tin nhắn cá nhân hóa theo tên, nhóm. Tạo 3 variants."
      },
      "on_success": "step_3"
    },
    {
      "id": "step_3",
      "name": "Tạo campaign & gửi",
      "app_id": "zalo-outreach",
      "capability_id": "run-campaign",
      "input": {
        "campaign_name": "{{trigger.campaign_name}}",
        "contact_ids": "{{step_2.output.filtered_contact_ids}}",
        "template_id": "{{step_2.output.template_id}}",
        "settings": {
          "delay_min_seconds": 30,
          "delay_max_seconds": 90,
          "max_per_day": 50
        }
      },
      "on_success": "step_4"
    },
    {
      "id": "step_4",
      "name": "Theo dõi & AI reply",
      "type": "event_listener",                      // Chờ events
      "listen_for": "zalo:reply-received",
      "timeout": 86400,                              // 24h
      "on_event": {
        "type": "ai_brain",
        "action": "analyze_reply_and_respond",
        "input": {
          "reply": "{{event.payload}}",
          "context": "{{step_2.output.context}}",
          "product": "{{trigger.product_name}}"
        }
      }
    }
  ]
}
```

### 5.2 Step Types

```
Có 4 loại step:

1. app_call — Gọi capability của app con
   {
     "type": "app_call",  (hoặc không có type → mặc định)
     "app_id": "zalo-outreach",
     "capability_id": "scan-group-members",
     "input": { ... }
   }

2. ai_brain — Hub AI xử lý (không gọi app con)
   {
     "type": "ai_brain",
     "action": "filter_and_compose",
     "input": { ... },
     "instructions": "Prompt cho AI"
   }

3. condition — Rẽ nhánh theo điều kiện
   {
     "type": "condition",
     "if": "{{step_1.output.total_members}} > 100",
     "then": "step_large_group",
     "else": "step_small_group"
   }

4. event_listener — Chờ event rồi phản ứng
   {
     "type": "event_listener",
     "listen_for": "zalo:reply-received",
     "timeout": 86400,
     "on_event": { ... sub-step ... }
   }
```

### 5.3 Data Mapping giữa Steps

```
Output step A → Input step B

Syntax: {{step_id.output.field.nested_field}}

Ví dụ:
├── {{step_1.output.groups[0].group_name}}
├── {{step_1.output.total_members_found}}
├── {{step_2.output.filtered_contact_ids}}
├── {{trigger.group_links}}              ← Từ trigger input
├── {{event.payload.contact_name}}       ← Từ event data
└── {{env.DEFAULT_DELAY}}               ← Từ environment

Hub validate type compatibility:
├── step_1 output schema có field "groups"? ✓
├── step_2 input schema nhận array? ✓
├── Type match (string → string, number → number)? ✓
└── Nếu không match → Hub hiện warning, suggest transform
```

---

## 6. Event Bus — Pub/Sub

### 6.1 Luồng event

```
App con emit event
    │
    ▼
Hub Event Bus nhận
    │
    ├──→ Lưu vào hub_activity_log
    │
    ├──→ Check subscribers:
    │    App nào subscribe event_type này?
    │    → Forward đến từng subscriber
    │
    ├──→ Check workflows:
    │    Workflow nào có event_listener cho event này?
    │    → Trigger workflow step
    │
    └──→ Check AI Brain:
         Event này cần AI xử lý?
         → Gửi cho AI Brain (ví dụ: reply-received → AI phân tích)
```

### 6.2 Namespace Rules

```
QUAN TRỌNG — Tránh conflict giữa app con:

Event namespace = app_id (hoặc "hub" cho system events)

Ví dụ:
├── zalo-outreach:group-scanned        ← Chỉ zalo-outreach emit
├── zalo-outreach:reply-received       ← Chỉ zalo-outreach emit
├── seo-master:analysis-complete       ← Chỉ seo-master emit
├── design-studio:image-created        ← Chỉ design-studio emit
├── hub:app-installed                  ← Chỉ Hub emit
└── hub:workflow-completed             ← Chỉ Hub emit

Rules:
1. App con CHỈ được emit events với prefix = app_id của mình
2. Hub enforce: reject event nếu prefix không khớp sender
3. App con có thể SUBSCRIBE bất kỳ event nào (nếu có permission)
4. Hub events (hub:*) không ai giả mạo được

Khi thêm app mới:
├── App ID unique → event namespace tự động unique
├── Không bao giờ conflict với app khác
└── Hub chỉ cần check prefix khi nhận event
```

---

## 7. Cách Thêm App Con Mới — Checklist

```
Khi muốn thêm app con mới (ví dụ: seo-master):

1. TẠO APP CON:
   ├── Copy template từ sdk/create-plugin (hoặc tạo từ đầu)
   ├── Viết manifest.json:
   │   ├── id: unique, kebab-case (ví dụ: "seo-master")
   │   ├── capabilities: liệt kê với input/output schema
   │   ├── events.emits: events app sẽ phát ra
   │   └── events.subscribes: events app muốn nhận
   ├── Implement required endpoints: /health, /manifest, /execute
   ├── Code logic cho từng capability
   └── Test độc lập (chạy riêng, gọi API trực tiếp)

2. ĐĂNG KÝ VỚI HUB:
   ├── Chạy app con trên port riêng (3011, 3012...)
   ├── Trên Hub UI: App Store → Add App → nhập base_url
   ├── Hub fetch manifest → validate → generate tokens
   ├── Hub hiển thị capabilities mới
   └── AI Brain tự biết có thêm tools mới

3. KHÔNG CẦN SỬA GÌ Ở HUB:
   ├── Hub đọc manifest → tự hiểu app mới làm được gì
   ├── AI Brain tự biết dùng capability mới khi phù hợp
   ├── Workflow Engine tự thêm option mới khi tạo workflow
   ├── Event Bus tự route events mới
   └── Dashboard tự hiện stats từ app mới

4. KHÔNG CONFLICT VỚI APP KHÁC:
   ├── App ID unique → namespace unique
   ├── Port riêng → không tranh chấp network
   ├── Database riêng → không tranh chấp data
   ├── Events prefix unique → không lẫn events
   └── Capabilities ID scoped theo app → không trùng
```

---

## 8. Hub Database — Tách biệt với App Con

```
QUAN TRỌNG: Hub và app con có DATABASE RIÊNG.

Hub Database (PostgreSQL):
├── users              — User đăng nhập Hub
├── apps               — App con đã đăng ký
├── app_capabilities   — Capabilities (từ manifests)
├── app_event_subscriptions
├── workflows          — Workflow definitions
├── workflow_runs      — Workflow execution history
├── hub_conversations  — AI Brain conversation tracking
├── hub_messages       — Tin nhắn qua Hub (tổng hợp từ các app)
├── hub_activity_log   — Audit trail
├── hub_settings       — Cài đặt Hub
└── hub_notifications  — Thông báo cho user

App Con Database (riêng biệt):
├── zalo-outreach: SQLite/PostgreSQL riêng (contacts, groups, campaigns...)
├── seo-master: DB riêng (sites, audits, keywords...)
├── design-studio: DB riêng (projects, assets, templates...)
└── Mỗi app tự quản lý data của mình

Nguyên tắc:
├── Hub KHÔNG truy cập trực tiếp DB của app con
├── App con KHÔNG truy cập trực tiếp DB của Hub
├── Mọi giao tiếp qua Plugin Protocol (HTTP API)
├── Hub lưu "bản copy tóm tắt" của data quan trọng
│   (ví dụ: hub_conversations lưu tóm tắt từ zalo conversations)
└── App con là source of truth cho data của mình
```

---

## 9. AI Brain — Cách Tích Hợp LLM

```
Hub AI Brain gọi LLM (Claude/GPT) khi cần suy nghĩ.
App con KHÔNG gọi LLM — chỉ trả data thô.

Hub cung cấp cho LLM:
├── System prompt: vai trò, quy tắc, giọng điệu
├── Available tools: danh sách capabilities từ TẤT CẢ app con
│   (tự động generate từ app_capabilities table)
├── Conversation history: lịch sử chat với user + contacts
├── Context: thông tin product, campaign đang chạy
└── Instructions: user muốn gì

LLM trả về:
├── Tool calls: "gọi zalo-outreach.scan-group-members với input X"
├── Text: "Tôi đã quét được 150 thành viên, gợi ý tạo campaign..."
├── Decisions: "contact này quan tâm, nên follow up"
└── Content: tin nhắn soạn sẵn, báo cáo tóm tắt

Ví dụ LLM tool definition (auto-generated từ manifest):
{
  "name": "zalo_outreach__scan_group_members",
  "description": "Quét toàn bộ thành viên từ link nhóm Zalo mà KHÔNG cần tham gia nhóm",
  "parameters": {
    // Lấy trực tiếp từ capability.input_schema
    "group_links": { "type": "array", "items": { "type": "string" } },
    "account_id": { "type": "string" }
  }
}

Hub tự động tạo tool definitions cho LLM từ TẤT CẢ capabilities
đã đăng ký. Thêm app mới = thêm tools cho AI tự động.
```

---

## 10. Port Allocation & Naming Convention

```
Để tránh conflict khi chạy nhiều app:

PORT ALLOCATION:
├── Hub:              3000
├── zalo-outreach:    3010
├── seo-master:       3011
├── design-studio:    3012
├── social-manager:   3013
├── content-writer:   3014
├── analytics-hub:    3015
├── email-campaign:   3016
├── ad-manager:       3017
├── video-editor:     3018
├── chatbot-builder:  3019
├── website-monitor:  3020
└── Reserved:         3021-3099 (cho app con mới)

NAMING CONVENTION:
├── App ID:           kebab-case, unique    (zalo-outreach)
├── Capability ID:    kebab-case            (scan-group-members)
├── Event type:       app_id:action         (zalo-outreach:reply-received)
├── Env var prefix:   UPPER_SNAKE           (ZALO_OUTREACH_PORT=3010)
├── Database name:    snake_case            (zalo_outreach_db)
└── Docker service:   kebab-case            (zalo-outreach)
```

---

## 11. Tóm Tắt: Ai Làm Gì

```
╔═══════════════╦════════════════════════════════════════╗
║   Component   ║              Trách nhiệm              ║
╠═══════════════╬════════════════════════════════════════╣
║ Hub UI        ║ Giao diện duy nhất. Dashboard, chat,  ║
║               ║ workflow builder, app store.           ║
╠═══════════════╬════════════════════════════════════════╣
║ Hub AI Brain  ║ Suy nghĩ, ra quyết định, soạn nội    ║
║               ║ dung, phân loại, ưu tiên.             ║
╠═══════════════╬════════════════════════════════════════╣
║ Hub Gateway   ║ Auth, rate limit, route request đến   ║
║               ║ đúng app con.                         ║
╠═══════════════╬════════════════════════════════════════╣
║ Hub Workflow  ║ Nối chuỗi capabilities, map data      ║
║ Engine        ║ giữa các step, handle errors.         ║
╠═══════════════╬════════════════════════════════════════╣
║ Hub Event Bus ║ Nhận events từ app con, forward cho   ║
║               ║ subscribers, trigger workflows.        ║
╠═══════════════╬════════════════════════════════════════╣
║ App Registry  ║ Quản lý app con: cài/gỡ/health/token ║
╠═══════════════╬════════════════════════════════════════╣
║ App Con       ║ CHỈ thực thi lệnh + trả data thô.    ║
║ (zalo, seo...)║ Không UI, không AI, không quyết định. ║
╚═══════════════╩════════════════════════════════════════╝
```
