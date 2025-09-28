js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// One config that works locally and on GitHub Pages (subpath)
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE ?? "/",
});