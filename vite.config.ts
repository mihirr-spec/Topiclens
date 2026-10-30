import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Relative asset paths, so the same build works at / and at github.io/Topiclens/ (routing is hash-based).
  base: "./",
  test: {
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
  },
} as Parameters<typeof defineConfig>[0]);
