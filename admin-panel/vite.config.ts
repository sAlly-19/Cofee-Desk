import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
export default defineConfig({
  root: __dirname,
  base: "/admin/",
  plugins: [react()],
  publicDir: path.resolve(__dirname, "../assets/brand"),
  build: {
    outDir: path.resolve(__dirname, "../signaling-server/admin-dist"),
    emptyOutDir: true,
  },
  server: {
    host: "127.0.0.1",
    port: 5174,
    proxy: { "/api": "http://localhost:8080" },
  },
});
