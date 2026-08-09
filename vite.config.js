import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // `vercel dev` runs this dev server on a port of its own choosing and
    // proxies to it via $PORT — hardcoding 5173 made it proxy into nothing
    // and hang on every request. Falls back to 5173 for a standalone
    // `npm run dev`.
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
    watch: {
      ignored: ["**/node_modules/**", "**/.git/**", "**/.next/**", "**/marketing/**"],
    },
  },
});
