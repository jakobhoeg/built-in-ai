"use client";

import { ExternalLinkIcon } from "lucide-react";
import Link from "next/link";

export function BrowserSupportInstructions() {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center max-w-lg mx-auto">
      <h1 className="text-lg font-medium mb-4">Using server-side model</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Your device doesn&apos;t support built-in AI models
      </p>

      <div className="bg-accent/50 border rounded-lg p-4 text-left mb-4 w-full">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 bg-yellow-500 rounded-full" />
          <span className="text-sm font-medium">Important</span>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          The Prompt API is currently experimental and might change as it
          matures. The guide below to enable the Prompt API might also change in
          the future.
        </p>

        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-medium mb-2">You need:</h3>
            <ul className="text-xs text-muted-foreground space-y-1 ml-4">
              <li>• Chrome (v. 128 or higher)</li>
              <li>• Edge Dev/Canary (v. 138.0.3309.2 or higher)</li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">
              Enable these experimental flags:
            </h3>

            <div className="mb-3">
              <p className="text-xs font-medium text-foreground mb-1">
                If you&apos;re using Chrome:
              </p>
              <ul className="text-xs text-muted-foreground space-y-1 ml-4">
                <li>
                  1. Go to{" "}
                  <code className="bg-muted px-1 py-0.5 rounded text-xs">
                    chrome://flags/
                  </code>
                </li>
                <li>
                  2. Search for &apos;Prompt API for Gemini Nano with Multimodal
                  Input&apos;
                </li>
                <li>3. Set it to Enabled</li>
                <li>
                  4. Go to{" "}
                  <code className="bg-muted px-1 py-0.5 rounded text-xs">
                    chrome://components
                  </code>
                </li>
                <li>
                  5. Click Check for Update on Optimization Guide On Device
                  Model
                </li>
              </ul>
            </div>

            <div>
              <p className="text-xs font-medium text-foreground mb-1">
                If you&apos;re using Edge:
              </p>
              <ul className="text-xs text-muted-foreground space-y-1 ml-4">
                <li>
                  1. Go to{" "}
                  <code className="bg-muted px-1 py-0.5 rounded text-xs">
                    edge://flags/#prompt-api-for-phi-mini
                  </code>
                </li>
                <li>2. Set it to Enabled</li>
              </ul>
            </div>
          </div>

          <div className="pt-2 border-t">
            <Link
              href="https://developer.chrome.com/docs/ai/prompt-api"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
            >
              For more information, check out this guide
              <ExternalLinkIcon className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
