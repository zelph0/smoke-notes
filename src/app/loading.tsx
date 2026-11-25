import { Skeleton } from "@/components/ui/skeleton";

export default function RootLoading() {
  return (
    <main id="main" aria-busy="true" className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-24">
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-5 w-4/5" />
    </main>
  );
}
