import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Netlify deploys at domain root → base "/"
  // (For GitHub Pages you'd set base to "/<repo>/")
  base: "/",
});
