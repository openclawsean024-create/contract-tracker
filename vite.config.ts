import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// SPA routing + Vercel deploy
export default defineConfig({
  plugins: [react()],
  server: { host: "0.0.0.0", port: 5173 },
  preview: { host: "0.0.0.0", port: 4173 },
  build: {
    target: "es2020",
    rollupOptions: {
      output: {
        manualChunks: {
          pdfjs: ["pdfjs-dist"],
          react: ["react", "react-dom", "react-router-dom"],
        },
      },
    },
  },
  optimizeDeps: { include: ["pdfjs-dist"] },
});
