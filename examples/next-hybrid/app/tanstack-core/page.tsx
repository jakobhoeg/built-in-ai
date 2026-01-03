"use client";

import { useState, useEffect } from "react";
import { useChat } from "@tanstack/ai-react";
import { createBuiltInAIConnection } from "./util/client-side-connection";
import { toolDefs } from "./tools/tools";
import {
  Message,
  MessageAvatar,
  MessageContent,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputButton,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Response } from "@/components/ai-elements/response";
import { Loader } from "@/components/ai-elements/loader";
import { Button } from "@/components/ui/button";
import {
  PlusIcon,
  MicIcon,
  GlobeIcon,
  RefreshCcw,
  Copy,
  Wrench,
  Clock,
  Dice5,
  Calculator,
  Bell,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { toast } from "sonner";
import { SiGithub } from "@icons-pack/react-simple-icons";
import Link from "next/link";
import { BrowserSupportInstructions } from "@/components/browser-support-instructions";
import { Kbd, KbdKey } from "@/components/ui/kbd";
import { ModelSelector } from "@/components/model-selector";
import { clientToolImpls } from "./tools/client";
import {
  doesBrowserSupportBuiltInAI,
  checkBuiltInAIAvailability,
} from "@built-in-ai/tanstack-core";

// Create connection with tool definitions (stable reference)
const connection = createBuiltInAIConnection({ tools: toolDefs });

export default function TanStackChat() {
  const [browserSupportsModel, setBrowserSupportsModel] = useState<
    boolean | null
  >(null);
  const [availability, setAvailability] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [input, setInput] = useState("");

  // Check browser support only on client side
  useEffect(() => {
    setIsClient(true);
    const supported = doesBrowserSupportBuiltInAI();
    setBrowserSupportsModel(supported);

    if (supported) {
      checkBuiltInAIAvailability().then((status) => {
        setAvailability(status);
      });
    }
  }, []);

  const { messages, sendMessage, isLoading, error, reload, stop, clear } =
    useChat({
      connection,
      tools: clientToolImpls,
    });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      sendMessage(input);
      setInput("");
    }
  };

  const copyMessageToClipboard = (message: (typeof messages)[0]) => {
    const textContent = message.parts
      .filter((part) => part.type === "text")
      .map((part) => (part as { type: "text"; content: string }).content)
      .join("\n");

    navigator.clipboard.writeText(textContent);
    toast.success("Copied to clipboard");
  };

  // Show loading state until client-side check completes
  if (!isClient) {
    return (
      <div className="flex flex-col h-[calc(100dvh)] items-center justify-center max-w-4xl mx-auto">
        <Loader className="size-4" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100dvh)] max-w-4xl mx-auto">
      <header>
        <div className="flex items-center justify-between p-4">
          <ModelSelector />
          <div className="flex gap-2 items-center">
            <Link
              href="https://github.com/jakobhoeg/built-in-ai"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:opacity-80 transition-opacity"
            >
              <SiGithub />
            </Link>
            <ModeToggle />
          </div>
        </div>
      </header>

      {messages.length === 0 && (
        <>
          {browserSupportsModel ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <p className="text-xs">@built-in-ai/tanstack-core demo</p>
              <h1 className="text-lg font-medium">
                TanStack AI SDK + Built-in AI models (Chrome/Edge)
              </h1>
              <p className="text-sm max-w-xs">
                Your browser supports built-in AI models
              </p>
              {availability && (
                <p className="text-xs mt-2 px-2 py-1 bg-muted rounded">
                  Model status:{" "}
                  <span className="font-mono">{availability}</span>
                </p>
              )}
            </div>
          ) : (
            <BrowserSupportInstructions />
          )}
        </>
      )}

      <Conversation className="flex-1">
        <ConversationContent>
          {/* Merge consecutive assistant messages into single bubbles */}
          {messages
            .reduce<{
              groups: { role: string; messages: (typeof messages)[number][] }[];
            }>(
              (acc, m) => {
                const lastGroup = acc.groups[acc.groups.length - 1];
                const effectiveRole =
                  m.role === "system" ? "assistant" : m.role;

                // Merge consecutive assistant/system messages
                if (
                  lastGroup &&
                  lastGroup.role === effectiveRole &&
                  effectiveRole === "assistant"
                ) {
                  lastGroup.messages.push(m);
                } else {
                  acc.groups.push({ role: effectiveRole, messages: [m] });
                }
                return acc;
              },
              { groups: [] },
            )
            .groups.map((group, groupIndex) => (
              <Message
                from={group.role as "user" | "assistant"}
                key={group.messages.map((m) => m.id).join("-")}
              >
                <MessageContent>
                  {group.messages.flatMap((m, messageIndex) =>
                    m.parts.map((part, partIndex) => {
                      const key = `${messageIndex}-${partIndex}`;

                      // Handle text parts
                      if (part.type === "text") {
                        return (
                          <Response key={key}>
                            {(part as { content: string }).content}
                          </Response>
                        );
                      }

                      // Skip tool-result parts - we'll show their output on the tool-call
                      if (part.type === "tool-result") {
                        return null;
                      }

                      // Handle tool call parts
                      if (part.type === "tool-call") {
                        const toolPart = part as {
                          type: "tool-call";
                          id: string;
                          name: string;
                          input?: Record<string, unknown>;
                          output?: Record<string, unknown>;
                          state?: string;
                        };

                        // Find matching tool-result part in any message within the group
                        let toolResultPart:
                          | {
                              type: "tool-result";
                              toolCallId: string;
                              output?: unknown;
                              state?: string;
                              errorText?: string;
                            }
                          | undefined;

                        for (const msg of group.messages) {
                          const found = msg.parts.find(
                            (p) =>
                              p.type === "tool-result" &&
                              (p as { toolCallId?: string }).toolCallId ===
                                toolPart.id,
                          );
                          if (found) {
                            toolResultPart = found as typeof toolResultPart;
                            break;
                          }
                        }

                        // Use output from tool-call part first, then fall back to tool-result
                        const output =
                          toolPart.output ?? toolResultPart?.output;
                        const hasError =
                          toolPart.state === "output-error" ||
                          toolResultPart?.state === "output-error";
                        const errorText = toolResultPart?.errorText;
                        const isComplete =
                          output !== undefined ||
                          toolPart.state === "output-available" ||
                          toolResultPart?.state === "output-available";

                        // Get icon based on tool name
                        const getToolIcon = (name: string) => {
                          switch (name) {
                            case "get_current_time":
                              return <Clock className="size-4" />;
                            case "get_random_number":
                              return <Dice5 className="size-4" />;
                            case "calculate":
                              return <Calculator className="size-4" />;
                            case "show_notification":
                              return <Bell className="size-4" />;
                            default:
                              return <Wrench className="size-4" />;
                          }
                        };

                        // Get status icon
                        const getStatusIcon = () => {
                          if (hasError) {
                            return <XCircle className="size-4 text-red-500" />;
                          }
                          if (isComplete) {
                            return (
                              <CheckCircle2 className="size-4 text-green-500" />
                            );
                          }
                          return (
                            <AlertCircle className="size-4 text-yellow-500 animate-pulse" />
                          );
                        };

                        return (
                          <div
                            key={key}
                            className="my-2 p-3 bg-muted/50 dark:bg-muted/30 rounded-lg border border-border/50"
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <div className="p-1.5 bg-primary/10 rounded">
                                {getToolIcon(toolPart.name)}
                              </div>
                              <span className="font-medium text-sm">
                                {toolPart.name.replace(/_/g, " ")}
                              </span>
                              {getStatusIcon()}
                            </div>

                            {/* Show input if available */}
                            {toolPart.input &&
                              Object.keys(toolPart.input).length > 0 && (
                                <div className="text-xs text-muted-foreground mb-2">
                                  <span className="font-medium">Input: </span>
                                  <code className="bg-background/50 px-1.5 py-0.5 rounded">
                                    {JSON.stringify(toolPart.input)}
                                  </code>
                                </div>
                              )}

                            {/* Show output if available */}
                            {output !== undefined && !hasError && (
                              <div className="text-xs">
                                <span className="font-medium text-muted-foreground">
                                  Result:{" "}
                                </span>
                                <code className="bg-green-500/10 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded">
                                  {typeof output === "string"
                                    ? output
                                    : JSON.stringify(
                                        output as Record<string, unknown>,
                                      )}
                                </code>
                              </div>
                            )}

                            {/* Show error if present */}
                            {hasError && errorText && (
                              <div className="text-xs text-red-600 dark:text-red-400">
                                Error: {errorText}
                              </div>
                            )}

                            {/* Show loading state */}
                            {!isComplete && !hasError && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Loader className="size-3" />
                                <span>Executing...</span>
                              </div>
                            )}
                          </div>
                        );
                      }

                      return null;
                    }),
                  )}

                  {/* Loading indicator - only show before text starts streaming */}
                  {group.role === "assistant" &&
                    groupIndex ===
                      messages.reduce<{
                        groups: {
                          role: string;
                          messages: (typeof messages)[number][];
                        }[];
                      }>(
                        (acc, m) => {
                          const lastGroup = acc.groups[acc.groups.length - 1];
                          const effectiveRole =
                            m.role === "system" ? "assistant" : m.role;
                          if (
                            lastGroup &&
                            lastGroup.role === effectiveRole &&
                            effectiveRole === "assistant"
                          ) {
                            lastGroup.messages.push(m);
                          } else {
                            acc.groups.push({
                              role: effectiveRole,
                              messages: [m],
                            });
                          }
                          return acc;
                        },
                        { groups: [] },
                      ).groups.length -
                        1 &&
                    isLoading &&
                    !group.messages.some((m) =>
                      m.parts.some((p) => p.type === "text"),
                    ) && (
                      <div className="flex gap-1 items-center text-gray-500">
                        <Loader className="size-4" />
                        Thinking...
                      </div>
                    )}

                  {/* Action buttons for assistant messages */}
                  {group.role === "assistant" &&
                    groupIndex ===
                      messages.reduce<{
                        groups: {
                          role: string;
                          messages: (typeof messages)[number][];
                        }[];
                      }>(
                        (acc, m) => {
                          const lastGroup = acc.groups[acc.groups.length - 1];
                          const effectiveRole =
                            m.role === "system" ? "assistant" : m.role;
                          if (
                            lastGroup &&
                            lastGroup.role === effectiveRole &&
                            effectiveRole === "assistant"
                          ) {
                            lastGroup.messages.push(m);
                          } else {
                            acc.groups.push({
                              role: effectiveRole,
                              messages: [m],
                            });
                          }
                          return acc;
                        },
                        { groups: [] },
                      ).groups.length -
                        1 &&
                    !isLoading && (
                      <div className="flex gap-1 mt-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            copyMessageToClipboard(
                              group.messages[group.messages.length - 1],
                            )
                          }
                          className="text-muted-foreground hover:text-foreground h-4 w-4 [&_svg]:size-3.5"
                        >
                          <Copy />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => reload()}
                          className="text-muted-foreground hover:text-foreground h-4 w-4 [&_svg]:size-3.5"
                        >
                          <RefreshCcw />
                        </Button>
                      </div>
                    )}
                </MessageContent>
                <MessageAvatar name={group.role} src="" />
              </Message>
            ))}

          {/* Loading state - only show when waiting for assistant to start responding */}
          {isLoading &&
            messages.length > 0 &&
            messages[messages.length - 1].role === "user" && (
              <Message from="assistant">
                <MessageContent>
                  <div className="flex gap-1 items-center text-gray-500">
                    <Loader className="size-4" />
                    Thinking...
                  </div>
                </MessageContent>
                <MessageAvatar name="assistant" src="" />
              </Message>
            )}

          {/* Error state */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="text-red-800 dark:text-red-200 mb-2">
                {error.message}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => reload()}
                disabled={isLoading}
              >
                Retry
              </Button>
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="p-4">
        <PromptInput
          onSubmit={handleSubmit}
          className="bg-accent dark:bg-card rounded-lg"
        >
          <PromptInputTextarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="What would you like to know?"
            minHeight={48}
            maxHeight={164}
            className="bg-accent dark:bg-card"
          />
          <PromptInputToolbar>
            <PromptInputTools>
              <PromptInputButton disabled>
                <PlusIcon size={16} />
              </PromptInputButton>
              <PromptInputButton disabled>
                <MicIcon size={16} />
              </PromptInputButton>
              <PromptInputButton disabled>
                <GlobeIcon size={16} />
                <span>Search</span>
              </PromptInputButton>
            </PromptInputTools>
            <div className="flex items-center gap-2">
              {messages.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => clear()}
                  disabled={isLoading}
                >
                  Clear
                </Button>
              )}
              <Kbd>
                <KbdKey aria-label="Control">Ctrl</KbdKey>
                <KbdKey>Enter</KbdKey>
              </Kbd>
              <PromptInputSubmit
                disabled={!isLoading && !input.trim()}
                status={isLoading ? "streaming" : "ready"}
                onClick={isLoading ? stop : undefined}
                type={isLoading ? "button" : "submit"}
              />
            </div>
          </PromptInputToolbar>
        </PromptInput>
      </div>
    </div>
  );
}
