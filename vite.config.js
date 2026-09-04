import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Root-relative, not "./" -- a relative base only resolves correctly for single-segment paths
  // like /growing by coincidence (relative URL resolution strips exactly one path segment before
  // resolving). Any route two or more segments deep -- /product/:id, /brew-guide/:slug -- would
  // resolve "./assets/x.js" against the wrong directory on a fresh load or hard refresh, 404,
  // and fall through to the server's catch-all HTML route, which is real, confirmed behavior this
  // exact site hit: https://morning-aroma.com/product/bourbon-rwanda served index.html in place of
  // its own JS bundle. Root-relative is correct at any route depth.
  base: "/",
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