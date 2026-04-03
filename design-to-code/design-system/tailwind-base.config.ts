/**
 * Base Tailwind Config — Dùng chung cho mọi project
 *
 * Cách dùng:
 * 1. Copy file này vào project root
 * 2. Rename thành tailwind.config.ts
 * 3. Điều chỉnh colors.primary nếu cần đổi brand color
 * 4. Merge thêm tokens từ Stitch (nếu có) vào extend
 */

import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      // --- COLORS ---
      colors: {
        // Primary — Đổi ở đây để đổi brand color toàn project
        primary: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5", // Main brand
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
          950: "#1e1b4b",
        },
        // Secondary accent
        secondary: {
          400: "#22d3ee",
          500: "#06b6d4",
          600: "#0891b2",
        },
        // Semantic
        success: {
          50: "#ecfdf5",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
        },
        warning: {
          50: "#fffbeb",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
        },
        error: {
          50: "#fef2f2",
          500: "#ef4444",
          600: "#dc2626",
          700: "#b91c1c",
        },
        info: {
          50: "#eff6ff",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
        },
      },

      // --- TYPOGRAPHY ---
      fontFamily: {
        sans: ["Inter", "SF Pro Display", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "SF Mono", "Fira Code", "monospace"],
      },
      fontSize: {
        "display-xl": ["4.5rem", { lineHeight: "1.1", letterSpacing: "-0.04em" }],
        display: ["3.75rem", { lineHeight: "1.1", letterSpacing: "-0.04em" }],
        "display-sm": ["3rem", { lineHeight: "1.15", letterSpacing: "-0.025em" }],
      },

      // --- SPACING ---
      spacing: {
        18: "4.5rem",
        88: "22rem",
        128: "32rem",
      },

      // --- BORDER RADIUS ---
      borderRadius: {
        sm: "6px",
        DEFAULT: "8px",
        md: "8px",
        lg: "12px",
        xl: "16px",
        "2xl": "24px",
      },

      // --- SHADOWS ---
      boxShadow: {
        xs: "0 1px 2px rgba(0, 0, 0, 0.05)",
        sm: "0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)",
        md: "0 4px 6px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06)",
        lg: "0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05)",
        xl: "0 20px 25px rgba(0, 0, 0, 0.1), 0 10px 10px rgba(0, 0, 0, 0.04)",
        glow: "0 0 0 3px rgba(99, 102, 241, 0.3)",
        // Dark mode shadows (stronger)
        "dark-xs": "0 1px 2px rgba(0, 0, 0, 0.2)",
        "dark-sm": "0 1px 3px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2)",
        "dark-md": "0 4px 6px rgba(0, 0, 0, 0.3), 0 2px 4px rgba(0, 0, 0, 0.2)",
        "dark-lg": "0 10px 15px rgba(0, 0, 0, 0.3), 0 4px 6px rgba(0, 0, 0, 0.2)",
        "dark-xl": "0 20px 25px rgba(0, 0, 0, 0.4), 0 10px 10px rgba(0, 0, 0, 0.2)",
      },

      // --- ANIMATION ---
      transitionDuration: {
        instant: "75ms",
        fast: "150ms",
        normal: "250ms",
        slow: "350ms",
        slower: "500ms",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          "0%": { opacity: "0", transform: "translateX(16px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        shimmer: "shimmer 1.5s infinite",
        "fade-in": "fade-in 250ms ease-out",
        "fade-in-up": "fade-in-up 350ms ease-out",
        "slide-in-right": "slide-in-right 300ms ease-out",
        "scale-in": "scale-in 250ms ease-out",
      },

      // --- MAX WIDTH ---
      maxWidth: {
        prose: "65ch",
        container: "1280px",
      },

      // --- ASPECT RATIO ---
      aspectRatio: {
        "4/3": "4 / 3",
        "3/2": "3 / 2",
        "2/3": "2 / 3",
      },
    },
  },
  plugins: [],
};

export default config;
