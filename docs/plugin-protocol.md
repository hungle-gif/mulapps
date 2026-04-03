# Plugin Protocol Specification v1.0

> Tài liệu gốc định nghĩa giao thức kết nối giữa App Trung Tâm (Hub) và các App Con (Plugins).
> Mọi app con PHẢI tuân theo spec này để tích hợp được với Hub.
> Ngày tạo: 2026-03-31

---

## 1. Tổng Quan Kiến Trúc

```
┌──────────────────────────────────────────────────────┐
│                    APP TRUNG TÂM (Hub)               │
│                                                      │
│  ┌───────────┐  ┌───────────┐  ┌──────────────────┐ │
│  │ Dashboard  │  │ App Store │  │ Workflow Engine   │ │
│  │ (tổng hợp │  │ (cài đặt, │  │ (nối app con lại │ │
│  │  dữ liệu) │  │  gỡ app)  │  │  thành pipeline) │ │
│  └─────┬─────┘  └─────┬─────┘  └────────┬─────────┘ │
│        │               │                 │           │
│  ┌─────▼───────────────▼─────────────────▼─────────┐ │
│  │           Plugin Gateway (API Router)            │ │
│  │  - Xác thực request                             │ │
│  │  - Route đến đúng app con                       │ │
│  │  - Rate limiting, logging                       │ │
│  └─────────────────────┬───────────────────────────┘ │
└────────────────────────┼─────────────────────────────┘
                         │
            Plugin Protocol (HTTP REST + WebSocket)
                         │
        ┌────────────────┼────────────────┐
        │                │                │
   ┌────▼────┐     ┌────▼────┐     ┌────▼────┐
   │ SEO App │     │ Design  │     │ Social  │     ... N apps
   │         │     │   App   │     │   App   │
   │ :3001   │     │ :3002   │     │ :3003   │
   └─────────┘     └─────────┘     └─────────┘
   Mỗi app = 1 process độc lập, có DB riêng (nếu cần)
```

### Nguyên tắc cốt lõi

| # | Nguyên tắc | Giải thích |
|---|-----------|------------|
| 1 | **Độc lập hoàn toàn** | Mỗi app con chạy riêng, có thể deploy riêng, crash không ảnh hưởng app khác |
| 2 | **Tự mô tả** | App con khai báo mình làm được gì qua manifest — Hub đọc manifest để hiểu |
| 3 | **Giao thức chuẩn** | HTTP REST + JSON. Không phụ thuộc ngôn ngữ hay framework cụ thể |
| 4 | **UI nhúng được** | Mỗi app con có thể cung cấp giao diện nhúng vào Hub (iframe hoặc micro-frontend) |
| 5 | **Kết nối chuỗi** | Output của app A có thể là input của app B — cho phép tạo workflow |

---

## 2. App Manifest

Mỗi app con PHẢI có file `manifest.json` ở root và expose qua endpoint `GET /manifest`.

