/**
 * UI seam for auth: components the app shell renders without knowing whether auth exists.
 * Auth integration point. scripts/remove-auth.ts swaps these for no-op versions.
 */
export { HeaderAccount } from "@/modules/auth/components/header-account"; // @auth-module
// @no-auth: export const HeaderAccount = () => null;
