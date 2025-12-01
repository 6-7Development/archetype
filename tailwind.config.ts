import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      borderRadius: {
        lg: ".5625rem", /* 9px */
        md: ".375rem", /* 6px */
        sm: ".1875rem", /* 3px */
      },
      colors: {
        // Flat / base colors (regular buttons)
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
          border: "hsl(var(--card-border) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
          border: "hsl(var(--popover-border) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
          border: "var(--primary-border)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
          border: "var(--secondary-border)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
          border: "var(--muted-border)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
          border: "var(--accent-border)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
          border: "var(--destructive-border)",
        },
        ring: "hsl(var(--ring) / <alpha-value>)",
        chart: {
          "1": "hsl(var(--chart-1) / <alpha-value>)",
          "2": "hsl(var(--chart-2) / <alpha-value>)",
          "3": "hsl(var(--chart-3) / <alpha-value>)",
          "4": "hsl(var(--chart-4) / <alpha-value>)",
          "5": "hsl(var(--chart-5) / <alpha-value>)",
        },
        sidebar: {
          ring: "hsl(var(--sidebar-ring) / <alpha-value>)",
          DEFAULT: "hsl(var(--sidebar) / <alpha-value>)",
          foreground: "hsl(var(--sidebar-foreground) / <alpha-value>)",
          border: "hsl(var(--sidebar-border) / <alpha-value>)",
        },
        "sidebar-primary": {
          DEFAULT: "hsl(var(--sidebar-primary) / <alpha-value>)",
          foreground: "hsl(var(--sidebar-primary-foreground) / <alpha-value>)",
          border: "var(--sidebar-primary-border)",
        },
        "sidebar-accent": {
          DEFAULT: "hsl(var(--sidebar-accent) / <alpha-value>)",
          foreground: "hsl(var(--sidebar-accent-foreground) / <alpha-value>)",
          border: "var(--sidebar-accent-border)"
        },
        status: {
          online: "rgb(34 197 94)",
          away: "rgb(245 158 11)",
          busy: "rgb(239 68 68)",
          offline: "rgb(156 163 175)",
        },
        // BeehiveAI hive colors - Dark Navy Premium Theme
        honey: {
          DEFAULT: "hsl(var(--honey) / <alpha-value>)",
          50: "hsl(40 100% 97%)",
          100: "hsl(40 100% 90%)",
          200: "hsl(40 98% 80%)",
          300: "hsl(40 98% 68%)",
          400: "hsl(40 97% 56%)",
          500: "hsl(var(--honey) / <alpha-value>)", // #F7B500
          600: "hsl(40 95% 42%)",
          700: "hsl(40 92% 32%)",
          800: "hsl(40 88% 22%)",
          900: "hsl(40 85% 14%)",
          950: "hsl(40 80% 7%)",
        },
        nectar: {
          DEFAULT: "hsl(var(--nectar) / <alpha-value>)",
        },
        mint: {
          DEFAULT: "hsl(var(--mint) / <alpha-value>)",
          50: "hsl(168 80% 97%)",
          100: "hsl(168 82% 88%)",
          200: "hsl(168 84% 75%)",
          300: "hsl(168 84% 60%)",
          400: "hsl(168 84% 48%)",
          500: "hsl(var(--mint) / <alpha-value>)", // #00D9A3
          600: "hsl(168 84% 35%)",
          700: "hsl(168 82% 28%)",
          800: "hsl(168 80% 20%)",
          900: "hsl(168 78% 14%)",
          950: "hsl(168 75% 8%)",
        },
        navy: {
          DEFAULT: "hsl(220 15% 8% / <alpha-value>)", // #0A0F1E
          50: "hsl(220 15% 97%)",
          100: "hsl(220 15% 92%)",
          200: "hsl(220 14% 82%)",
          300: "hsl(220 14% 65%)",
          400: "hsl(220 14% 45%)",
          500: "hsl(220 14% 30%)",
          600: "hsl(220 14% 22%)",
          700: "hsl(222 14% 14%)",
          800: "hsl(222 14% 10%)", // #141B2E
          900: "hsl(220 15% 8%)",  // #0A0F1E
          950: "hsl(220 18% 5%)",
        },
        charcoal: {
          DEFAULT: "hsl(var(--charcoal) / <alpha-value>)",
          50: "hsl(220 15% 95%)",
          100: "hsl(220 14% 85%)",
          200: "hsl(220 14% 72%)",
          300: "hsl(220 14% 58%)",
          400: "hsl(220 14% 44%)",
          500: "hsl(220 14% 32%)",
          600: "hsl(220 14% 22%)",
          700: "hsl(220 14% 16%)",
          800: "hsl(222 14% 10%)", // #141B2E
          900: "hsl(220 15% 8%)",  // #0A0F1E
          950: "hsl(220 18% 5%)",
        },
        graphite: {
          DEFAULT: "hsl(var(--graphite) / <alpha-value>)",
        },
        cream: {
          DEFAULT: "hsl(var(--cream) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        serif: ["var(--font-serif)"],
        mono: ["var(--font-mono)"],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
