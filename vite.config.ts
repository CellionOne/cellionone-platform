import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import fs from "fs";

const buildVersion = `${Date.now()}`;

function injectSwVersion() {
  return {
    name: "inject-sw-version",
    apply: "build" as const,
    closeBundle() {
      const swPath = path.resolve(import.meta.dirname, "dist/public/sw.js");
      if (fs.existsSync(swPath)) {
        const content = fs.readFileSync(swPath, "utf-8");
        const patched = content.replace(/__BUILD_VERSION__/g, buildVersion);
        fs.writeFileSync(swPath, patched);
      }
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    injectSwVersion(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 600,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
