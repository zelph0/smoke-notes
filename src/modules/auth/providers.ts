/**
 * Social sign-in buttons shown next to email codes, in this order. `pnpm provision --providers …`
 * rewrites the list to match the providers it enabled in Neon Auth; keep them in sync if you
 * change either. Neon's shared OAuth credentials cover these three (dev and previews).
 */
export type SocialProvider = "google" | "github" | "vercel";

export const socialProviders: SocialProvider[] = ["google"];
