import { HomeCodeSection } from "@/components/home-code-section";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MoveUpRight } from "lucide-react";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="grid min-h-dvh grid-cols-1 grid-rows-[1fr_1px_auto_1px_auto] justify-center [--gutter-width:2.5rem] md:-mx-4 md:grid-cols-[var(--gutter-width)_minmax(0,var(--breakpoint-xl))_var(--gutter-width)] lg:mx-0">
      {/* Left vertical separators */}
      <VerticalSeparatorLeft />

      {/* Main content */}
      <main className="grid gap-24 pb-24 text-gray-950 sm:gap-40 md:pb-40 dark:text-white">
        <div>
          <div className="relative flex h-16 items-end px-2 font-mono tracking-tighter text-xs/6 whitespace-pre text-black/40 max-sm:px-4 sm:h-24 dark:text-white/40 after:absolute after:bottom-0 after:h-px after:w-[200vw] after:bg-gray-950/5 dark:after:bg-white/10 after:-left-[100vw]">
            Vercel AI SDK v5 & v6
          </div>

          <div className="relative before:absolute before:top-0 before:h-px before:w-[200vw] before:-left-[100vw] after:absolute after:bottom-0 after:h-px after:w-[200vw] after:bg-gray-950/5 dark:after:bg-white/10 after:-left-[100vw]">
            <h1 className="px-2 text-4xl tracking-tighter text-balance max-lg:font-medium max-sm:px-4 sm:text-5xl lg:text-6xl xl:text-8xl">
              Build local, in-browser AI applications with ease.
            </h1>
          </div>

          <div className="font-mono tracking-tighter mt-5 relative text-black/40 dark:text-white/40 px-2 max-sm:px-4 before:absolute before:top-0 before:h-px before:w-[200vw] before:-left-[100vw] after:absolute after:bottom-0 after:h-px">
            Framework agnostic. Built-in state management. Tool calling. Structured output. Streaming.
          </div>

          <Separator />

          <div className="mt-10 flex gap-2 px-2 max-sm:px-4 relative before:absolute before:top-0 before:h-px before:w-[200vw] before:bg-gray-950/5 dark:before:bg-white/10 before:-left-[100vw] after:absolute after:bottom-0 after:h-px after:w-[200vw] after:bg-gray-950/5 dark:after:bg-white/10 after:-left-[100vw]">
            <Button asChild className="tracking-tight text-balance">
              <Link href="/docs">Get started building</Link>
            </Button>

            <Button variant="secondary" className="tracking-tight text-balance flex gap-2">
              <Link href="https://ai-sdk.dev/docs/introduction">Vercel AI SDK</Link>
              <MoveUpRight className="size-3.5" />
            </Button>
          </div>

          <HomeCodeSection />

        </div>
      </main>

      {/* Right vertical separators */}
      <VerticalSeparatorRight />
    </div>
  );
}

function Separator({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative flex h-7 lg:h-10 w-full border-y border-edge",
        "bg-[image:repeating-linear-gradient(315deg,_var(--pattern-fg)_0,_var(--pattern-fg)_1px,_transparent_0,_transparent_50%)] bg-[size:10px_10px] bg-fixed [--pattern-fg:var(--color-black)]/5 dark:[--pattern-fg:var(--color-white)]/10",
        "before:absolute before:-z-1 before:h-7 lg:before:h-10 before:w-[100vw] before:right-[calc(100%+var(--gutter-width))] before:border-y before:border-edge",
        "after:absolute after:-z-1 after:h-7 lg:after:h-10 after:w-[100vw] after:left-[calc(100%+var(--gutter-width))] after:border-y after:border-edge",
        className
      )}
    />
  );
}

function VerticalSeparatorRight({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "row-span-full row-start-1 hidden border-x border-x-(--pattern-fg) bg-[image:repeating-linear-gradient(315deg,_var(--pattern-fg)_0,_var(--pattern-fg)_1px,_transparent_0,_transparent_50%)] bg-[size:10px_10px] bg-fixed [--pattern-fg:var(--color-black)]/7 md:col-start-3 md:block dark:[--pattern-fg:var(--color-white)]/8",
        className
      )}
    />
  );
}

function VerticalSeparatorLeft({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "col-start-1 row-span-full row-start-1 hidden border-x border-x-(--pattern-fg) bg-[image:repeating-linear-gradient(315deg,_var(--pattern-fg)_0,_var(--pattern-fg)_1px,_transparent_0,_transparent_50%)] bg-[size:10px_10px] bg-fixed [--pattern-fg:var(--color-black)]/7 md:block dark:[--pattern-fg:var(--color-white)]/8",
        className
      )}
    />
  );
}