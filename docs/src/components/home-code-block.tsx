"use client";

import {
  BundledLanguage,
  CodeBlock,
  CodeBlockBody,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockItem,
} from "@/components/kibo-ui/code-block";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PackageId } from "./home-code-section";

const packages: { id: PackageId; name: string; description: string }[] = [
  {
    id: "core",
    name: "@built-in-ai/core",
    description: "Chrome & Edge built-in AI",
  },
  {
    id: "transformers-js",
    name: "@built-in-ai/transformers-js",
    description: "Transformers.js models",
  },
  {
    id: "web-llm",
    name: "@built-in-ai/web-llm",
    description: "WebLLM models",
  },
];

const codeExamples: Record<
  PackageId,
  { language: string; filename: string; code: string }[]
> = {
  core: [
    {
      language: "typescript",
      filename: "example.ts",
      code: `import { streamText } from "ai";
import { builtInAI } from "@built-in-ai/core";

const result = streamText({
  model: builtInAI(),
  prompt: 'Hello, how are you',
});

for await (const chunk of result.textStream) {
  console.log(chunk);
}`,
    },
  ],
  "transformers-js": [
    {
      language: "typescript",
      filename: "example.ts",
      code: `import { streamText } from "ai";
import { transformersJS } from "@built-in-ai/transformers-js";

const result = streamText({
  model: transformersJS("HuggingFaceTB/SmolLM2-360M-Instruct"),
  prompt: 'Hello, how are you',
});

for await (const chunk of result.textStream) {
  console.log(chunk);
}`,
    },
  ],
  "web-llm": [
    {
      language: "typescript",
      filename: "example.ts",
      code: `import { streamText } from "ai";
import { webLLM } from "@built-in-ai/web-llm";

const result = streamText({
  model: webLLM("Qwen3-0.6B-q0f16-MLC"),
  prompt: 'Hello, how are you',
});

for await (const chunk of result.textStream) {
  console.log(chunk);
}`,
    },
  ],
};

interface HomeCodeBlockProps {
  value: PackageId;
  onValueChange: (value: PackageId) => void;
}

export function HomeCodeBlock({ value, onValueChange }: HomeCodeBlockProps) {
  const code = codeExamples[value];

  return (
    <Tabs
      value={value}
      onValueChange={(v) => onValueChange(v as PackageId)}
      className="w-full"
    >
      <TabsList className="w-full justify-start p-0 overflow-x-auto scrollbar-none">
        {packages.map((pkg) => (
          <TabsTrigger key={pkg.id} value={pkg.id} className="whitespace-nowrap shrink-0">
            {pkg.name}
          </TabsTrigger>
        ))}
      </TabsList>
      {packages.map((pkg) => {
        const pkgCode = codeExamples[pkg.id];
        return (
          <TabsContent key={pkg.id} value={pkg.id} className="mt-0">
            <CodeBlock data={pkgCode} defaultValue={pkgCode[0].language}>
              <CodeBlockHeader>
                <div className="flex-1 px-2 text-xs text-muted-foreground">
                  {pkgCode[0].filename}
                </div>
                <CodeBlockCopyButton />
              </CodeBlockHeader>
              <CodeBlockBody>
                {(item) => (
                  <CodeBlockItem key={item.language} value={item.language}>
                    <CodeBlockContent language={item.language as BundledLanguage}>
                      {item.code}
                    </CodeBlockContent>
                  </CodeBlockItem>
                )}
              </CodeBlockBody>
            </CodeBlock>
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
