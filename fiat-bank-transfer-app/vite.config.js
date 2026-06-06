import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base:
    "/fiat/bank-transfer/app/",

  plugins: [
    react()
  ],

  build: {
    outDir:
      "../fiat/bank-transfer/app",

    emptyOutDir:
      true
  }
});
