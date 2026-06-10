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
      // Honour the `_`-prefix convention for intentionally-unused bindings and
      // the rest-sibling idiom (e.g. omitting a key via `{ secret: _, ...rest }`).
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
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
