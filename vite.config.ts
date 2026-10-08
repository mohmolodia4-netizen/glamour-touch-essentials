// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      VitePWA({
        // Manifest is served dynamically by src/routes/manifest[.]webmanifest.ts.
        manifest: false,
        injectRegister: null,
        registerType: "autoUpdate",
        devOptions: { enabled: false },
        strategies: "generateSW",
        filename: "sw.js",
        workbox: {
          // Static hashed assets only: no HTML, no navigation fallback, no runtime caching
          // (backend/API calls always go to the network).
          globPatterns: ["**/*.{js,css,woff,woff2,png,svg,ico,webp}"],
          navigateFallback: null,
          runtimeCaching: [],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
        },
      }),
    ],
  },
});
