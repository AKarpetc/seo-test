import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "scripts/_deprecated/**",
    "tmp/**",
    "static/**",
    "exports/**",
  ]),
  {
    // ETL scripts map untyped CSV rows onto Prisma createMany inputs; the row shape
    // is only known at runtime and is validated by the loader, not by the compiler.
    files: ["scripts/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
]);

export default eslintConfig;
