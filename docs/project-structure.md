# Project Structure

```
trung-tam-ket-noi/
│
├── docs/                              # Tài liệu chung
│   ├── plugin-protocol.md             # Giao thức kết nối (spec gốc)
│   ├── project-structure.md           # File này
│   └── common-data-types.json         # Shared JSON Schema definitions
│
├── sdk/                               # Shared SDK cho app con
│   ├── plugin-base/                   # Base server template
│   ├── shared-types/                  # TypeScript types chung
│   └── create-plugin/                 # CLI tạo app con mới
│
├── hub/                               # App Trung Tâm
│   ├── src/
│   │   ├── app/                       # Frontend (Next.js App Router)
│   │   │   ├── dashboard/             # Trang tổng hợp
│   │   │   ├── apps/                  # App Store + trang từng app
│   │   │   ├── workflows/            # Tạo & quản lý workflow
│   │   │   └── settings/             # Cài đặt hệ thống
│   │   ├── gateway/                   # Plugin Gateway
│   │   │   ├── router.ts             # Route request đến app con
│   │   │   ├── auth.ts               # Xác thực token
│   │   │   ├── rate-limiter.ts       # Rate limiting
│   │   │   └── health-monitor.ts     # Theo dõi health app con
│   │   ├── event-bus/                 # Hệ thống event
│   │   │   ├── emitter.ts
│   │   │   ├── subscriber.ts
│   │   │   └── dead-letter.ts
│   │   └── workflow-engine/           # Engine chạy workflow
│   │       ├── executor.ts
│   │       ├── scheduler.ts
│   │       └── mapper.ts             # Map output → input giữa apps
│   └── package.json
│
├── apps/                              # Thư mục chứa tất cả App Con
│   ├── seo-master/                    # App SEO
│   │   ├── manifest.json
│   │   ├── src/
│   │   ├── README.md
│   │   ├── CHANGELOG.md
│   │   └── .env.example
│   ├── design-studio/                 # App Thiết kế
│   ├── social-manager/                # App Quản lý MXH
│   ├── content-writer/                # App Viết nội dung
│   └── .../                           # Thêm app con khác
│
├── CLAUDE.md                          # Quy trình phát triển
└── README.md                          # Giới thiệu project tổng thể
```

## Quy ước đặt tên

| Đối tượng | Quy ước | Ví dụ |
|-----------|---------|-------|
| App ID | kebab-case | `seo-master`, `design-studio` |
| Capability ID | kebab-case | `analyze-page-seo`, `create-thumbnail` |
| Event type | `namespace:action` | `seo:analysis-complete` |
| API endpoint | REST, lowercase | `GET /health`, `POST /execute` |
| Thư mục app con | Trùng app ID | `apps/seo-master/` |
| Env vars | UPPER_SNAKE_CASE | `DATABASE_URL`, `HUB_TOKEN` |
