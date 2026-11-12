/**
 * The ONE build-time switch for every dev affordance (dev panel, backtick, URL overrides such as `?skipboot`).
 * True in `vite dev`, or in a build made with `VITE_D7_DEV=1`. A plain production build folds this to `false`,
 * so the dev-only code paths (and the lazy dev panel chunk) are dropped.
 */
export const DEV_MODE: boolean = import.meta.env.DEV || import.meta.env.VITE_D7_DEV === '1'
