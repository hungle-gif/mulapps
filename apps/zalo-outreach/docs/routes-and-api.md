# Zalo Outreach — Routes & API Endpoints

## 1. Tất Cả Trang (Frontend Routes)

```
TRANG                         AUTH?   MÔ TẢ
─────────────────────────────────────────────────────────────────────
/                              No     Landing / redirect → /dashboard
/login                         No     Đăng nhập Zalo qua QR Code
/dashboard                     Yes    Tổng quan: stats, recent activity
/groups                        Yes    Danh sách nhóm đã quét
/groups/scan                   Yes    Quét nhóm mới (paste link)
/groups/:id                    Yes    Chi tiết nhóm + danh sách thành viên
/contacts                      Yes    Tất cả contacts + tìm kiếm/lọc
/contacts/:id                  Yes    Chi tiết contact + lịch sử hội thoại
/campaigns                     Yes    Danh sách chiến dịch
/campaigns/new                 Yes    Tạo chiến dịch mới
/campaigns/:id                 Yes    Chi tiết chiến dịch + progress realtime
/templates                     Yes    Quản lý mẫu tin nhắn
/templates/new                 Yes    Tạo mẫu tin nhắn mới
/templates/:id/edit            Yes    Sửa mẫu tin nhắn
/conversations                 Yes    Tất cả hội thoại (inbox-style)
/conversations/:id             Yes    Chi tiết hội thoại, chat realtime
/accounts                      Yes    Quản lý tài khoản Zalo
/settings                      Yes    Cài đặt app
/embed/widget                  Yes    Widget nhúng vào Hub Dashboard
/embed/full                    Yes    Trang đầy đủ nhúng vào Hub
/embed/settings                Yes    Settings nhúng vào Hub
─────────────────────────────────────────────────────────────────────
Tổng: 19 trang
```

### Chi tiết từng trang

#### `/login` — Đăng nhập Zalo
```
Components:
├── QR Code display (từ zca-js loginQR)
├── Trạng thái: đang chờ quét / đã quét / thành công / hết hạn
├── Nút refresh QR
├── Hướng dẫn: mở Zalo → quét mã
└── Nếu đã login → redirect /dashboard

States:
├── Default: hiển thị QR + hướng dẫn
├── Scanning: "Đang chờ xác nhận trên điện thoại..."
├── Success: "Đăng nhập thành công!" → redirect
├── Expired: "Mã QR hết hạn" + nút tạo lại
└── Error: "Không thể kết nối Zalo"
```

#### `/dashboard` — Tổng quan
```
Layout: Grid cards + charts

Cards thống kê:
├── Tổng contacts          | Mới hôm nay
├── Tổng nhóm đã quét     | Quét gần nhất
├── Tin nhắn đã gửi       | Hôm nay
├── Tỷ lệ reply           | So với tuần trước
├── Contacts quan tâm     | Mới
└── Campaigns đang chạy   | Tiến độ

Charts:
├── Line chart: messages sent / replies / interested theo ngày (7-30 ngày)
├── Pie chart: phân bổ outreach_status của contacts
└── Bar chart: top 5 nhóm theo số contacts

Recent Activity:
├── Danh sách 10 hoạt động gần nhất
│   ├── "Quét nhóm [ABC] — 150 thành viên" — 5 phút trước
│   ├── "Nguyễn Văn A đã reply" — 10 phút trước
│   └── ...
└── Link "Xem tất cả"

Quick Actions:
├── [Quét nhóm mới] → /groups/scan
├── [Tạo chiến dịch] → /campaigns/new
└── [Xem inbox] → /conversations
```

#### `/groups` — Danh sách nhóm
```
Components:
├── Search bar (tìm theo tên nhóm)
├── Filter: status (active / link_expired / archived)
├── Sort: tên / số thành viên / ngày quét
├── Grid/Table toggle
├── Nút [+ Quét nhóm mới]

Table columns:
├── Avatar + Tên nhóm
├── Link mời (truncated, copy button)
├── Tổng thành viên
├── Đã quét
├── Lần quét gần nhất
├── Status badge
└── Actions: [Quét lại] [Xem] [Xóa]

States: Default, Empty ("Chưa quét nhóm nào"), Loading (skeleton)
```