```jsonc
{
  // === THÔNG TIN CƠ BẢN ===
  "id": "seo-master",                    // Unique ID, kebab-case, không đổi sau khi publish
  "name": "SEO Master",                  // Tên hiển thị
  "version": "1.0.0",                    // Semantic versioning (MAJOR.MINOR.PATCH)
  "description": "Phân tích và tối ưu SEO cho website",
  "icon": "/assets/icon.svg",            // Icon 512x512, SVG hoặc PNG
  "author": {
    "name": "Team Name",
    "email": "team@example.com",
    "url": "https://example.com"
  },
  "license": "MIT",
  "repository": "https://github.com/...",

  // === KẾT NỐI ===
  "protocol_version": "1.0",             // Version của protocol spec này
  "base_url": "http://localhost:3001",    // URL gốc của app con (runtime config)
  "health_endpoint": "/health",           // Mặc định, có thể override

  // === NĂNG LỰC (Capabilities) ===
  "capabilities": [
    {
      "id": "analyze-page-seo",
      "name": "Phân tích SEO trang web",
      "description": "Quét 1 URL, trả về điểm SEO + danh sách vấn đề + gợi ý sửa",
      "category": "analysis",            // analysis | generation | transformation | management
      "input_schema": {                   // JSON Schema cho input
        "type": "object",
        "required": ["url"],
        "properties": {
          "url": {
            "type": "string",
            "format": "uri",
            "description": "URL cần phân tích"
          },
          "depth": {
            "type": "integer",
            "default": 1,
            "minimum": 1,
            "maximum": 10,
            "description": "Số trang con cần crawl thêm"
          }
        }
      },
      "output_schema": {                  // JSON Schema cho output
        "type": "object",
        "properties": {
          "score": { "type": "number", "minimum": 0, "maximum": 100 },
          "issues": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "severity": { "type": "string", "enum": ["critical", "warning", "info"] },
                "message": { "type": "string" },
                "suggestion": { "type": "string" }
              }
            }
          }
        }
      },
      "estimated_duration": 15000,        // ms — Hub dùng để hiển thị progress
      "is_async": false,                  // true = trả job_id, poll kết quả sau
      "rate_limit": {                     // Giới hạn riêng cho capability này
        "max_requests": 10,
        "window_seconds": 60
      }
    }
    // ... thêm capabilities khác
  ],

  // === TAGS & PHÂN LOẠI ===
  "tags": ["seo", "analysis", "website", "optimization"],
  "category": "marketing",               // marketing | design | development | social | analytics | content | other

  // === UI INTEGRATION ===
  "ui": {
    "dashboard_widget": {                 // Widget nhỏ hiện trên Dashboard Hub
      "url": "/embed/widget",
      "default_width": 400,
      "default_height": 300
    },
    "full_page": {                        // Trang đầy đủ khi click vào app
      "url": "/embed/full"
    },
    "settings_page": {                    // Trang cài đặt app
      "url": "/embed/settings"
    }
  },

  // === QUYỀN CẦN THIẾT ===
  "permissions": [
    "network:outbound",                   // Được gọi ra internet
    "storage:local",                      // Được lưu data local
    "hub:user-info",                      // Được đọc thông tin user từ Hub
    "hub:notifications"                   // Được gửi notification qua Hub
  ],

  // === EVENTS ===
  "events": {
    "emits": [                            // Events app con phát ra
      "seo:analysis-complete",
      "seo:issue-found"
    ],
    "subscribes": [                       // Events app con muốn nhận
      "hub:website-added",
      "content:page-published"
    ]
  },

  // === DEPENDENCIES ===
  "dependencies": {                       // App con khác mà app này cần
    "optional": ["content-manager"],      // Hoạt động tốt hơn nếu có, nhưng không bắt buộc
    "required": []                        // Bắt buộc phải cài mới chạy được
  }
}
```

### Quy tắc Manifest

| Quy tắc | Chi tiết |
|---------|---------|
| `id` | Kebab-case, 3-50 ký tự, unique toàn hệ thống, không đổi sau publish |
| `version` | Semver — MAJOR (breaking change), MINOR (feature mới), PATCH (fix bug) |
| `protocol_version` | PHẢI match version Hub hỗ trợ. Hub sẽ reject nếu không tương thích |
| `capabilities` | Tối thiểu 1 capability. Mỗi capability có input/output schema rõ ràng |
| `input_schema` / `output_schema` | JSON Schema draft 2020-12. Hub dùng để validate + tạo form tự động |
| `is_async` | `true` cho tác vụ > 30 giây. Hub sẽ poll hoặc nhận webhook khi xong |

---

## 3. API Contract — Các Endpoint Bắt Buộc

Mọi app con PHẢI expose các endpoint sau. Hub dùng chúng để quản lý và giao tiếp.

### 3.1 Health Check

```
GET /health

Response 200:
{
  "status": "healthy",           // "healthy" | "degraded" | "unhealthy"
  "version": "1.0.0",
  "uptime": 3600,                // seconds
  "checks": {                    // Chi tiết từng dependency
    "database": "healthy",
    "external_api": "healthy"
  }
}

Response 503 (unhealthy):
{
  "status": "unhealthy",
  "version": "1.0.0",
  "uptime": 3600,
  "checks": {
    "database": "unhealthy",
    "external_api": "healthy"
  },
  "error": "Database connection lost"
}
```

Hub gọi health check mỗi **30 giây**. Nếu 3 lần liên tiếp unhealthy → Hub đánh dấu app con là offline.

### 3.2 Manifest

```
GET /manifest

Response 200:
{ ...manifest.json content... }
```

Hub gọi khi app đăng ký lần đầu và khi app restart. Dùng để phát hiện thay đổi capabilities.

### 3.3 Execute Capability

