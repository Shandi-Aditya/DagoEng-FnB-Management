import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  // Match Next.js: components use the automatic JSX runtime (no React import)
  esbuild: {
    jsx: "automatic",
  },
  css: {
    postcss: {
      plugins: [],
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    fileParallelism: false,
    setupFiles: ["tests/setup-test-storage.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
