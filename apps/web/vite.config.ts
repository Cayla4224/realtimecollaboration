import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/health":    { target: "http://localhost:4000", changeOrigin: true },
      "/messages":  { target: "http://localhost:4000", changeOrigin: true },
      "/rooms":     { target: "http://localhost:4000", changeOrigin: true },
      "/auth":      { target: "http://localhost:4000", changeOrigin: true }, // 👈 add this
      "/socket.io": { target: "http://localhost:4000", changeOrigin: true, ws: true }
    }
  }
});