```
POST /execute

Headers:
  Authorization: Bearer <hub_token>
  X-Request-ID: <uuid>           // Tracking ID, dùng cho logging + debugging
  X-Hub-User-ID: <user_id>       // User nào đang yêu cầu (nếu cần)

Request Body:
{
  "capability_id": "analyze-page-seo",
  "input": {
    "url": "https://example.com",
    "depth": 2
  },
  "options": {
    "timeout": 30000,             // ms — Hub mong muốn response trong thời gian này
    "priority": "normal",         // "low" | "normal" | "high"
    "callback_url": "https://hub.example.com/api/webhooks/result"  // Cho async tasks
  }
}

Response 200 (Sync — capability.is_async = false):
{
  "success": true,
  "request_id": "<uuid>",
  "capability_id": "analyze-page-seo",
  "data": {
    "score": 72,
    "issues": [
      {
        "severity": "critical",
        "message": "Thiếu meta description",
        "suggestion": "Thêm <meta name=\"description\"> vào <head>"
      }
    ]
  },
  "meta": {
    "duration_ms": 2340,
    "credits_used": 1
  }
}

Response 202 (Async — capability.is_async = true):
{
  "success": true,
  "request_id": "<uuid>",
  "job_id": "job_abc123",
  "status": "queued",
  "estimated_completion": "2026-03-31T17:00:00Z",
  "poll_url": "/jobs/job_abc123",
  "cancel_url": "/jobs/job_abc123/cancel"
}
```

### 3.4 Job Status (cho Async capabilities)

```
GET /jobs/:job_id

Response 200 (đang chạy):
{
  "job_id": "job_abc123",
  "status": "running",           // "queued" | "running" | "completed" | "failed" | "cancelled"
  "progress": 65,                // 0-100, null nếu không biết
  "started_at": "2026-03-31T16:55:00Z",
  "estimated_completion": "2026-03-31T17:00:00Z"
}

Response 200 (hoàn thành):
{
  "job_id": "job_abc123",
  "status": "completed",
  "progress": 100,
  "started_at": "2026-03-31T16:55:00Z",
  "completed_at": "2026-03-31T16:57:30Z",
  "result": {
    "score": 72,
    "issues": [...]
  }
}

DELETE /jobs/:job_id/cancel

Response 200:
{
  "job_id": "job_abc123",
  "status": "cancelled"
}
```

### 3.5 App Settings

```
GET /settings
→ Trả schema cài đặt của app (JSON Schema)
→ Hub dùng schema này để tự động render form settings

PUT /settings
→ Hub gửi cài đặt mới xuống app con

Response 200:
{
  "success": true,
  "settings": { ...current settings... }
}
```

---

## 4. Capability System — Chi Tiết

### 4.1 Phân loại Capability

```
CATEGORY:
├── analysis        — Phân tích, đánh giá, cho điểm
│   VD: Phân tích SEO, kiểm tra accessibility, audit performance
│
├── generation      — Tạo mới nội dung/tài sản
│   VD: Tạo ảnh banner, viết blog post, generate video thumbnail
│
├── transformation  — Biến đổi input thành output khác
│   VD: Resize ảnh, dịch văn bản, convert format
│
├── management      — Quản lý, lên lịch, tổ chức
│   VD: Lên lịch đăng bài, quản lý task, theo dõi ranking
│
└── monitoring      — Theo dõi, cảnh báo, báo cáo
    VD: Monitor uptime, track keyword ranking, alert khi có lỗi
```

### 4.2 Input/Output Schema Conventions

Để các app con có thể NỐI CHUỖI (output A → input B), cần thống nhất các data type phổ biến:

