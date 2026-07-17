import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**", "**/dist/**", "**/build/**", "**/coverage/**",
      "**/*.tsbuildinfo", "lib/api-zod/src/generated/**", "uploads/**",
    ],
  },
  eslint.configs.recommended,
  { files: ["**/*.{js,mjs,cjs}"], languageOptions: { globals: { console: "readonly", process: "readonly", fetch: "readonly", setTimeout: "readonly" } } },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { Buffer: "readonly", NodeJS: "readonly", Express: "readonly" },
    },
    rules: {
      "no-undef": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
);
