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
      // "/uploads": {
      //   target: "https://173.212.214.79",
      //   changeOrigin: true,
      //   secure: false, // Ignore invalid SSL certificate (development only)
      //   rewrite: (path) => path.replace(/^\/uploads/, "/v1/documents"),
      // },
    
  },
},
});