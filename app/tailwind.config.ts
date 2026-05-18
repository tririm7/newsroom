// Tailwind 4 is CSS-first — most config lives in globals.css via @theme.
// This file exists so editors / IDE plugins can pick up content paths.
import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
} satisfies Config;
