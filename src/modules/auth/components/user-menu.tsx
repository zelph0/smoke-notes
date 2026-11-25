import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { getViewer } from "@/modules/auth/viewer";
import { SignOutMenuItem } from "./sign-out-button";

/** Header slot: "Sign in" or the signed-in user's menu. Render inside <Suspense>. */
export async function UserMenu() {
  const viewer = await getViewer();
  if (!viewer) {
    return (
      <Link href="/auth/sign-in" className={buttonVariants({ variant: "outline", size: "sm" })}>
        Sign in
      </Link>
    );
  }
  const initials = (viewer.name || viewer.email).slice(0, 2).toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="flex size-control items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground outline-none ring-ring/50 focus-visible:ring-3"
      >
        {initials}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <span className="block truncate font-medium text-foreground">{viewer.name}</span>
            <span className="block truncate font-normal">{viewer.email}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <SignOutMenuItem />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function UserMenuSkeleton() {
  return <Skeleton className="size-control rounded-full" />;
}
