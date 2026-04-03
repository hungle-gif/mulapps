# Design Brief — Light Theme

> Thêm đoạn brief bên dưới vào CUỐI mỗi prompt Stitch.
> Đảm bảo mọi trang generate ra cùng 1 phong cách.

---

## Brief (copy từ đây)

```
Design system constraints:
- Font: Inter (Google Fonts), body 16px/1.5 regular, heading bold
- Primary color: indigo-600 (#4f46e5), hover indigo-700 (#4338ca), active indigo-800 (#3730a3)
- Secondary accent: cyan-500 (#06b6d4) for highlights, badges
- Background: white (#ffffff) base, gray-50 (#f9fafb) cards/panels, gray-100 (#f3f4f6) elevated
- Text: gray-900 (#111827) primary, gray-600 (#4b5563) secondary, gray-400 (#9ca3af) muted
- Border: gray-200 (#e5e7eb) default, gray-300 (#d1d5db) hover
- Success: emerald-600 (#059669), Warning: amber-600 (#d97706), Error: red-600 (#dc2626), Info: blue-600 (#2563eb)
- Border radius: buttons 8px, cards 12px, inputs 8px, modals 16px, badges 6px, avatars round
- Shadow: cards 0 1px 3px rgba(0,0,0,0.1), modals 0 10px 25px rgba(0,0,0,0.15)
- Spacing: card padding 24px, section gap 64px desktop / 48px mobile, component gap 16px
- Buttons: primary bg-indigo-600 text-white h-40px px-16px rounded-8px, secondary border-indigo-600 text-indigo-600 bg-transparent
- Inputs: h-40px bg-white border-gray-300 rounded-8px px-12px, focus ring indigo-500
- Images: rounded-12px, aspect-ratio fixed, object-fit cover
- Hover: buttons darken, cards shadow increase + translateY(-2px), links underline
- All text Vietnamese. Theme: light. Layout: modern, clean, generous whitespace.
```

---

## Khi nào dùng

- Web doanh nghiệp, corporate, giáo dục, y tế
- Blog, tin tức, tạp chí
- Landing page sản phẩm tiêu dùng
- Ưu điểm: sáng sủa, thân thiện, dễ đọc nội dung dài

---

## Biến có thể thay đổi

```
{primary_color}  → indigo-600    (có thể đổi: violet, blue, emerald, rose)
{app_name}       → Tên app       (thay vào prompt chính)
{language}       → Vietnamese     (có thể đổi: English, Japanese...)
```

## Ví dụ prompt hoàn chỉnh

```
Homepage for "TinViet" news website.
Layout: full-width, white background.
Header: white bg, logo left, nav center (Trang chủ, Thời sự, Kinh tế, Công nghệ, Đời sống), search icon + avatar right.
Hero: featured article large image 16:9 left (60%), 3 smaller articles stacked right (40%). Title overlay on image.
Section "Tin mới nhất": 4-column grid, cards with image 16:9, category badge, title, excerpt 2 lines, author + date.
Section "Phổ biến nhất": numbered list 1-10, title + category + time ago.
Sidebar: "Đọc nhiều" widget, newsletter signup box.
Footer: 4 columns (Về chúng tôi, Chuyên mục, Liên hệ, Theo dõi), copyright bottom.

Design system constraints:
- Font: Inter (Google Fonts), body 16px/1.5 regular, heading bold
- Primary color: indigo-600 (#4f46e5), hover indigo-700 (#4338ca), active indigo-800 (#3730a3)
- Secondary accent: cyan-500 (#06b6d4) for highlights, badges
- Background: white (#ffffff) base, gray-50 (#f9fafb) cards/panels, gray-100 (#f3f4f6) elevated
- Text: gray-900 (#111827) primary, gray-600 (#4b5563) secondary, gray-400 (#9ca3af) muted
- Border: gray-200 (#e5e7eb) default, gray-300 (#d1d5db) hover
- Border radius: buttons 8px, cards 12px, inputs 8px, modals 16px, badges 6px, avatars round
- Shadow: cards 0 1px 3px rgba(0,0,0,0.1), modals 0 10px 25px rgba(0,0,0,0.15)
- Buttons: primary bg-indigo-600 text-white h-40px px-16px rounded-8px
- Inputs: h-40px bg-white border-gray-300 rounded-8px px-12px, focus ring indigo-500
- All text Vietnamese. Theme: light.
```
