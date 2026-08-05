import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// React 19 / react-hooks v7 ships react-compiler-aware rules that flag three
// patterns we use intentionally:
//
//   - react-hooks/set-state-in-effect → fires on hydration effects that read
//     localStorage / fetch result / a server-loaded session and then call
//     setState once. The React docs' "you might not need an effect" advice
//     does NOT cover server-driven hydration after CSR boot (the canonical
//     case for an effect). Our hydration patterns are guarded by a `useRef`
//     idempotency flag, so no cascading render actually happens.
//
//   - react-hooks/immutability → fires on `window.location.href = '/foo'` for
//     full-page reload (post sign-out, post role-switch). We use this
//     intentionally — next/router push would keep the in-memory React tree.
//
//   - react-hooks/refs → fires when reading `ref.current` inside an effect
//     that is itself guarded by an idempotency check.
//
// We demote to warning (not off) so the signal stays visible in `next lint`
// but doesn't fail CI or block `next build`. Real regressions surface in PR
// review; the per-line eslint-disable churn was strictly worse.
const REACT_COMPILER_NOISE_DEMOTED = {
  rules: {
    "react-hooks/set-state-in-effect": "warn",
    "react-hooks/refs": "warn",
    "react-hooks/immutability": "warn",
  },
};

// Unused-vars: allow the universal "_-prefix means intentionally unused"
// convention — deliberate discards (unused destructure slots, required-but-
// ignored callback params, kept-for-reference locals like _legacy*) are named
// with a leading underscore instead of carrying eslint-disable comments.
const UNUSED_VARS_UNDERSCORE_CONVENTION = {
  rules: {
    "@typescript-eslint/no-unused-vars": ["warn", {
      argsIgnorePattern: "^_",
      varsIgnorePattern: "^_",
      caughtErrorsIgnorePattern: "^_",
      destructuredArrayIgnorePattern: "^_",
      ignoreRestSiblings: true,
    }],
  },
};

// scripts/ are operational smoke/seed tools, not product code. Their JSON
// assertions read ad-hoc API payloads where a full type per response shape
// adds churn without safety (tsc still type-checks them on build). Demote
// no-explicit-any to warning there — src/ keeps it as an error.
const SCRIPTS_JSON_ANY_DEMOTED = {
  files: ["scripts/**/*.ts"],
  rules: {
    "@typescript-eslint/no-explicit-any": "warn",
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  REACT_COMPILER_NOISE_DEMOTED,
  UNUSED_VARS_UNDERSCORE_CONVENTION,
  SCRIPTS_JSON_ANY_DEMOTED,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // gstack QA tooling artifacts — not project code
    ".gstack/**",
    // vitest coverage output
    "coverage/**",
  ]),
]);

export default eslintConfig;
