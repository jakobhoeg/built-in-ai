"use client";

import { useChat } from "@ai-sdk/react";
import { ClientSideChatTransport } from "@/util/client-side-chat-transport";
import {
  AIMessage,
  AIMessageAvatar,
  AIMessageContent,
} from "@/components/ai/message";
import { AIResponse } from "@/components/ai/response";
import {
  AIConversation,
  AIConversationContent,
  AIConversationScrollButton,
} from "@/components/ai/conversation";
import {
  AIInput,
  AIInputTextarea,
  AIInputSubmit,
  AIInputTools,
  AIInputToolbar,
  AIInputButton,
} from "@/components/ai/input";
import { Button } from "@/components/ui/button";
import { PlusIcon, MicIcon, GlobeIcon, RefreshCcw, Copy } from "lucide-react";
import { useState, useEffect } from "react";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { isBuiltInAIModelAvailable } from "@built-in-ai/core";
import { DefaultChatTransport, UIMessage } from "ai";
import { toast } from "sonner";

const isBuiltInAIAvailable = isBuiltInAIModelAvailable();

export default function Chat() {
  const { error, status, sendMessage, messages, regenerate, stop } = useChat({
    transport: isBuiltInAIAvailable
      ? new ClientSideChatTransport()
      : new DefaultChatTransport<UIMessage>({
          api: "/api/chat",
        }),
    onError(error) {
      toast.error(error.message);
    },
  });

  const [input, setInput] = useState("");

  // For showcase purposes: show if built-in ai model is supported once page loads
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (isBuiltInAIAvailable) {
        toast.success("Using the built-in AI model", {
          description:
            "Your conversations will be processed locally in your browser",
          duration: 5000,
        });
      } else {
        toast.info("Using server-side AI model", {
          description:
            "Your browser doesnt support the Prompt API. Your conversations are processed on the server",
          duration: 5000,
        });
      }
    }, 50);

    return () => clearTimeout(timeoutId);
  }, [isBuiltInAIAvailable]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && status === "ready") {
      sendMessage({ text: input });
      setInput("");
    }
  };

  const copyMessageToClipboard = (message: any) => {
    const textContent = message.parts
      .filter((part: any) => part.type === "text")
      .map((part: any) => part.text)
      .join("\n");

    navigator.clipboard.writeText(textContent);
  };

  return (
    <div className="flex flex-col h-[calc(100dvh)] max-w-4xl mx-auto">
      <header>
        <div className="flex items-center justify-between p-4">
          <h1 className="text-lg font-semibold">built-in-ai</h1>
          <ModeToggle />
        </div>
      </header>
      <AIConversation className="flex-1">
        <AIConversationContent>
          {messages.map((m, index) => (
            <AIMessage
              from={m.role === "system" ? "assistant" : m.role}
              key={m.id}
            >
              <AIMessageContent>
                {m.parts.map((part, partIndex) => {
                  if (part.type === "text") {
                    return <AIResponse key={partIndex}>{part.text}</AIResponse>;
                  }
                  // TODO: tools etc
                  return null;
                })}

                {(m.role === "assistant" || m.role === "system") &&
                  index === messages.length - 1 &&
                  status === "ready" && (
                    <div className="flex gap-1 mt-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => copyMessageToClipboard(m)}
                        className="text-muted-foreground hover:text-foreground h-4 w-4 [&_svg]:size-3.5"
                      >
                        <Copy />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => regenerate()}
                        className="text-muted-foreground hover:text-foreground h-4 w-4 [&_svg]:size-3.5"
                      >
                        <RefreshCcw />
                      </Button>
                    </div>
                  )}
              </AIMessageContent>
              <AIMessageAvatar
                name={m.role}
                src={m.role === "user" ? "" : ""}
              />
            </AIMessage>
          ))}

          {/* Loading state */}
          {status === "submitted" && (
            <AIMessage from="assistant">
              <AIMessageContent>
                <div className="text-gray-500">Thinking...</div>
              </AIMessageContent>
              <AIMessageAvatar name="assistant" src="" />
            </AIMessage>
          )}

          {/* Error state */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="text-red-800 mb-2">An error occurred.</div>
              <Button
                type="button"
                variant="outline"
                onClick={() => regenerate()}
                disabled={status === "streaming" || status === "submitted"}
              >
                Retry
              </Button>
            </div>
          )}
        </AIConversationContent>
        <AIConversationScrollButton />
      </AIConversation>

      <div className="p-4 bg-background">
        <AIInput onSubmit={handleSubmit}>
          <AIInputTextarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="What would you like to know?"
            minHeight={48}
            maxHeight={164}
          />
          <AIInputToolbar>
            <AIInputTools>
              <AIInputButton>
                <PlusIcon size={16} />
              </AIInputButton>
              <AIInputButton>
                <MicIcon size={16} />
              </AIInputButton>
              <AIInputButton>
                <GlobeIcon size={16} />
                <span>Search</span>
              </AIInputButton>
            </AIInputTools>
            <AIInputSubmit
              disabled={status === "ready" && !input.trim()}
              status={status}
              onClick={
                status === "submitted" || status === "streaming"
                  ? stop
                  : undefined
              }
              type={
                status === "submitted" || status === "streaming"
                  ? "button"
                  : "submit"
              }
            />
          </AIInputToolbar>
        </AIInput>
      </div>
    </div>
  );
}