#### `/groups/scan` — Quét nhóm mới
```
Components:
├── Textarea: paste nhiều link (1 link/dòng)
├── Validate links realtime (regex check format)
├── Chọn tài khoản Zalo (nếu có nhiều)
├── Nút [Bắt đầu quét]
├── Progress: danh sách từng link + status + progress bar
│   ├── https://zalo.me/g/ABC — ✅ 150 thành viên
│   ├── https://zalo.me/g/DEF — ⏳ Đang quét (65%)...
│   └── https://zalo.me/g/GHI — ❌ Link hết hạn
└── Summary khi xong: X nhóm, Y thành viên, Z mới

States: Input, Scanning (realtime progress), Completed, Partial Error
```

#### `/groups/:id` — Chi tiết nhóm
```
Components:
├── Header: avatar + tên + mô tả + stats
├── Tab: [Thành viên] [Lịch sử quét] [Campaigns]
├── Tab Thành viên:
│   ├── Search + Filter (status, role)
│   ├── Bulk actions: [Chọn tất cả] [Thêm vào campaign] [Tag]
│   ├── Table: avatar, tên, status, nhóm vai trò, actions
│   └── Pagination
├── Tab Lịch sử quét: danh sách scan jobs
└── Tab Campaigns: campaigns liên quan đến nhóm này
```

#### `/contacts` — Tất cả contacts
```
Components:
├── Search bar (tìm theo tên, zalo name)
├── Filters:
│   ├── Outreach status: new / sent / replied / interested / not_interested / blocked
│   ├── Nhóm: multi-select
│   ├── Tags: multi-select
│   └── Ngày quét: date range
├── Sort: tên / ngày quét / ngày liên hệ / interest score
├── Bulk actions: [Thêm vào campaign] [Đặt tag] [Export] [Xóa]
├── Table: avatar, tên, nhóm(s), status badge, interest score, last contacted, actions
├── Pagination (20/trang)
└── Nút [Export CSV/JSON]

States: Default, Empty, Loading, Filtered (hiện filter tags)
```

#### `/contacts/:id` — Chi tiết contact
```
Layout: 2 cột (info bên trái, chat bên phải)

Cột trái (30%):
├── Avatar lớn + tên
├── Zalo ID, Zalo name
├── Outreach status (dropdown đổi manual)
├── Interest score (slider 0-100)
├── Tags (thêm/xóa)
├── Nhóm(s) contact thuộc
├── Notes (editable textarea)
├── Lịch sử:
│   ├── Quét từ nhóm [ABC] — 15/03
│   ├── Gửi tin qua campaign [XYZ] — 16/03
│   └── Reply — 16/03
└── Campaigns đã tham gia

Cột phải (70%):
├── Chat-style conversation view
├── Mỗi tin nhắn: nội dung, thời gian, direction (in/out)
├── Input gửi tin nhắn thủ công (nếu muốn)
└── Status: online/offline (nếu biết)
```

#### `/campaigns` — Danh sách chiến dịch
```
Components:
├── Filter: status (draft / running / paused / completed)
├── Sort: tên / ngày tạo / tiến độ
├── Nút [+ Tạo chiến dịch]
├── Cards hoặc Table:
│   ├── Tên campaign
│   ├── Status badge (color-coded)
│   ├── Progress bar (sent/total)
│   ├── Stats mini: sent | replied | interested
│   ├── Template dùng
│   └── Actions: [Xem] [Pause/Resume] [Xóa]
└── Pagination
```

#### `/campaigns/new` — Tạo chiến dịch
```
Wizard 4 bước:

Step 1: Thông tin cơ bản
├── Tên chiến dịch
├── Mô tả (optional)
└── Chọn tài khoản Zalo gửi

Step 2: Chọn contacts
├── Chọn theo nhóm (tick nhóm → auto thêm tất cả contacts)
├── Chọn theo filter (status, tags)
├── Chọn thủ công (search + tick từng người)
├── Loại trừ: đã liên hệ trong campaign khác, đã block
└── Preview: "Sẽ gửi cho X contacts"

Step 3: Soạn tin nhắn
├── Chọn template có sẵn HOẶC
├── Soạn mới (editor với biến {tên}, {nhóm})
├── Thêm variants (tối thiểu 2-3 phiên bản)
├── Preview: hiển thị tin nhắn với data thật của 1 contact mẫu
└── Lưu template (optional)

Step 4: Cài đặt & Xác nhận
├── Delay: min __ giây — max __ giây
├── Giới hạn: max __ tin/ngày
├── Khung giờ: từ __:__ đến __:__
├── Lên lịch: gửi ngay / hẹn giờ
├── Summary: X contacts, template Y, delay Z
└── Nút [Bắt đầu chiến dịch]
```

