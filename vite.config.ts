import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  // Base path: "/" for Netlify/root hosts, "/owanbe/" for GitHub Pages project site.
  base: process.env.VITE_BASE || "/",
  // Transpile down to broadly-supported syntax so the bundle parses on older
  // browsers (older Safari/iOS lack `??=`, etc.). Without this, those browsers
  // get a blank page while modern ones work.
  build: {
    target: ["es2019", "safari13", "chrome87", "firefox78", "edge88"],
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
