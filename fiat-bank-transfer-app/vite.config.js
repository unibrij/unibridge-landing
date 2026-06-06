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
      true,

    rollupOptions: {
      output: {
        entryFileNames:
          "assets/fiat-auth.js",

        chunkFileNames:
          "assets/[name].js",

        assetFileNames:
          (assetInfo) => {
            if (assetInfo.name?.endsWith(".css")) {
              return "assets/fiat-auth.css";
            }

            return "assets/[name][extname]";
          }
      }
    }
  }
});
