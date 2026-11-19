/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  // antd 4 brings its own reset. Tailwind's reset (preflight) would restyle
  // every antd component, so it stays off until antd is gone.
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        "background": "oklch(var(--background) / <alpha-value>)",
        "foreground": "oklch(var(--foreground) / <alpha-value>)",
        "card": {
          "DEFAULT": "oklch(var(--card) / <alpha-value>)",
          "foreground": "oklch(var(--card-foreground) / <alpha-value>)"
        },
        "popover": {
          "DEFAULT": "oklch(var(--popover) / <alpha-value>)",
          "foreground": "oklch(var(--popover-foreground) / <alpha-value>)"
        },
        "primary": {
          "DEFAULT": "oklch(var(--primary) / <alpha-value>)",
          "foreground": "oklch(var(--primary-foreground) / <alpha-value>)"
        },
        "secondary": {
          "DEFAULT": "oklch(var(--secondary) / <alpha-value>)",
          "foreground": "oklch(var(--secondary-foreground) / <alpha-value>)"
        },
        "muted": {
          "DEFAULT": "oklch(var(--muted) / <alpha-value>)",
          "foreground": "oklch(var(--muted-foreground) / <alpha-value>)"
        },
        "accent": {
          "DEFAULT": "oklch(var(--accent) / <alpha-value>)",
          "foreground": "oklch(var(--accent-foreground) / <alpha-value>)"
        },
        "destructive": {
          "DEFAULT": "oklch(var(--destructive) / <alpha-value>)",
          "foreground": "oklch(var(--destructive-foreground) / <alpha-value>)"
        },
        "border": "oklch(var(--border) / <alpha-value>)",
        "input": "oklch(var(--input) / <alpha-value>)",
        "ring": "oklch(var(--ring) / <alpha-value>)",
        "chart-1": "oklch(var(--chart-1) / <alpha-value>)",
        "chart-2": "oklch(var(--chart-2) / <alpha-value>)",
        "chart-3": "oklch(var(--chart-3) / <alpha-value>)",
        "chart-4": "oklch(var(--chart-4) / <alpha-value>)",
        "chart-5": "oklch(var(--chart-5) / <alpha-value>)",
        "sidebar": {
          "DEFAULT": "oklch(var(--sidebar) / <alpha-value>)",
          "foreground": "oklch(var(--sidebar-foreground) / <alpha-value>)"
        },
        "sidebar-primary": "oklch(var(--sidebar-primary) / <alpha-value>)",
        "sidebar-primary-foreground": "oklch(var(--sidebar-primary-foreground) / <alpha-value>)",
        "sidebar-accent": "oklch(var(--sidebar-accent) / <alpha-value>)",
        "sidebar-accent-foreground": "oklch(var(--sidebar-accent-foreground) / <alpha-value>)",
        "sidebar-border": "oklch(var(--sidebar-border) / <alpha-value>)",
        "sidebar-ring": "oklch(var(--sidebar-ring) / <alpha-value>)"
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