```jsonc
// === COMMON DATA TYPES ===
// Mọi app con nên dùng các type này khi input/output liên quan

// URL
{ "type": "string", "format": "uri", "$ref": "#/definitions/url" }

// Image
{
  "$ref": "#/definitions/image",
  "type": "object",
  "properties": {
    "url": { "type": "string", "format": "uri" },
    "width": { "type": "integer" },
    "height": { "type": "integer" },
    "format": { "type": "string", "enum": ["png", "jpg", "webp", "svg"] },
    "size_bytes": { "type": "integer" },
    "alt_text": { "type": "string" }
  }
}

// Text Content
{
  "$ref": "#/definitions/text_content",
  "type": "object",
  "properties": {
    "text": { "type": "string" },
    "format": { "type": "string", "enum": ["plain", "markdown", "html"] },
    "language": { "type": "string", "default": "vi" },
    "word_count": { "type": "integer" }
  }
}

// Social Post
{
  "$ref": "#/definitions/social_post",
  "type": "object",
  "properties": {
    "platform": { "type": "string", "enum": ["facebook", "instagram", "tiktok", "twitter", "linkedin", "youtube"] },
    "content": { "$ref": "#/definitions/text_content" },
    "media": { "type": "array", "items": { "$ref": "#/definitions/image" } },
    "scheduled_at": { "type": "string", "format": "date-time" },
    "hashtags": { "type": "array", "items": { "type": "string" } }
  }
}

// SEO Data
{
  "$ref": "#/definitions/seo_data",
  "type": "object",
  "properties": {
    "title": { "type": "string", "maxLength": 60 },
    "description": { "type": "string", "maxLength": 160 },
    "keywords": { "type": "array", "items": { "type": "string" } },
    "og_image": { "$ref": "#/definitions/image" },
    "score": { "type": "number", "minimum": 0, "maximum": 100 }
  }
}

// Website
{
  "$ref": "#/definitions/website",
  "type": "object",
  "properties": {
    "url": { "type": "string", "format": "uri" },
    "name": { "type": "string" },
    "pages": { "type": "array", "items": { "type": "string", "format": "uri" } }
  }
}

// Report
{
  "$ref": "#/definitions/report",
  "type": "object",
  "properties": {
    "title": { "type": "string" },
    "summary": { "type": "string" },
    "score": { "type": "number" },
    "sections": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "heading": { "type": "string" },
          "content": { "$ref": "#/definitions/text_content" },
          "data": { "type": "object" }
        }
      }
    },
    "generated_at": { "type": "string", "format": "date-time" }
  }
}
```

### 4.3 Workflow — Nối Chuỗi Capabilities

Hub cho phép user tạo workflow bằng cách nối output → input:

```
Ví dụ Workflow: "Tạo bài đăng tối ưu SEO"

[Content App]                [SEO App]               [Design App]            [Social App]
generate-blog-post    →    analyze-page-seo    →    create-thumbnail    →    schedule-post
                            │                        │
output: text_content        │ output: seo_data       │ output: image
    ↓ map to input          │     ↓ map to input     │     ↓ map to input
input: text_content         │ input: seo_data        │ input: image
                            │   + text_content       │   + text_content
                            │                        │   + seo_data
```

Quy tắc nối:
- Output type của capability A phải KHỚP input type của capability B
- Hub kiểm tra schema compatibility TRƯỚC khi chạy workflow
- Nếu không khớp hoàn toàn, Hub hiển thị mapping UI để user map fields thủ công

---

## 5. Authentication & Authorization

### 5.1 Đăng ký App Con với Hub

```
Luồng đăng ký:

1. App con khởi động → gọi Hub API đăng ký:
   POST https://hub.example.com/api/apps/register
   {
     "manifest_url": "http://localhost:3001/manifest",
     "secret": "<shared_secret>"          // Bí mật dùng chung để xác thực ban đầu
   }

2. Hub fetch manifest → validate → lưu app info
3. Hub trả về:
   {
     "app_id": "seo-master",
     "hub_token": "hbt_xxxxxx",           // App con dùng token này gọi Hub API
     "app_token": "apt_xxxxxx",           // Hub dùng token này gọi App con
     "webhook_secret": "whs_xxxxxx",      // Dùng verify webhook signatures
     "registered_at": "2026-03-31T16:00:00Z"
   }

4. App con lưu hub_token → dùng khi cần gọi ngược Hub
5. Hub lưu app_token → dùng khi gọi xuống App con
```

### 5.2 Request Authentication

```
Mọi request từ Hub → App con:
Headers:
  Authorization: Bearer <app_token>
  X-Hub-Signature: sha256=<hmac_of_body>     // HMAC-SHA256 dùng webhook_secret
  X-Request-ID: <uuid>
  X-Timestamp: <unix_timestamp>              // Chống replay attack

Mọi request từ App con → Hub:
Headers:
  Authorization: Bearer <hub_token>
  X-App-ID: <app_id>
  X-Request-ID: <uuid>

Verification:
1. Check Authorization header có hợp lệ
2. Check X-Timestamp trong 5 phút gần nhất (chống replay)
3. Check X-Hub-Signature = HMAC-SHA256(body, webhook_secret)
4. Nếu 1 trong 3 fail → 401 Unauthorized
```

