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

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  REACT_COMPILER_NOISE_DEMOTED,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
