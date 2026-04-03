# Hướng Dẫn Viết Prompt Stitch

> AI đọc file này → tự viết prompt phù hợp cho từng dự án.
> KHÔNG copy paste — hiểu nguyên tắc → viết prompt đúng.

---

## Nguyên Tắc Viết Prompt Tốt

### 1. Cấu trúc prompt = 3 phần

```
PHẦN 1: MÔ TẢ TRANG (trang gì, cho ai, mục đích gì)
PHẦN 2: CHI TIẾT LAYOUT + COMPONENTS (liệt kê từng phần tử)
PHẦN 3: DESIGN BRIEF (copy từ design-brief-dark.md hoặc light)
```

### 2. Mô tả layout — từ NGOÀI vào TRONG, từ TRÊN xuống DƯỚI

```
Đúng:
"Header top: logo left, nav center, buttons right.
 Hero section: heading centered, description below, 2 buttons.
 Features: 3-column grid, icon + title + description each."

Sai:
"A nice looking page with some features and a header"
```

### 3. Mỗi component — chỉ rõ 4 thứ

```
1. NỘI DUNG: text gì, data gì
2. KÍCH THƯỚC: h-40px, max-width 420px, aspect 16:9
3. STYLE: bg color, rounded, border, shadow
4. VỊ TRÍ: left, center, right, top, bottom, margin/gap
```

### 4. Luôn ghi rõ

```
✓ Ngôn ngữ text: "Vietnamese" hoặc "English"
✓ Theme: "dark" hoặc "light"
✓ Font: "Inter" (hoặc font dự án dùng)
✓ Primary color: "indigo-600" (hoặc brand color)
✓ Data mẫu cụ thể: "299,000₫" thay vì "giá sản phẩm"
✓ Số lượng items: "grid 3 columns, 6 cards" thay vì "some cards"
```

### 5. KHÔNG viết

```
✗ Mơ hồ: "a beautiful page", "modern design", "nice looking"
✗ Quá ngắn: "Login page"
✗ Không có data mẫu: "product cards" (mà không nói card có gì)
✗ Không có kích thước: "a button" (mà không nói size, style)
```

---

## Template Theo Loại Trang

### Trang có FORM (login, register, contact, checkout)

```
[Loại] page for "[tên app]".
Layout: [centered card / split screen / full-width form].
Card/Form container: [size, bg, rounded, padding].

Form fields:
- [field 1]: label "[label]", placeholder "[text]", [type: text/email/password/select/textarea].
- [field 2]: label "[label]", [đặc biệt: show/hide toggle, datepicker...].
- [field N]...

Actions:
- "[CTA text]" button: [style: primary solid / outlined], [size], full-width.
- [link/button phụ nếu có].

[Design brief]
```

### Trang DANH SÁCH (products, blog, orders)

```
[Resource] listing page for "[tên app]".
Layout: [sidebar filters + grid / full-width grid / list view].

[Filters nếu có]: [loại filter: checkbox, range, radio, select].

Top bar: "[N] kết quả" + sort dropdown [options] + view toggle.

Grid [N] columns, gap [size]:
Card: [image aspect ratio], [content: title, description, price, rating, badge...].
  [hover effect].

[N] items shown.
Pagination: [style: numbered / load more / infinite].

[Design brief]
```

### Trang CHI TIẾT (product detail, article, project)

```
[Resource] detail page for "[tên app]".
Layout: [2 columns image+info / full-width article / hero+content].

[Breadcrumb nếu có].

[Phần chính]:
- [Image/gallery]: [layout, aspect ratio].
- [Title, meta info, description].
- [Actions: buttons, share, save].

[Phần phụ]:
- [Tabs/sections: mô tả, thông số, đánh giá].
- [Related items grid].

[Design brief]
```

### Trang LANDING / GIỚI THIỆU (homepage, about, services)

```
[Loại] page for "[tên app]".

Section 1 — Hero: [layout], [heading], [description], [CTA buttons].
Section 2 — [Features/Stats/About]: [layout grid/list], [N items], [nội dung mỗi item].
Section 3 — [Testimonials/Clients]: [layout], [data mẫu].
Section 4 — [CTA/Newsletter]: [layout], [action].

Header: [logo, nav items, buttons].
Footer: [columns, links, copyright].

[Design brief]
```