### 5.3 Permission System

```
Permissions mà app con có thể yêu cầu:

hub:user-info          — Đọc thông tin user (tên, email, avatar)
hub:user-settings      — Đọc/ghi user preferences
hub:notifications      — Gửi notification cho user qua Hub
hub:storage            — Dùng Hub's storage service (file upload, etc.)
hub:billing            — Truy cập billing info (credits, plan)

network:outbound       — Được gọi HTTP ra internet
network:websocket      — Được mở WebSocket connections

app:read:<app_id>      — Đọc data từ app con khác
app:execute:<app_id>   — Gọi execute capability của app con khác

storage:local          — Lưu data local (DB riêng)
storage:shared         — Đọc/ghi shared storage của Hub

User PHẢI approve permissions khi cài app (giống mobile app permissions).
App con KHÔNG được vượt quá permissions đã khai báo.
Hub enforce permissions ở Gateway layer.
```

---

## 6. Data Format Standards

### 6.1 Request/Response Format

```jsonc
// === MỌI response từ app con PHẢI theo format này ===

// Success
{
  "success": true,
  "data": { ... },                // Payload chính
  "meta": {                       // Metadata (optional)
    "duration_ms": 234,
    "page": 1,
    "total": 50,
    "credits_used": 1
  }
}

// Error
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",   // Machine-readable error code
    "message": "URL không hợp lệ", // Human-readable message (tiếng Việt)
    "details": [                  // Chi tiết lỗi (optional)
      {
        "field": "url",
        "message": "URL phải bắt đầu bằng https://"
      }
    ],
    "retry_after": null           // Seconds to wait before retry (cho rate limit)
  }
}
```

### 6.2 Error Codes chuẩn

| HTTP Status | Error Code | Khi nào dùng |
|-------------|-----------|--------------|
| 400 | `VALIDATION_ERROR` | Input không hợp lệ |
| 400 | `INVALID_CAPABILITY` | Capability ID không tồn tại |
| 401 | `UNAUTHORIZED` | Token không hợp lệ hoặc hết hạn |
| 403 | `FORBIDDEN` | Không có quyền thực hiện hành động này |
| 404 | `NOT_FOUND` | Resource không tìm thấy |
| 409 | `CONFLICT` | Xung đột (duplicate, concurrent edit) |
| 429 | `RATE_LIMITED` | Vượt quá giới hạn request |
| 500 | `INTERNAL_ERROR` | Lỗi server nội bộ |
| 502 | `UPSTREAM_ERROR` | App con gọi service bên ngoài bị lỗi |
| 503 | `SERVICE_UNAVAILABLE` | App con đang bảo trì hoặc quá tải |

### 6.3 Pagination

```jsonc
// Request
GET /api/resources?page=2&limit=20&sort=created_at&order=desc

// Response
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "page": 2,
    "limit": 20,
    "total": 150,
    "total_pages": 8,
    "has_next": true,
    "has_prev": true
  }
}
```

---

## 7. Event System

### 7.1 Cơ chế hoạt động

```
App Con phát Event → Hub nhận → Hub forward đến App Con đã subscribe

Ví dụ:
1. Content App publish bài mới → emit "content:page-published"
2. Hub nhận event
3. Hub kiểm tra ai subscribe "content:page-published"
4. SEO App đã subscribe → Hub forward event đến SEO App
5. SEO App tự động phân tích SEO cho bài mới
```

### 7.2 Event Format

```jsonc
// App con gửi event đến Hub:
POST https://hub.example.com/api/events
Authorization: Bearer <hub_token>

{
  "event_type": "seo:analysis-complete",
  "source_app": "seo-master",
  "timestamp": "2026-03-31T17:00:00Z",
  "data": {
    "url": "https://example.com/blog/post-1",
    "score": 85,
    "issues_count": 3
  },
  "metadata": {
    "request_id": "<uuid>",
    "user_id": "user_123"
  }
}

// Hub forward đến subscriber:
POST http://localhost:3002/webhooks/events
X-Hub-Signature: sha256=<hmac>
X-Event-Type: seo:analysis-complete

{
  "event_type": "seo:analysis-complete",
  "source_app": "seo-master",
  "timestamp": "2026-03-31T17:00:00Z",
  "data": { ... }
}
```

