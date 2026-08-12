import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/node_modules/**", "dist/**"] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    // Les scripts et le générateur écrivent sur la sortie standard : c'est leur
    // interface. Aucune donnée sensible ne transite ici — le registre est public
    // par construction, c'est l'inverse du produit.
    files: ["scripts/**/*.ts", "site/**/*.ts"],
    rules: { "no-console": "off" },
  },
  { files: ["**/*.config.{js,mjs,ts}"], ...tseslint.configs.disableTypeChecked },
);
