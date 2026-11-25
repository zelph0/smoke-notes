import type { Metadata } from "next";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

export const metadata: Metadata = { title: "Styleguide", robots: { index: false } };

const COLOR_TOKENS = [
  "background",
  "foreground",
  "card",
  "primary",
  "secondary",
  "muted",
  "accent",
  "destructive",
  "success",
  "border",
  "input",
  "ring",
] as const;

/**
 * Every token and component state on one page. The /new-app styling step (and anyone
 * restyling) checks this page in light and dark mode. Keep it in sync with src/components/ui.
 */
export default function StyleguidePage() {
  return (
    <main id="main" className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-4 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl">Styleguide</h1>
        <p className="text-muted-foreground">
          Tokens from <code className="font-mono text-sm">src/styles/theme.css</code> and every UI component state.
        </p>
      </header>

      <Section title="Colour">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {COLOR_TOKENS.map((token) => (
            <li key={token} className="flex flex-col gap-1.5">
              <span
                className="h-14 rounded-lg ring-ui ring-foreground/10"
                style={{ background: `var(--${token})` }}
                aria-hidden="true"
              />
              <span className="font-mono text-xs">--{token}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Type">
        <div className="flex flex-col gap-2">
          <p className="font-heading text-4xl" style={{ letterSpacing: "var(--heading-tracking)" }}>
            Heading display
          </p>
          <p className="font-heading text-2xl">Heading section</p>
          <p className="max-w-prose">
            Body text. The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.
          </p>
          <p className="text-muted-foreground text-sm">Muted supporting text.</p>
          <p className="font-mono text-sm">mono: const answer = 42;</p>
        </div>
      </Section>

      <Section title="Shape, density, depth">
        <div className="flex flex-wrap items-end gap-6">
          <Sample label="--radius">
            <div className="size-16 rounded-lg bg-primary" />
          </Sample>
          <Sample label="--border-width">
            <div className="size-16 rounded-lg border-ui border-foreground/60" />
          </Sample>
          <Sample label="--control-height-sm / base / lg">
            <div className="flex items-end gap-2">
              <div className="h-control-sm w-6 rounded-sm bg-muted-foreground/40" />
              <div className="h-control w-6 rounded-sm bg-muted-foreground/60" />
              <div className="h-control-lg w-6 rounded-sm bg-muted-foreground/80" />
            </div>
          </Sample>
          <Sample label="--surface-shadow">
            <div className="size-16 rounded-lg bg-card shadow-surface ring-ui ring-foreground/10" />
          </Sample>
          <Sample label="--overlay-shadow">
            <div className="size-16 rounded-lg bg-popover shadow-overlay" />
          </Sample>
          <Sample label="--motion-duration (hover)">
            <div className="size-16 rounded-lg bg-accent transition-transform hover:scale-110" />
          </Sample>
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="link">Link</Button>
          <Button disabled>Disabled</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button>Default</Button>
          <Button size="lg">Large</Button>
        </div>
      </Section>

      <Section title="Forms">
        <FieldGroup className="max-w-md">
          <Field>
            <FieldLabel htmlFor="sg-name">Name</FieldLabel>
            <Input id="sg-name" placeholder="Ada Lovelace" />
            <FieldDescription>Helper text sits under the input.</FieldDescription>
          </Field>
          <Field data-invalid>
            <FieldLabel htmlFor="sg-email">Email</FieldLabel>
            <Input id="sg-email" defaultValue="not-an-email" aria-invalid aria-describedby="sg-email-error" />
            <FieldError id="sg-email-error">Enter a valid email address.</FieldError>
          </Field>
          <Field>
            <FieldLabel htmlFor="sg-notes">Notes</FieldLabel>
            <Textarea id="sg-notes" placeholder="Longer text…" />
          </Field>
          <Field orientation="horizontal">
            <Checkbox id="sg-check" defaultChecked />
            <FieldLabel htmlFor="sg-check">Checked option</FieldLabel>
          </Field>
          <Field>
            <FieldLabel htmlFor="sg-disabled">Disabled</FieldLabel>
            <Input id="sg-disabled" disabled placeholder="Can't edit" />
          </Field>
        </FieldGroup>
      </Section>

      <Section title="Surfaces & feedback">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Card title</CardTitle>
              <CardDescription>Cards use --surface-padding and --surface-shadow.</CardDescription>
            </CardHeader>
            <CardContent>Content goes here.</CardContent>
            <CardFooter>
              <Button size="sm">Action</Button>
            </CardFooter>
          </Card>
          <div className="flex flex-col gap-3">
            <Alert>
              <AlertTitle>Heads up</AlertTitle>
              <AlertDescription>Neutral alert for information.</AlertDescription>
            </Alert>
            <Alert variant="destructive">
              <AlertTitle>Something failed</AlertTitle>
              <AlertDescription>Destructive alert for errors.</AlertDescription>
            </Alert>
            <div className="flex gap-2">
              <Badge>Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="outline">Outline</Badge>
              <Badge variant="destructive">Destructive</Badge>
            </div>
            <div role="status" className="flex flex-col gap-2" aria-label="Loading placeholder">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        </div>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="border-b-(length:--border-width) border-border pb-2 text-lg">{title}</h2>
      {children}
    </section>
  );
}

function Sample({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <figure className="flex flex-col gap-2">
      {children}
      <figcaption className="font-mono text-muted-foreground text-xs">{label}</figcaption>
    </figure>
  );
}