### 7.3 Event Naming Convention

```
Format: <app_namespace>:<action>

Ví dụ:
├── seo:analysis-complete
├── seo:issue-found
├── seo:score-changed
├── design:image-created
├── design:template-updated
├── social:post-published
├── social:post-scheduled
├── social:engagement-spike
├── content:page-published
├── content:page-updated
├── content:page-deleted
├── hub:app-installed              // Hub system events
├── hub:app-uninstalled
├── hub:user-registered
└── hub:website-added
```

### 7.4 Webhook Reliability

```
Hub đảm bảo:
├── Retry 3 lần nếu delivery fail (1s, 10s, 60s delay)
├── Dead letter queue: sau 3 lần fail → lưu vào DLQ, admin xem lại
├── Idempotency: mỗi event có unique ID, app con tự dedup
├── Ordering: KHÔNG đảm bảo thứ tự — app con phải handle out-of-order
└── Timeout: 10 giây — nếu app con không respond trong 10s → coi là fail

App con phải:
├── Respond 200 trong 10 giây (chỉ cần acknowledge, xử lý async)
├── Idempotent: nhận cùng event 2 lần → kết quả không đổi
├── Verify signature trước khi xử lý
└── Return 200 ngay cả khi chưa xử lý xong (acknowledge receipt)
```

---

## 8. UI Integration

### 8.1 Phương thức nhúng

```
Có 2 cách nhúng UI app con vào Hub:

CÁCH 1: iframe (Đơn giản, an toàn, isolation cao)
├── Hub tạo <iframe src="http://app-con:3001/embed/full">
├── Giao tiếp qua window.postMessage()
├── Ưu: isolation tốt, app con tự do chọn framework
├── Nhược: không share styles, cần message protocol

CÁCH 2: Web Components (Tích hợp sâu hơn)
├── App con expose <seo-dashboard> custom element
├── Hub load script + mount component
├── Ưu: share styles, native feel
├── Nhược: phức tạp hơn, ít isolation
```

### 8.2 iframe Message Protocol

```javascript
// === Hub → App Con ===
// Hub gửi context cho iframe:
iframe.contentWindow.postMessage({
  type: 'hub:init',
  payload: {
    user: { id: 'user_123', name: 'Nguyễn Văn A', role: 'admin' },
    theme: 'dark',                    // App con nên đồng bộ theme
    locale: 'vi',
    hub_api_url: 'https://hub.example.com/api',
    auth_token: 'temp_token_xxx'      // Short-lived token cho iframe
  }
}, 'http://localhost:3001');

// Hub gửi theme change:
iframe.contentWindow.postMessage({
  type: 'hub:theme-change',
  payload: { theme: 'light' }
}, '*');

// === App Con → Hub ===
// App con yêu cầu Hub navigate:
window.parent.postMessage({
  type: 'app:navigate',
  payload: { path: '/apps/content-manager/posts/123' }
}, 'https://hub.example.com');

// App con gửi notification:
window.parent.postMessage({
  type: 'app:notification',
  payload: {
    title: 'Phân tích hoàn tất',
    message: 'SEO score: 85/100',
    level: 'success'                  // 'info' | 'success' | 'warning' | 'error'
  }
}, 'https://hub.example.com');

// App con resize iframe:
window.parent.postMessage({
  type: 'app:resize',
  payload: { height: 800 }
}, 'https://hub.example.com');

// App con yêu cầu confirm dialog:
window.parent.postMessage({
  type: 'app:confirm',
  payload: {
    id: 'delete-confirm-123',
    title: 'Xác nhận xóa',
    message: 'Bạn có chắc muốn xóa mục này?',
    confirm_text: 'Xóa',
    cancel_text: 'Hủy'
  }
}, 'https://hub.example.com');
```

### 8.3 Theme Sync

```
App con PHẢI support nhận theme từ Hub và tự adapt:

Khi nhận message type: 'hub:init' hoặc 'hub:theme-change':
├── Đọc payload.theme ('light' | 'dark')
├── Apply CSS variables tương ứng
├── Hub cung cấp CSS variables file: /api/theme/variables.css
│   App con có thể import để dùng chung palette
└── Nếu app con dùng framework khác → map colors cho phù hợp
```

