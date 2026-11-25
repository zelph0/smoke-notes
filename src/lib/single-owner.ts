import "server-only";

/**
 * Viewer for apps WITHOUT auth: one implicit owner, so features keep the same owner-scoped
 * shape and auth can be added later without rewriting them. scripts/remove-auth.ts points
 * src/lib/viewer.ts here.
 */
export type Viewer = { id: string; name: string; email: string; image: string | null };

export const SINGLE_OWNER: Viewer = { id: "owner", name: "Owner", email: "owner@localhost", image: null };

export async function getViewer(): Promise<Viewer | null> {
  return SINGLE_OWNER;
}

export async function requireViewer(): Promise<Viewer> {
  return SINGLE_OWNER;
}
