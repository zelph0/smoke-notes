import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "./server";

export type Viewer = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

/**
 * The signed-in user, or null. Reads the session cookie, so with Cache Components it must
 * run inside a <Suspense> boundary (or a server action / route handler).
 * Memoized per request so several components can call it.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  // Touch the request first: during prerender this suspends here, before Neon Auth runs.
  await cookies();
  const { data } = await auth.getSession();
  const user = data?.user;
  if (!user) return null;
  return { id: user.id, name: user.name || user.email, email: user.email, image: user.image ?? null };
});

/** The signed-in user. Redirects to sign-in when there is none. Use in actions and pages. */
export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth/sign-in");
  return viewer;
}
