import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],

  // Explicit modern target matching the browserslist config in package.json -- avoids Vite/esbuild
  // shipping legacy-compat transpilation and polyfills the declared browser range doesn't need,
  // which keeps the bundle smaller and closer to what the browser actually executes.
  build: {
    target: "es2020",
  },

  server: {
    port: 5173,
    open: false,
    watch: {
      ignored: [
        "**/test-results/**",
        "**/playwright-report/**",
        "**/playwright/.cache/**",
      ],
    },
  },
});