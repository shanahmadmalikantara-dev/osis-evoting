import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

const path = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// The booth UI (cards, modal, thank-you screen, theme) is imported straight from the main app
// in ../src, so both booths always look the same. next/image is swapped for a plain <img>.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: /^next\/image$/, replacement: path("./src/shims/next-image.tsx") },
      { find: /^@\//, replacement: `${path("../src")}/` },
    ],
    dedupe: ["react", "react-dom"],
  },
  server: { port: 5174, strictPort: true, fs: { allow: [".."] } },
  clearScreen: false,
  build: { target: "es2022", outDir: "dist", emptyOutDir: true },
});
