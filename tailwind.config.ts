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
        // DAGO Creative Hub Global Design System (Sage Green / Olive Theme)
        brand: {
          sage: "#3B7A57",       // Primary Sage Green (Light)
          sageBright: "#52B788", // Primary Sage Green Bright (Dark)
          sageHover: "#2E6144",
          olive: "#556B2F",
          // Harmonized with Sage Green Global Design System (no eye-straining random orange/yellow)
          orange: "hsl(var(--primary))",
          cyan: "hsl(var(--primary))",
          green: "#059669",
          yellow: "hsl(var(--primary))",
        },
        // Semantic Tokens driven by CSS Variables
        primary: {
          DEFAULT: "hsl(var(--primary))",
          hover: "hsl(var(--primary-hover))",
          light: "hsl(var(--primary-light))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: {
          DEFAULT: "hsl(var(--border))",
          focus: "hsl(var(--ring))",
        },
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        // Semantic Status Colors
        info: {
          DEFAULT: "hsl(var(--info))",
          light: "#F0F9FF",
          foreground: "#FFFFFF",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          light: "#ECFDF5",
          foreground: "#FFFFFF",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          light: "#FFFBEB",
          foreground: "#1E293B",
        },
        danger: {
          DEFAULT: "hsl(var(--destructive))",
          light: "#FEE2E2",
          foreground: "#FFFFFF",
        },
        // Clean Neutral SaaS Base
        background: {
          DEFAULT: "hsl(var(--background))",
          paper: "hsl(var(--card))",
          subtle: "hsl(var(--background-alt))",
        },
        foreground: {
          DEFAULT: "hsl(var(--foreground))",
          muted: "hsl(var(--muted-foreground))",
          subtle: "hsl(var(--muted-foreground))",
        },
        surface: {
          DEFAULT: "hsl(var(--card))",
          raised: "hsl(var(--card))",
          overlay: "rgba(15, 23, 42, 0.6)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        "2xs": "0 1px 2px 0 rgba(0, 0, 0, 0.03)",
        xs: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
        card: "0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px 0 rgba(0, 0, 0, 0.02)",
        "card-hover": "0 4px 6px -1px rgba(0, 0, 0, 0.06), 0 2px 4px -1px rgba(0, 0, 0, 0.03)",
        dropdown: "0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.04)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