#### `/campaigns/:id` — Chi tiết chiến dịch
```
Components:
├── Header: tên + status + progress bar
├── Controls: [Pause] [Resume] [Stop] [Edit settings]
├── Stats cards: sent / replied / interested / not_interested / failed
├── Charts:
│   ├── Funnel: total → sent → replied → interested → converted
│   └── Timeline: messages sent theo giờ
├── Tab: [Contacts] [Messages] [Settings] [Logs]
├── Tab Contacts: table với status, sent_at, replied_at
├── Tab Messages: danh sách tin nhắn đã gửi
├── Tab Settings: delay, limit, active hours (editable)
└── Tab Logs: activity log (queue events, errors)
```

#### `/templates` — Quản lý mẫu tin nhắn
```
Components:
├── Nút [+ Tạo mẫu mới]
├── Cards grid:
│   ├── Tên template
│   ├── Preview nội dung (truncated)
│   ├── Category badge
│   ├── Stats: dùng X lần, reply rate Y%
│   └── Actions: [Edit] [Duplicate] [Delete]
└── Filter: category

Editor:
├── Tên template
├── Category dropdown
├── Content editor (markdown-lite, hỗ trợ biến)
├── Variants section: thêm/xóa phiên bản
├── Preview panel (realtime, data mẫu)
└── Tips: "Dùng ít nhất 3 variants để tránh bị detect spam"
```

#### `/conversations` — Inbox
```
Layout: 2 cột (danh sách trái, chat phải) — giống Zalo/Messenger

Cột trái (35%):
├── Search contacts
├── Filter: tất cả / chưa đọc / quan tâm
├── Danh sách conversations:
│   ├── Avatar + tên
│   ├── Tin nhắn cuối (truncated)
│   ├── Thời gian
│   ├── Unread badge
│   └── Status dot (interested = xanh, not = đỏ)
└── Sort: mới nhất / chưa đọc trước

Cột phải (65%):
├── Chat header: avatar + tên + status + [Xem profile]
├── Chat messages (scroll, load more)
├── Input: gửi tin nhắn thủ công
└── Quick actions: [Đánh dấu quan tâm] [Không quan tâm] [Block]
```

#### `/accounts` — Quản lý tài khoản Zalo
```
Components:
├── Nút [+ Thêm tài khoản]
├── Cards:
│   ├── Avatar + tên + Zalo ID
│   ├── Status: active / expired / banned
│   ├── Last active
│   ├── Stats: X contacts, Y campaigns
│   └── Actions: [Set default] [Refresh session] [Xóa]
└── Cảnh báo nếu session sắp hết hạn
```

#### `/settings` — Cài đặt
```
Sections:
├── Mặc định gửi tin:
│   ├── Delay min/max (giây)
│   ├── Max tin nhắn/ngày
│   └── Khung giờ gửi
├── An toàn:
│   ├── Safety mode: Conservative / Normal / Aggressive
│   ├── Tự động dừng khi bị cảnh báo
│   └── Max retry per message
├── Thông báo:
│   ├── Thông báo khi có reply
│   ├── Thông báo khi campaign hoàn thành
│   └── Thông báo khi account bị warning
├── Hub Integration:
│   ├── Hub URL
│   ├── Hub Token
│   └── Test connection
└── Data:
    ├── Export all data
    ├── Import contacts
    └── Reset database (danger)
```

---

## 2. API Endpoints

### 2.1 Plugin Protocol — Bắt buộc (Hub giao tiếp)

```
GET    /health                          Health check
GET    /manifest                        Trả manifest.json
POST   /execute                         Execute capability (từ Hub)
GET    /jobs/:id                        Job status (async capabilities)
DELETE /jobs/:id/cancel                 Cancel job
GET    /settings                        Trả settings schema
PUT    /settings                        Cập nhật settings từ Hub
POST   /webhooks/events                 Nhận events từ Hub
```

### 2.2 Internal API — Zalo Accounts

