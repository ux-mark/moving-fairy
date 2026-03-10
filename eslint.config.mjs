import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";
import prettierConfig from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // jsx-a11y plugin is already registered by eslint-config-next,
    // so we only add the recommended rules here
    rules: {
      ...jsxA11y.configs.recommended.rules,
    },
  },
  {
    // shadcn/ui Label component spreads htmlFor via props — not a real violation
    files: ["src/components/ui/label.tsx"],
    rules: {
      "jsx-a11y/label-has-associated-control": "off",
    },
  },
  prettierConfig,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
