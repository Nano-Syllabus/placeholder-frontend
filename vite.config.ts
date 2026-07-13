import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
  proxy: {
    "/api": { target: "https://placeholder-backend-oq4q.onrender.com", changeOrigin: true },
    "/uploads": { target: "https://placeholder-backend-oq4q.onrender.com", changeOrigin: true },
  },
},
});