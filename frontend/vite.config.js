import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev, requests to /api are forwarded to the FastAPI server,
// so the browser never hits CORS problems.
// Change the target if Member 2 runs the backend on another port.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
