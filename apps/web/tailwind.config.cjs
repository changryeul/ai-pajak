/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx,js,jsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
        },
        stage: {
          uploaded: "hsl(var(--stage-uploaded))",
          "uploaded-foreground": "hsl(var(--stage-uploaded-foreground))",
          "ai-analyzed": "hsl(var(--stage-ai-analyzed))",
          "ai-analyzed-foreground": "hsl(var(--stage-ai-analyzed-foreground))",
          "human-review": "hsl(var(--stage-human-review))",
          "human-review-foreground": "hsl(var(--stage-human-review-foreground))",
          approved: "hsl(var(--stage-approved))",
          "approved-foreground": "hsl(var(--stage-approved-foreground))",
          filed: "hsl(var(--stage-filed))",
          "filed-foreground": "hsl(var(--stage-filed-foreground))",
        },
        tax: {
          pph21: "hsl(var(--tax-pph21))",
          "pph21-foreground": "hsl(var(--tax-pph21-foreground))",
          pph23: "hsl(var(--tax-pph23))",
          "pph23-foreground": "hsl(var(--tax-pph23-foreground))",
          ppn: "hsl(var(--tax-ppn))",
          "ppn-foreground": "hsl(var(--tax-ppn-foreground))",
          annual: "hsl(var(--tax-annual))",
          "annual-foreground": "hsl(var(--tax-annual-foreground))",
        },
        confidence: {
          high: "hsl(var(--confidence-high))",
          "high-foreground": "hsl(var(--confidence-high-foreground))",
          medium: "hsl(var(--confidence-medium))",
          "medium-foreground": "hsl(var(--confidence-medium-foreground))",
          low: "hsl(var(--confidence-low))",
          "low-foreground": "hsl(var(--confidence-low-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
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
  plugins: [require("tailwindcss-animate")],
};