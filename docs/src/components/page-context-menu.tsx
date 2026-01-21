"use client";

import { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { CheckIcon, ArrowUpRightIcon, CopyIcon, ChevronDownIcon } from "lucide-react";
import { AnthropicLogo, OpenAILogo } from "./logos";

interface MenuItemProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick?: () => void;
  href?: string;
  showCheck?: boolean;
}

function MenuItem({
  icon,
  title,
  description,
  onClick,
  href,
  showCheck,
}: MenuItemProps) {
  const content = (
    <>
      <div className="flex items-center justify-center w-8 h-8 rounded-md border border-fd-border bg-fd-background shrink-0">
        {icon}
      </div>
      <div className="flex flex-col min-w-0 flex-1">
        <span className="flex items-center gap-1 text-sm font-medium text-fd-foreground">
          {title}
          {href && <ArrowUpRightIcon className="w-3 h-3" />}
        </span>
        <span className="text-xs text-fd-muted-foreground">{description}</span>
      </div>
      {showCheck && (
        <CheckIcon className="w-4 h-4 text-green-500 shrink-0" />
      )}
    </>
  );

  const className =
    "flex items-center gap-3 px-3 py-2 rounded-md outline-none cursor-pointer hover:bg-fd-accent focus:bg-fd-accent data-[highlighted]:bg-fd-accent";

  if (href) {
    return (
      <DropdownMenu.Item asChild>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={className}
        >
          {content}
        </a>
      </DropdownMenu.Item>
    );
  }

  return (
    <DropdownMenu.Item onClick={onClick} className={className}>
      {content}
    </DropdownMenu.Item>
  );
}

interface PageContextMenuProps {
  markdown: string;
}

export function PageContextMenu({ markdown }: PageContextMenuProps) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getPageUrl = () => window.location.href;

  const getClaudeUrl = () => {
    const pageUrl = getPageUrl();
    const prompt = encodeURIComponent(
      `Read from ${pageUrl} so I can ask questions about it`
    );
    return `https://claude.ai/new?q=${prompt}`;
  };

  const getChatGPTUrl = () => {
    const pageUrl = getPageUrl();
    const prompt = encodeURIComponent(
      `Read from ${pageUrl} so I can ask questions about it`
    );
    return `https://chatgpt.com/?prompt=${prompt}`;
  };

  return (
    <div className="hidden sm:flex items-stretch h-8">
      <button
        type="button"
        onClick={copy}
        aria-label="Copy page"
        className="flex items-center gap-1.5 rounded-l-md px-2.5 text-xs font-medium text-fd-muted-foreground border border-r-0 border-fd-border bg-fd-background hover:bg-fd-accent hover:text-fd-accent-foreground transition-colors"
      >
        {copied ? <CheckIcon className="w-3.5 h-3.5" /> : <CopyIcon className="w-3.5 h-3.5" />}
        <span>{copied ? "Copied!" : "Copy page"}</span>
      </button>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label="More options"
            className="flex items-center justify-center w-7 rounded-r-md border border-fd-border bg-fd-background hover:bg-fd-accent hover:text-fd-accent-foreground transition-colors text-fd-muted-foreground"
          >
            <ChevronDownIcon className="w-4 h-4" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={8}
            className="z-50 min-w-[280px] rounded-xl border border-fd-border bg-fd-popover p-1.5 shadow-lg"
          >
            <MenuItem
              icon={<CopyIcon className="w-4 h-4" />}
              title="Copy page"
              description="Copy as Markdown for LLMs"
              onClick={copy}
              showCheck={copied}
            />
            <MenuItem
              icon={<OpenAILogo className="w-4 h-4" />}
              title="Open in ChatGPT"
              description="Ask questions about this page"
              href={getChatGPTUrl()}
            />
            <MenuItem
              icon={<AnthropicLogo className="w-4 h-4" />}
              title="Open in Claude"
              description="Ask questions about this page"
              href={getClaudeUrl()}
            />
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}
