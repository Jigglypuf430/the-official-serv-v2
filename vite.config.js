import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // IMPORTANT: must match your repo name (with leading/trailing slash)
  base: "/THE-OFFICIAL-SERV/"
});
