"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDownIcon } from "lucide-react";

const vercelAiSdkDemos = [
  {
    href: "/",
    label: "@built-in-ai/core",
  },
  {
    href: "/web-llm",
    label: "@built-in-ai/web-llm",
  },
  {
    href: "/transformers-js",
    label: "@built-in-ai/transformers-js",
  },
];

const tanstackAiSdkDemos = [
  {
    href: "/tanstack-core",
    label: "@built-in-ai/tanstack-core",
  },
];

const allDemos = [...vercelAiSdkDemos, ...tanstackAiSdkDemos];

export function ModelSelector() {
  const pathname = usePathname();
  const currentDemo = allDemos.find((demo) => demo.href === pathname);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="text-lg font-semibold px-2 max-w-56 sm:max-w-full flex items-center justify-between"
        >
          <span className="truncate mr-2">
            {currentDemo?.label ?? "Select a demo"}
          </span>
          <ChevronDownIcon className="h-4 w-4 flex-shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Vercel AI SDK</DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              {vercelAiSdkDemos.map((demo) => (
                <Link href={demo.href} key={demo.href} passHref>
                  <DropdownMenuItem>{demo.label}</DropdownMenuItem>
                </Link>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>TanStack AI SDK</DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              {tanstackAiSdkDemos.map((demo) => (
                <Link href={demo.href} key={demo.href} passHref>
                  <DropdownMenuItem>{demo.label}</DropdownMenuItem>
                </Link>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
