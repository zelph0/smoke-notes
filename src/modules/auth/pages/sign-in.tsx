import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SignInForm } from "@/modules/auth/components/sign-in-form";
import { safeNext } from "@/modules/auth/safe-next";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export function SignInPage({ searchParams }: PageProps<"/auth/sign-in">) {
  return (
    <main id="main" className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>
            <h1 className="text-xl">Sign in</h1>
          </CardTitle>
          <CardDescription>New here? Signing in creates your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<SignInSkeleton />}>
            <SignInFormWithRedirect searchParams={searchParams} />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}

async function SignInFormWithRedirect({ searchParams }: Pick<PageProps<"/auth/sign-in">, "searchParams">) {
  const { next } = await searchParams;
  return <SignInForm next={safeNext(next)} />;
}

function SignInSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-control w-full" />
      <Skeleton className="h-control-lg w-full" />
      <Skeleton className="h-control-lg w-full" />
    </div>
  );
}
