"use client";

import { LogOutIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { authClient } from "@/modules/auth/client";

export function SignOutMenuItem() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <DropdownMenuItem
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await authClient.signOut();
          router.replace("/");
          router.refresh();
        })
      }
    >
      <LogOutIcon />
      Sign out
    </DropdownMenuItem>
  );
}
