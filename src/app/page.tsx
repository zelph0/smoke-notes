import { templateConfig } from "@template/config";
import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main id="main" className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-4 py-24">
      <h1 className="text-balance text-4xl sm:text-5xl">{templateConfig.name}</h1>
      <p className="max-w-xl text-pretty text-lg text-muted-foreground">{templateConfig.description}</p>
      <div className="flex flex-wrap gap-3">
        <Link href="/tasks" className={buttonVariants({ size: "lg" })}>
          Open tasks
          <ArrowRightIcon data-icon="inline-end" />
        </Link>
        <Link href="/styleguide" className={buttonVariants({ size: "lg", variant: "outline" })}>
          Styleguide
        </Link>
      </div>
    </main>
  );
}