---

## 9. Versioning & Backward Compatibility

### 9.1 Protocol Versioning

```
Protocol version format: MAJOR.MINOR

MAJOR change (1.0 → 2.0):
├── Breaking changes trong API contract
├── Hub hỗ trợ version cũ thêm 6 tháng (deprecation period)
├── App con PHẢI upgrade trước deadline
└── Ví dụ: thay đổi format /execute endpoint

MINOR change (1.0 → 1.1):
├── Thêm endpoint mới (optional)
├── Thêm fields mới vào response (backward-compatible)
├── App con KHÔNG cần thay đổi
└── Ví dụ: thêm /metrics endpoint
```

### 9.2 App Versioning

```
App con dùng semantic versioning:
├── MAJOR: breaking changes trong capabilities (input/output schema thay đổi)
├── MINOR: thêm capabilities mới
├── PATCH: bug fixes, performance improvements

Khi app con update version:
1. Restart app → Hub gọi GET /manifest → phát hiện version mới
2. Hub so sánh capabilities cũ vs mới
3. Nếu breaking change → Hub thông báo admin
4. Nếu thêm capabilities → Hub tự cập nhật catalog
```

---

## 10. App Lifecycle

```
┌─────────────┐     Register      ┌──────────────┐
│  UNINSTALLED │ ───────────────→  │  REGISTERED   │
└─────────────┘                    │  (pending     │
                                   │   approval)   │
       ▲                           └──────┬───────┘
       │                                  │ Admin approve
       │ Uninstall                        ▼
       │                           ┌──────────────┐
       │                           │    ACTIVE     │ ←── Health: healthy
       │                           └──────┬───────┘
       │                                  │
       │              ┌───────────────────┼───────────────────┐
       │              ▼                   ▼                   ▼
       │       ┌─────────────┐    ┌──────────────┐    ┌─────────────┐
       │       │  DISABLED   │    │   DEGRADED   │    │   OFFLINE   │
       │       │ (admin tắt) │    │ (partial     │    │ (health     │
       │       │             │    │  failure)    │    │  check fail)│
       │       └──────┬──────┘    └──────────────┘    └─────────────┘
       │              │
       └──────────────┘

ACTIVE:    App hoạt động bình thường, Hub route requests đến
DEGRADED:  Một số checks fail, Hub hiển thị warning, vẫn route requests
OFFLINE:   Health check fail 3 lần liên tiếp, Hub ngừng route, hiển thị offline
DISABLED:  Admin chủ động tắt, Hub ngừng route
```

---

## 11. Checklist Cho Mỗi App Con

Khi phát triển xong 1 app con, kiểm tra checklist này trước khi tích hợp:

### Bắt buộc (MUST)

- [ ] `manifest.json` hợp lệ, đầy đủ fields required
- [ ] `GET /health` trả đúng format, response < 1 giây
- [ ] `GET /manifest` trả đúng manifest content
- [ ] `POST /execute` hoạt động cho MỌI capability đã khai báo
- [ ] Input validation: reject input không khớp schema, trả error rõ ràng
- [ ] Output format: đúng chuẩn `{ success, data, meta }` hoặc `{ success, error }`
- [ ] Auth: verify `Authorization` header ở mọi endpoint
- [ ] Error handling: không crash, không leak stack trace
- [ ] Timeout: mọi sync capability respond < 30 giây
- [ ] Async capabilities (nếu có): `GET /jobs/:id` hoạt động đúng

### Nên có (SHOULD)

- [ ] UI embed: `/embed/widget` và `/embed/full` responsive, support dark/light theme
- [ ] Theme sync: nhận và apply theme từ Hub qua postMessage
- [ ] Events: emit events đúng format khi có thay đổi quan trọng
- [ ] Webhook handler: nhận và xử lý events từ Hub
- [ ] Settings: `GET /settings` + `PUT /settings` hoạt động
- [ ] Logging: structured JSON logs, include request_id
- [ ] Graceful shutdown: handle SIGTERM, complete in-flight requests

### Tài liệu (DOCS)

- [ ] README.md: mô tả app, cách cài đặt, cách chạy
- [ ] API docs: mô tả chi tiết mỗi capability (input, output, examples)
- [ ] CHANGELOG.md: ghi nhận mọi thay đổi theo version
- [ ] `.env.example`: liệt kê biến môi trường cần thiết

