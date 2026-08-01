import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Local dev only — production serves /api/* from the same Vercel deployment.
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
});
