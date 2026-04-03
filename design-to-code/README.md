# Module: Design-to-Code

> Thiết kế giao diện bằng Google Stitch SDK → Chuyển thành React/Next.js components chuẩn.
> KHÔNG tự code UI — Stitch thiết kế → convert sang code chuẩn.

---

## Cấu Trúc

```
modules/design-to-code/
├── README.md                         ← File này — AI đọc đầu tiên
├── scripts/
│   ├── stitch.sh                     ← Script chạy Stitch
│   ├── generate-ui.mjs               ← Gọi Stitch API, tải HTML/JPG
│   ├── convert-to-react.mjs          ← Chuyển Stitch HTML → React page
│   ├── visual-test.mjs               ← So sánh screenshot Stitch vs React
│   └── package.json                  ← Dependencies
├── prompts/
│   ├── prompt-guide.md               ← Hướng dẫn AI cách viết prompt Stitch
│   ├── design-brief-dark.md          ← Design brief dark theme
│   └── design-brief-light.md         ← Design brief light theme
└── design-system/
    ├── tailwind-base.config.ts       ← Tailwind config chuẩn (copy vào project)
    ├── tokens-dark.css               ← CSS variables dark theme
    └── tokens-light.css              ← CSS variables light theme
```

---

## Workflow

```
1. Đọc prompts/prompt-guide.md → hiểu cách viết prompt tốt
2. Chọn design brief (dark hoặc light) → đọc file tương ứng
3. Viết screens.json cho dự án (AI tự viết theo hướng dẫn)
4. Chạy: bash scripts/stitch.sh batch → generate HTML + screenshot
5. User duyệt screenshot
6. Chạy: node scripts/convert-to-react.mjs → ra React pages
7. Chạy: node scripts/visual-test.mjs → kiểm tra pixel-perfect
```

---

## Setup Cho Project Mới

```bash
# 1. Copy scripts vào project
cp -r modules/design-to-code/scripts/ my-project/scripts/

# 2. Copy design system
cp modules/design-to-code/design-system/tailwind-base.config.ts my-project/tailwind.config.ts
cp modules/design-to-code/design-system/tokens-dark.css my-project/src/styles/tokens.css
# (hoặc tokens-light.css nếu light theme)

# 3. Cài dependencies
cd my-project/scripts && npm install

# 4. Thêm API key
echo "STITCH_API_KEY=your_key" >> my-project/.env
```

---

## Cách Viết screens.json

AI đọc `prompts/prompt-guide.md` để biết chi tiết. Tóm tắt:

```json
[
  {
    "name": "ten-trang-kebab-case",
    "prompt": "Mô tả chi tiết trang... + design brief cuối prompt"
  }
]
```

Mỗi prompt gồm 3 phần:
1. **Mô tả trang** — trang gì, cho ai
2. **Layout + Components** — liệt kê từng phần tử, kích thước, vị trí, data mẫu
3. **Design brief** — copy từ design-brief-dark.md hoặc light.md → paste cuối

---

## Chạy Stitch

```bash
# Generate tất cả trang từ screens.json
bash scripts/stitch.sh batch

# Generate 1 trang
bash scripts/stitch.sh "Prompt chi tiết..." ten-trang

# Chỉ kiểm tra setup
bash scripts/stitch.sh setup
```

Output nằm trong `screenshots/stitch/`:
- `.html` — HTML + Tailwind (nguồn sự thật)
- `.jpg` — Screenshot preview
- `-design.md` — Design tokens (nếu có)

---

## Convert HTML → React

```bash
# Convert tất cả
node scripts/convert-to-react.mjs

# Convert 1 file
node scripts/convert-to-react.mjs --file screenshots/stitch/login.html

# Chỉ trích design tokens
node scripts/convert-to-react.mjs --extract-tokens
```

Script tự động:
- Trích body HTML → page.tsx
- Chuyển class → className, for → htmlFor, style string → object
- Trích design tokens + fonts + icon libraries
- Tạo setup guide

---

## Visual Regression Test

```bash
# Test tất cả (cần dev server chạy)
node scripts/visual-test.mjs

# Test 1 trang
node scripts/visual-test.mjs --page login

# Custom URL
node scripts/visual-test.mjs --url http://localhost:3001
```

Output trong `screenshots/compare/`:
- `-stitch.png` — Screenshot Stitch HTML
- `-react.png` — Screenshot React page
- `-diff.png` — Điểm khác biệt (đỏ)
- `report.json` — % match cho từng trang

Đánh giá: ≥95% = PASS, 85-95% = WARN, <85% = FAIL

---

## Quy Trình Convert Chi Tiết

```
BƯỚC 1: Chạy convert-to-react.mjs → ra page.tsx thô
BƯỚC 2: Chạy dev server → mở browser → so sánh visual với Stitch screenshot
BƯỚC 3: Sửa CSS nếu lệch → chạy visual-test → lặp đến ≥95%
BƯỚC 4: Thêm logic (state, API, forms) — KHÔNG đổi visual
BƯỚC 5: Tách components (Header, Card, Form...) — mỗi lần tách → test lại visual
```

**NGUYÊN TẮC:** Visual đúng TRƯỚC → logic SAU → tách component CUỐI CÙNG.

---

## Lưu Ý

```
1. KHÔNG tự code UI — luôn dùng Stitch
2. Design brief PHẢI nhất quán xuyên suốt project (cùng 1 brief cho mọi trang)
3. Visual test sau MỖI bước (convert, thêm logic, tách component)
4. Rate limit Stitch: 350 generations/tháng — viết prompt kỹ, hạn chế retry
5. Nếu Stitch output không đẹp → chỉnh prompt (xem prompt-guide.md) → chạy lại
```
