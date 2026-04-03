# Design Brief — Dark Theme

> Thêm đoạn brief bên dưới vào CUỐI mỗi prompt Stitch.
> Đảm bảo mọi trang generate ra cùng 1 phong cách.

---

## Brief (copy từ đây)

```
Design system constraints:
- Font: Inter (Google Fonts), body 16px/1.5 regular, heading bold
- Primary color: indigo-600 (#4f46e5), hover indigo-700 (#4338ca), active indigo-800 (#3730a3)
- Secondary accent: cyan-500 (#06b6d4) for highlights, badges
- Background: zinc-950 (#09090b) base, zinc-900 (#18181b) cards/panels, zinc-800 (#27272a) elevated
- Text: zinc-50 (#fafafa) primary, zinc-400 (#a1a1aa) secondary, zinc-500 (#71717a) muted
- Border: zinc-800 (#27272a) default, zinc-700 (#3f3f46) hover
- Success: emerald-500 (#10b981), Warning: amber-500 (#f59e0b), Error: red-500 (#ef4444), Info: blue-500 (#3b82f6)
- Border radius: buttons 8px, cards 12px, inputs 8px, modals 16px, badges 6px, avatars round
- Shadow: cards 0 1px 2px rgba(0,0,0,0.3), modals 0 10px 25px rgba(0,0,0,0.5)
- Spacing: card padding 24px, section gap 64px desktop / 48px mobile, component gap 16px
- Buttons: primary bg-indigo-600 text-white h-40px px-16px rounded-8px, secondary border-indigo-600 text-indigo-400 bg-transparent
- Inputs: h-40px bg-zinc-900 border-zinc-800 rounded-8px px-12px, focus ring indigo-500
- Images: rounded-12px, aspect-ratio fixed, object-fit cover
- Hover: buttons darken, cards border-zinc-700 + translateY(-2px), links underline
- All text Vietnamese. Theme: dark. Layout: modern, clean, generous whitespace.
```

---

## Khi nào dùng

- Mặc định cho mọi project mới
- Phù hợp: SaaS, dashboard, e-commerce hiện đại, tech/startup
- Ưu điểm: chuyên nghiệp, dễ đọc ban đêm, ít gây mỏi mắt

---

## Biến có thể thay đổi

```
{primary_color}  → indigo-600    (có thể đổi: violet, blue, emerald, rose)
{app_name}       → Tên app       (thay vào prompt chính)
{language}       → Vietnamese     (có thể đổi: English, Japanese...)
```

## Ví dụ prompt hoàn chỉnh

```
Login page for "ShopVN" e-commerce platform.
Layout: centered card on dark background.
Card: bg-zinc-900, rounded-16px, shadow, padding 32px, max-width 420px.
Logo 32px + "ShopVN" heading text-2xl font-bold text-white.
Email input with label "Email" placeholder "your@email.com".
Password input with show/hide toggle, label "Mật khẩu".
"Quên mật khẩu?" link right-aligned, text-sm text-indigo-400.
"Đăng nhập" button full-width, bg-indigo-600, text-white, rounded-8px, h-44px.
Divider "hoặc" with lines.
"Đăng nhập với Google" button full-width, outlined, with Google icon.
Bottom: "Chưa có tài khoản? Đăng ký" text-sm.

Design system constraints:
- Font: Inter (Google Fonts), body 16px/1.5 regular, heading bold
- Primary color: indigo-600 (#4f46e5), hover indigo-700 (#4338ca), active indigo-800 (#3730a3)
- Secondary accent: cyan-500 (#06b6d4) for highlights, badges
- Background: zinc-950 (#09090b) base, zinc-900 (#18181b) cards/panels, zinc-800 (#27272a) elevated
- Text: zinc-50 (#fafafa) primary, zinc-400 (#a1a1aa) secondary, zinc-500 (#71717a) muted
- Border: zinc-800 (#27272a) default, zinc-700 (#3f3f46) hover
- Border radius: buttons 8px, cards 12px, inputs 8px, modals 16px, badges 6px, avatars round
- Shadow: cards 0 1px 2px rgba(0,0,0,0.3), modals 0 10px 25px rgba(0,0,0,0.5)
- Buttons: primary bg-indigo-600 text-white h-40px px-16px rounded-8px
- Inputs: h-40px bg-zinc-900 border-zinc-800 rounded-8px px-12px, focus ring indigo-500
- All text Vietnamese. Theme: dark.
```
