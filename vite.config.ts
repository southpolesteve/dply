import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [react()],
  root: "site",
  build: {
    outDir: "../dist/site",
    emptyOutDir: true,
  },
});
