import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/messages": { target: "http://localhost:4000", changeOrigin: true },
      "/health":   { target: "http://localhost:4000", changeOrigin: true }, // <-- comma here
      "/socket.io": { target: "http://localhost:4000", changeOrigin: true, ws: true }
    }
  }
});
