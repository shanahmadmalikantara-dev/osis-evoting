import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Offline backup app: own build (Vite + Tauri), see backup-app/README.md.
    "backup-app/**",
    // MPK election site: separate app with its own lint config.
    "mpk-evoting/**",
  ]),
]);

export default eslintConfig;