---

## 12. Shared SDK (Optional)

Để tăng tốc phát triển app con, Hub cung cấp SDK helper:

```
sdk/
├── plugin-base/           # Base class/template cho app con
│   ├── src/
│   │   ├── server.ts      # Express/Fastify server with required endpoints pre-wired
│   │   ├── auth.ts        # Verify Hub token, sign responses
│   │   ├── health.ts      # Health check implementation
│   │   ├── manifest.ts    # Load & serve manifest.json
│   │   ├── events.ts      # Emit events to Hub, receive webhooks
│   │   ├── ui-bridge.ts   # postMessage helpers for iframe integration
│   │   └── types.ts       # TypeScript types for all protocol structures
│   └── package.json
│
├── shared-types/          # Shared TypeScript types
│   ├── src/
│   │   ├── manifest.ts    # Manifest type definitions
│   │   ├── api.ts         # Request/Response types
│   │   ├── events.ts      # Event types
│   │   ├── common.ts      # Common data types (image, text_content, etc.)
│   │   └── index.ts
│   └── package.json
│
└── create-plugin/         # CLI scaffold tool
    └── ... (tạo project template cho app con mới)
```

### Sử dụng SDK

```typescript
// Ví dụ: App con dùng SDK để setup nhanh

import { createPluginServer } from '@hub/plugin-base';
import manifest from './manifest.json';

const app = createPluginServer({
  manifest,
  capabilities: {
    'analyze-page-seo': async (input, context) => {
      // input đã được validate theo input_schema trong manifest
      const result = await analyzeSeo(input.url, input.depth);
      return {
        score: result.score,
        issues: result.issues,
      };
      // SDK tự wrap vào { success: true, data: ... }
    },

    'generate-meta-tags': async (input, context) => {
      const tags = await generateMeta(input.content);
      return tags;
    },
  },
  events: {
    'content:page-published': async (event) => {
      // Tự động chạy SEO analysis khi có bài mới
      await analyzeSeo(event.data.url);
    },
  },
  settings: {
    schema: settingsSchema,
    onChange: async (newSettings) => {
      // Handle settings change
    },
  },
});

app.start(3001);
// Server sẵn sàng với: /health, /manifest, /execute, /jobs, /settings, /webhooks
```

---

## 13. Ví Dụ Danh Sách App Con Dự Kiến

| # | App ID | Tên | Category | Capabilities chính |
|---|--------|-----|----------|-------------------|
| 1 | `seo-master` | SEO Master | marketing | Phân tích SEO, audit site, gợi ý keywords, theo dõi ranking |
| 2 | `design-studio` | Design Studio | design | Tạo banner, resize ảnh, remove bg, tạo mockup, OG image |
| 3 | `social-manager` | Social Manager | social | Lên lịch đăng bài, quản lý đa nền tảng, analytics engagement |
| 4 | `content-writer` | Content Writer | content | Viết blog, rewrite, tóm tắt, dịch, kiểm tra chính tả |
| 5 | `analytics-hub` | Analytics Hub | analytics | Tổng hợp data GA, Search Console, social metrics |
| 6 | `email-campaign` | Email Campaign | marketing | Tạo email template, quản lý subscriber, A/B test |
| 7 | `ad-manager` | Ad Manager | marketing | Quản lý quảng cáo FB/Google, tối ưu budget, báo cáo |
| 8 | `video-editor` | Video Editor | content | Cắt ghép video, thêm subtitle, tạo thumbnail |
| 9 | `chatbot-builder` | Chatbot Builder | development | Tạo chatbot cho website, Messenger, Zalo |
| 10 | `website-monitor` | Website Monitor | monitoring | Uptime, speed test, SSL check, alert |

---

## 14. Quy Trình Phát Triển App Con

```
Mỗi app con đi qua 4 bước:

1. SPEC       — Viết manifest.json chi tiết (capabilities, input/output schema)
2. BUILD      — Code app con theo CLAUDE.md (4 phases)
3. INTEGRATE  — Verify checklist Section 11, test kết nối với Hub
4. PUBLISH    — Register vào Hub, admin approve, user có thể cài

Thứ tự build app con: ƯU TIÊN app nào có nhiều capabilities nối được với app khác
→ Gợi ý: SEO App hoặc Content Writer đầu tiên (nhiều output dùng chung)
```
