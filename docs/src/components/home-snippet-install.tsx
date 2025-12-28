"use client";

import {
  Snippet,
  SnippetCopyButton,
  SnippetHeader,
  SnippetTabsContent,
  SnippetTabsList,
  SnippetTabsTrigger,
} from "@/components/kibo-ui/snippet";
import { BoxIcon, HeartIcon } from "lucide-react";
import type { PackageId } from "./home-code-section";

const commands: { id: PackageId; label: string; code: string }[] = [
  {
    id: "core",
    label: "@built-in-ai/core",
    code: "npm i @built-in-ai/core",
  },
  {
    id: "transformers-js",
    label: "@built-in-ai/transformers-js",
    code: "npm i @built-in-ai/transformers-js",
  },
  {
    id: "web-llm",
    label: "@built-in-ai/web-llm",
    code: "npm i @built-in-ai/web-llm",
  },
];

interface HomeSnippetInstallProps {
  value: PackageId;
  onValueChange: (value: PackageId) => void;
}

const HomeSnippetInstall = ({
  value,
  onValueChange,
}: HomeSnippetInstallProps) => {
  const activeCommand = commands.find((command) => command.id === value);

  return (
    <Snippet onValueChange={(v) => onValueChange(v as PackageId)} value={value}>
      <SnippetHeader className="overflow-hidden">
        <SnippetTabsList className="w-full justify-start p-0 overflow-x-auto scrollbar-none">
          {commands.map((command) => (
            <SnippetTabsTrigger key={command.id} value={command.id}>
              <span className="whitespace-nowrap">{command.label}</span>
            </SnippetTabsTrigger>
          ))}
        </SnippetTabsList>
      </SnippetHeader>
      {commands.map((command) => (
        <SnippetTabsContent
          className="flex justify-between items-center"
          key={command.id}
          value={command.id}
        >
          {command.code}
          {activeCommand && (
            <SnippetCopyButton
              onCopy={() =>
                console.log(`Copied "${activeCommand.code}" to clipboard`)
              }
              onError={() =>
                console.error(
                  `Failed to copy "${activeCommand.code}" to clipboard`,
                )
              }
              value={activeCommand.code}
            />
          )}
        </SnippetTabsContent>
      ))}
    </Snippet>
  );
};

export default HomeSnippetInstall;
