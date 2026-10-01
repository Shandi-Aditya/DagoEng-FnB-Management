import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // DagoEng Official Brand Accents
        brand: {
          orange: "#FF6B00",
          cyan: "#00B2FE",
          green: "#00C853",
          yellow: "#FFB300",
        },
        // Semantic Tokens
        primary: {
          DEFAULT: "#FF6B00", // Brand Orange as primary action
          hover: "#E65A00",
          light: "#FFF4EB",
          foreground: "#FFFFFF",
        },
        info: {
          DEFAULT: "#00B2FE", // Brand Cyan as info
          light: "#E5F7FF",
          foreground: "#FFFFFF",
        },
        success: {
          DEFAULT: "#00C853", // Brand Green as success
          light: "#E6F9EE",
          foreground: "#FFFFFF",
        },
        warning: {
          DEFAULT: "#FFB300", // Brand Yellow as warning
          light: "#FFF8E1",
          foreground: "#1E293B",
        },
        danger: {
          DEFAULT: "#EF4444",
          light: "#FEE2E2",
          foreground: "#FFFFFF",
        },
        // Clean Neutral SaaS Base
        background: {
          DEFAULT: "#F8FAFC", // Off-white / slate-50
          paper: "#FFFFFF",
          subtle: "#F1F5F9",
        },
        foreground: {
          DEFAULT: "#0F172A", // Slate 900
          muted: "#64748B",   // Slate 500
          subtle: "#94A3B8",  // Slate 400
        },
        border: {
          DEFAULT: "#E2E8F0", // Slate 200
          focus: "#FF6B00",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          raised: "#FFFFFF",
          overlay: "rgba(15, 23, 42, 0.6)",
        },
      },
      borderRadius: {
        lg: "12px",
        md: "8px",
        sm: "6px",
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)",
        "card-hover": "0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -1px rgba(0, 0, 0, 0.04)",
        dropdown: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