```
POST   /api/auth/qr                     Tạo QR code login
POST   /api/auth/qr/status              Check QR scan status
POST   /api/auth/session                Lưu session sau khi login thành công
GET    /api/accounts                     List all Zalo accounts
GET    /api/accounts/:id                 Get account detail
PUT    /api/accounts/:id                 Update account (set default, notes)
DELETE /api/accounts/:id                 Xóa account
POST   /api/accounts/:id/refresh         Refresh session (re-auth)
GET    /api/accounts/:id/status          Check account connection status
```

### 2.3 Internal API — Groups

```
GET    /api/groups                       List groups (search, filter, sort, pagination)
GET    /api/groups/:id                   Get group detail
PUT    /api/groups/:id                   Update group (notes, status)
DELETE /api/groups/:id                   Soft delete group
POST   /api/groups/:id/rescan            Re-scan group members
GET    /api/groups/:id/members           List members of a group (pagination)

POST   /api/scan                         Start scanning (input: array of links)
GET    /api/scan/:jobId                  Get scan job progress
DELETE /api/scan/:jobId                  Cancel scan job
GET    /api/scan/history                 List all scan jobs
```

### 2.4 Internal API — Contacts

```
GET    /api/contacts                     List contacts (search, filter, sort, pagination)
GET    /api/contacts/:id                 Get contact detail
PUT    /api/contacts/:id                 Update contact (status, tags, notes, interest_score)
DELETE /api/contacts/:id                 Soft delete contact
PUT    /api/contacts/:id/status          Quick update outreach status
POST   /api/contacts/:id/tags            Add tags
DELETE /api/contacts/:id/tags/:tag       Remove tag
POST   /api/contacts/export              Export contacts (CSV/JSON, with filters)
POST   /api/contacts/bulk-action         Bulk update status/tags
```

### 2.5 Internal API — Campaigns

```
GET    /api/campaigns                    List campaigns (filter, sort, pagination)
POST   /api/campaigns                    Create campaign
GET    /api/campaigns/:id                Get campaign detail + stats
PUT    /api/campaigns/:id                Update campaign settings
DELETE /api/campaigns/:id                Soft delete campaign
POST   /api/campaigns/:id/start          Start/Resume campaign
POST   /api/campaigns/:id/pause          Pause campaign
POST   /api/campaigns/:id/stop           Stop (cancel) campaign
GET    /api/campaigns/:id/contacts       List contacts in campaign + their status
GET    /api/campaigns/:id/stats          Get detailed stats
GET    /api/campaigns/:id/logs           Get activity logs
```

### 2.6 Internal API — Templates

```
GET    /api/templates                    List templates (filter by category)
POST   /api/templates                    Create template
GET    /api/templates/:id                Get template detail
PUT    /api/templates/:id                Update template
DELETE /api/templates/:id                Soft delete template
POST   /api/templates/:id/duplicate      Duplicate template
POST   /api/templates/preview            Preview template with sample data
```

### 2.7 Internal API — Conversations & Messages

```
GET    /api/conversations                List conversations (filter: unread, interested)
GET    /api/conversations/:id            Get conversation detail
PUT    /api/conversations/:id            Update conversation (status, notes)
GET    /api/conversations/:id/messages   Get messages in conversation (pagination, oldest first)
POST   /api/conversations/:id/messages   Send manual message
PUT    /api/conversations/:id/read       Mark as read
```

### 2.8 Internal API — Dashboard & Stats

```
GET    /api/dashboard/stats              Tổng quan: contacts, groups, campaigns, messages
GET    /api/dashboard/activity           Recent activity log
GET    /api/dashboard/charts/messages    Messages sent/received by day
GET    /api/dashboard/charts/funnel      Conversion funnel data
GET    /api/dashboard/charts/groups      Top groups by contacts
```

### 2.9 WebSocket — Realtime

```
WS /ws/zalo-listener                     Lắng nghe tin nhắn mới từ Zalo
                                         → Push: new_message, message_status, account_status

WS /ws/campaign-progress                 Realtime campaign progress
                                         → Push: message_sent, message_replied, stats_update

WS /ws/scan-progress                     Realtime scan progress
                                         → Push: member_found, page_complete, scan_complete
```

---

## 3. Response Format (tuân theo Plugin Protocol)

```json
// Success
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "total_pages": 8
  }
}

// Error
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Link nhóm không hợp lệ",
    "details": [
      { "field": "group_links[0]", "message": "Phải bắt đầu bằng https://zalo.me/g/" }
    ]
  }
}
```
