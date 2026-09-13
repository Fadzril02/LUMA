/** @type {import('tailwindcss').Config} */
export default {
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        colors: {
          // Centralized LUMA Design System Colors
          base: "var(--bg-base)",
          surface: "var(--bg-surface)",
          "surface-elevated": "var(--bg-surface-elevated)",
          "sidebar-bg": "var(--bg-sidebar)",
          "border-subtle": "var(--border-subtle)",
          "border-strong": "var(--border-strong)",
          "border-dark": "var(--border-dark)",
          "text-primary": "var(--text-primary)",
          "text-secondary": "var(--text-secondary)",
          "text-muted": "var(--text-muted)",
          "text-inverse": "var(--text-inverse)",
          "accent-blue": {
            DEFAULT: "var(--accent-blue)",
            hover: "var(--accent-blue-hover)",
            subtle: "var(--accent-blue-subtle)",
            border: "var(--accent-blue-border)",
          },
          "accent-indigo": {
            DEFAULT: "var(--accent-indigo)",
            subtle: "var(--accent-indigo-subtle)",
          },
          "status-success": {
            DEFAULT: "var(--status-success)",
            bg: "var(--status-success-bg)",
          },
          "status-warning": {
            DEFAULT: "var(--status-warning)",
            bg: "var(--status-warning-bg)",
          },
          "status-danger": {
            DEFAULT: "var(--status-danger)",
            bg: "var(--status-danger-bg)",
          },

          // Existing UI component bridge tokens
          border: "var(--border)",
          input: "var(--input)",
          ring: "var(--ring)",
          background: "var(--background)",
          foreground: "var(--foreground)",
          primary: {
            DEFAULT: "var(--primary)",
            foreground: "var(--primary-foreground)",
          },
          secondary: {
            DEFAULT: "var(--secondary)",
            foreground: "var(--secondary-foreground)",
          },
          destructive: {
            DEFAULT: "var(--destructive)",
            foreground: "var(--destructive-foreground)",
          },
          muted: {
            DEFAULT: "var(--muted)",
            foreground: "var(--muted-foreground)",
          },
          accent: {
            DEFAULT: "var(--accent)",
            foreground: "var(--accent-foreground)",
          },
          popover: {
            DEFAULT: "var(--popover)",
            foreground: "var(--popover-foreground)",
          },
          card: {
            DEFAULT: "var(--card)",
            foreground: "var(--card-foreground)",
          },
        },
        borderRadius: {
          lg: "var(--radius)",
          md: "calc(var(--radius) - 2px)",
          sm: "calc(var(--radius) - 4px)",
        },
      },
    },
    plugins: [],
  }