### Trang DASHBOARD (admin, analytics)

```
Dashboard [loại] for "[tên app]".
Layout: sidebar [width] + main content.

Sidebar: [logo, menu items, sections, user info bottom].

Main content:
- Header: [title, user greeting, notifications].
- Stats row: [N] cards, [mỗi card: icon + label + value + trend].
- Charts: [loại chart, data description].
- Table: [columns], [N rows sample data], [actions per row].

[Design brief]
```

---

## Cách Tạo screens.json Cho Dự Án

```
BƯỚC 1: Liệt kê TẤT CẢ trang cần thiết cho dự án
BƯỚC 2: Với mỗi trang, viết prompt theo template phù hợp
BƯỚC 3: Thêm design brief vào cuối mỗi prompt
BƯỚC 4: Gom vào screens.json

Format:
[
  {
    "name": "ten-trang-kebab-case",
    "prompt": "Prompt đầy đủ ở đây... kèm design brief cuối."
  },
  ...
]
```

### Quy tắc đặt tên

```
name phải:
├── kebab-case: "product-list", "blog-detail"
├── Ngắn gọn, rõ nghĩa
├── Prefix theo nhóm:
│   ├── auth-login, auth-register
│   ├── product-list, product-detail
│   ├── blog-list, blog-detail
│   ├── admin-dashboard, admin-orders
│   └── page-about, page-contact, page-404
```

---

## Checklist Trước Khi Chạy Stitch

```
□ Mỗi prompt có đủ: layout + components + data mẫu + design brief
□ Design brief GIỐNG NHAU cho mọi prompt trong project (nhất quán)
□ Tên app, brand color thống nhất
□ Data mẫu tiếng Việt (hoặc ngôn ngữ project)
□ Mỗi prompt chỉ rõ: dark hay light theme
□ Đã review: không prompt nào quá ngắn (< 3 dòng = quá ít)
```

---

## Ví Dụ: Tạo screens.json cho web bán giày

```json
[
  {
    "name": "homepage",
    "prompt": "Homepage for 'GiayViet' shoe store. Header: logo left, nav (Nam, Nữ, Trẻ em, Sale), search bar, cart icon badge '2', avatar. Hero: split 50/50, left heading 'Bước Đi Tự Tin' text-5xl bold + 'Bộ sưu tập mới nhất 2026' description + 'Mua ngay' primary button + 'Xem BST' ghost button, right hero shoe image. New arrivals: 4-column product cards, image 4:3, title, price, rating. Sale banner: full-width gradient bg, 'Giảm đến 50%' heading + 'Mua ngay' button. Brands: 6 logo row grayscale. Newsletter: email input + subscribe button. Footer: 4 columns. Design system constraints: Font: Inter, body 16px. Primary: indigo-600. Background: zinc-950 base, zinc-900 cards. Text: zinc-50 primary, zinc-400 secondary. Border: zinc-800. Radius: buttons 8px, cards 12px. All Vietnamese. Dark theme."
  },
  {
    "name": "product-list",
    "prompt": "Product listing for 'GiayViet'. Left sidebar 260px: filter by Danh mục (checkbox: Giày chạy, Giày casual, Sandal, Boot), Giá (range 200k-5M), Size (36-45 buttons), Thương hiệu (Nike, Adidas, Puma), Đánh giá (stars). Right: top bar '128 sản phẩm' + sort dropdown + grid/list toggle. Grid 3 columns, card: image 4:3, badge 'Giảm 30%' red top-left, heart icon top-right, title 2 lines, rating stars + count, price '799,000₫' bold + '1,200,000₫' line-through, 'Thêm giỏ' button. 9 products. Pagination numbered. Design system constraints: [same as homepage]"
  }
]
```

Lưu ý: ví dụ trên chỉ để minh hoạ cấu trúc. AI tự viết prompt phù hợp dự án thực tế.
