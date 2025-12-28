"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "./ui/button";
import { CornerPlus } from "./ui/corner-plus";

const DEFAULT_VISIBLE = 6;

export function TweetGrid({
  children,
  totalCount,
}: {
  children: ReactNode[];
  totalCount: number;
}) {
  const [showAll, setShowAll] = useState(false);
  const hasMore = totalCount > DEFAULT_VISIBLE;
  const visibleChildren = showAll
    ? children
    : children.slice(0, DEFAULT_VISIBLE);

  return (
    <>
      <div className="relative mt-8 grid grid-cols-1 gap-4 p-4 md:grid-cols-2 lg:grid-cols-3 bg-[image:repeating-linear-gradient(315deg,_var(--pattern-fg)_0,_var(--pattern-fg)_1px,_transparent_0,_transparent_50%)] bg-[size:10px_10px] bg-fixed [--pattern-fg:var(--color-black)]/5 dark:[--pattern-fg:var(--color-white)]/10 before:absolute before:top-0 before:h-px before:w-[200vw] before:bg-gray-950/5 dark:before:bg-white/10 before:-left-[100vw] after:absolute after:bottom-0 after:h-px after:w-[200vw] after:bg-gray-950/5 dark:after:bg-white/10 after:-left-[100vw]">
        <CornerPlus />

        {visibleChildren}
      </div>
      {hasMore && (
        <div className="mt-2 flex justify-center">
          <Button onClick={() => setShowAll(!showAll)} variant="ghost">
            {showAll ? (
              <>
                Show less <ChevronUp className="size-4" />
              </>
            ) : (
              <>
                Show all {totalCount} tweets <ChevronDown className="size-4" />
              </>
            )}
          </Button>
        </div>
      )}
    </>
  );
}
