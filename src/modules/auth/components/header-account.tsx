import { Suspense } from "react";
import { UserMenu, UserMenuSkeleton } from "./user-menu";

/** Header slot: reads the session, so it streams in behind its own boundary. */
export function HeaderAccount() {
  return (
    <Suspense fallback={<UserMenuSkeleton />}>
      <UserMenu />
    </Suspense>
  );
}
