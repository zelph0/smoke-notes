import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main
      id="main"
      className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-4 py-24 text-center"
    >
      <p className="font-mono text-muted-foreground text-sm">404</p>
      <h1 className="text-2xl">Page not found</h1>
      <p className="text-muted-foreground">The page you're looking for doesn't exist or has moved.</p>
      <Link href="/" className={buttonVariants({ variant: "outline" })}>
        Go home
      </Link>
    </main>
  );
}
