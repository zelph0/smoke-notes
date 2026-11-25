import { templateConfig } from "@template/config";
import Link from "next/link";
import { HeaderAccount } from "@/lib/auth-ui";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b-(length:--border-width) border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-6 px-4">
        <Link href="/" className="font-heading font-semibold tracking-tight">
          {templateConfig.name}
        </Link>
        <nav aria-label="Main" className="flex items-center gap-4 text-muted-foreground text-sm">
          <Link href="/tasks" className="transition-colors hover:text-foreground">
            Tasks
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <HeaderAccount />
        </div>
      </div>
    </header>
  );
}
