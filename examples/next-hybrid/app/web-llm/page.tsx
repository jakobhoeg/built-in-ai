"use client";

import { useChat } from "@ai-sdk/react";
import {
  Message,
  MessageAvatar,
  MessageContent,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputButton,
  PromptInputModelSelect,
  PromptInputModelSelectContent,
  PromptInputModelSelectItem,
  PromptInputModelSelectTrigger,
  PromptInputModelSelectValue,
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
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { Button } from "@/components/ui/button";
import { PlusIcon, RefreshCcw, Copy, X } from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { ModeToggle } from "@/components/ui/mode-toggle";
import {
  doesBrowserSupportWebLLM,
  webLLM,
  WebLLMUIMessage,
} from "@built-in-ai/web-llm";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
  UIMessage,
} from "ai";
import { toast } from "sonner";
import Image from "next/image";
import { Progress } from "@/components/ui/progress";
import { AudioFileDisplay } from "@/components/audio-file-display";
import { WebLLMChatTransport } from "@/app/web-llm/util/web-llm-chat-transport";
import { ModelSelector } from "@/components/model-selector";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";

const MODELS = [
  "Qwen3-0.6B-q0f16-MLC",
  "Qwen3-4B-q4f16_1-MLC",
  "gemma-2-2b-it-q4f16_1-MLC",
  "DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC",
];

function WebLLMChat({
  browserSupportsWebLLM,
  modelId,
  setModelId,
}: {
  browserSupportsWebLLM: boolean;
  modelId: string;
  setModelId: (modelId: string) => void;
}) {
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<FileList | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const chatTransport = useMemo(() => {
    if (browserSupportsWebLLM) {
      console.log("here");
      const model = webLLM(modelId, {
        worker: new Worker(new URL("./util/worker.ts", import.meta.url), {
          type: "module",
        }),
      });
      return new WebLLMChatTransport(model); // Client side chat transport
    }
    return new DefaultChatTransport<UIMessage>({
      // server side (api route)
      api: "/api/chat",
    });
  }, [modelId, browserSupportsWebLLM]);

  const { error, status, sendMessage, messages, regenerate, stop } =
    useChat<WebLLMUIMessage>({
      transport: chatTransport, // use custom transport
      sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
      onError(error) {
        toast.error(error.message);
      },
    });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((input.trim() || files) && status === "ready") {
      sendMessage({
        text: input,
        files,
      });
      setInput("");
      setFiles(undefined);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(e.target.files);
    }
  };

  const removeFile = (indexToRemove: number) => {
    if (files) {
      const dt = new DataTransfer();
      Array.from(files).forEach((file, index) => {
        if (index !== indexToRemove) {
          dt.items.add(file);
        }
      });
      setFiles(dt.files);

      if (fileInputRef.current) {
        fileInputRef.current.files = dt.files;
      }
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
          <ModelSelector />
          <ModeToggle />
        </div>
      </header>
      {messages.length === 0 && (
        <div className="flex h-full flex-col items-center justify-center text-center">
          {browserSupportsWebLLM ? (
            <>
              <p className="text-xs">@built-in-ai/web-llm demo</p>
              <h1 className="text-lg font-medium">
                Using WebLLM client-side AI model
              </h1>
              <p className="text-sm max-w-xs">Your device supports WebGPU</p>
            </>
          ) : (
            <>
              <h1 className="text-lg font-medium">Using server-side model</h1>
              <p className="text-sm max-w-xs">
                Your device doesn&apos;t support WebGPU
              </p>
            </>
          )}
        </div>
      )}
      <Conversation className="flex-1">
        <ConversationContent>
          {messages.map((m, index) => (
            <Message
              from={m.role === "system" ? "assistant" : m.role}
              key={m.id}
            >
              <MessageContent>
                {/* Render parts in chronological order */}
                {m.parts.map((part, partIndex) => {
                  // Handle download progress parts
                  if (part.type === "data-modelDownloadProgress") {
                    // Only show if message is not empty (hiding completed/cleared progress)
                    if (!part.data.message) return null;

                    // Don't show the entire div when actively streaming
                    if (status === "ready") return null;

                    return (
                      <div key={partIndex}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="flex items-center gap-1">
                            <Loader className="size-4 " />
                            {part.data.message}
                          </span>
                        </div>
                        {part.data.status === "downloading" &&
                          part.data.progress !== undefined && (
                            <Progress value={part.data.progress} />
                          )}
                      </div>
                    );
                  }

                  // Handle file parts
                  if (part.type === "file") {
                    if (part.mediaType?.startsWith("image/")) {
                      return (
                        <div key={partIndex} className="mt-2">
                          <Image
                            src={part.url}
                            width={300}
                            height={300}
                            alt={part.filename || "Uploaded image"}
                            className="object-contain max-w-sm rounded-lg border"
                          />
                        </div>
                      );
                    }

                    if (part.mediaType?.startsWith("audio/")) {
                      return (
                        <AudioFileDisplay
                          key={partIndex}
                          fileName={part.filename!}
                          fileUrl={part.url}
                        />
                      );
                    }

                    // TODO: Handle other file types
                    return null;
                  }

                  // Handle reasoning
                  if (part.type === "reasoning") {
                    return (
                      <Reasoning
                        key={`${m.id}-${partIndex}`}
                        className="w-full"
                        isStreaming={
                          status === "streaming" &&
                          index === messages.length - 1
                        }
                      >
                        <ReasoningTrigger />
                        <ReasoningContent>{part.text}</ReasoningContent>
                      </Reasoning>
                    );
                  }

                  // Handle tool parts
                  if (part.type.startsWith("tool-")) {
                    // Type guard to ensure part is a ToolUIPart
                    if (!("state" in part)) return null;

                    // Map state values to the expected type
                    const toolState =
                      part.state === "streaming" || part.state === "done"
                        ? "output-available"
                        : part.state || "input-streaming";

                    // Format output as ReactNode
                    const formatOutput = (output: unknown): React.ReactNode => {
                      if (output === undefined || output === null)
                        return undefined;
                      if (typeof output === "string") return output;
                      return (
                        <pre className="text-xs overflow-auto">
                          {JSON.stringify(output, null, 2)}
                        </pre>
                      );
                    };

                    return (
                      <Tool key={partIndex}>
                        <ToolHeader
                          type={part.type as any}
                          state={toolState as any}
                        />
                        <ToolContent>
                          {"input" in part && part.input !== undefined && (
                            <ToolInput input={part.input} />
                          )}
                          {("output" in part || "errorText" in part) && (
                            <ToolOutput
                              output={
                                "output" in part && part.output
                                  ? formatOutput(part.output)
                                  : undefined
                              }
                              errorText={
                                "errorText" in part && part.errorText
                                  ? String(part.errorText)
                                  : undefined
                              }
                            />
                          )}
                        </ToolContent>
                      </Tool>
                    );
                  }

                  // Handle text parts
                  if (part.type === "text") {
                    return <Response key={partIndex}>{part.text}</Response>;
                  }

                  return null;
                })}

                {/* Action buttons for assistant messages */}
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
              </MessageContent>
              <MessageAvatar name={m.role} src={m.role === "user" ? "" : ""} />
            </Message>
          ))}

          {/* Loading state */}
          {status === "submitted" && (
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
            placeholder="What would you like to know? (Powered by WebLLM Worker)"
            minHeight={48}
            maxHeight={164}
            className="bg-accent dark:bg-card"
          />
          <PromptInputToolbar>
            <PromptInputTools>
              <PromptInputButton onClick={() => fileInputRef.current?.click()}>
                <PlusIcon size={16} />
              </PromptInputButton>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                multiple
                accept="image/*,text/*,audio/*"
                className="hidden"
              />
              <PromptInputModelSelect
                onValueChange={setModelId}
                value={modelId}
              >
                <PromptInputModelSelectTrigger>
                  <PromptInputModelSelectValue />
                </PromptInputModelSelectTrigger>
                <PromptInputModelSelectContent>
                  {MODELS.map((model) => (
                    <PromptInputModelSelectItem key={model} value={model}>
                      {model}
                    </PromptInputModelSelectItem>
                  ))}
                </PromptInputModelSelectContent>
              </PromptInputModelSelect>
            </PromptInputTools>
            <PromptInputSubmit
              disabled={
                status === "ready" &&
                !input.trim() &&
                (!files || files.length === 0)
              }
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
          </PromptInputToolbar>

          {/* File preview area - moved inside the form */}
          {files && files.length > 0 && (
            <div className="w-full flex px-2 p-2 gap-2">
              {Array.from(files).map((file, index) => (
                <div
                  key={index}
                  className="relative bg-muted-foreground/20 flex w-fit flex-col gap-2 p-1 border-t border-x rounded-md"
                >
                  {file.type.startsWith("image/") ? (
                    <div className="flex text-sm">
                      <Image
                        width={100}
                        height={100}
                        src={URL.createObjectURL(file)}
                        alt={file.name}
                        className="h-auto rounded-md w-auto max-w-[100px] max-h-[100px]"
                      />
                    </div>
                  ) : file.type.startsWith("audio/") ? (
                    <div className="flex text-sm flex-col">
                      <audio src={URL.createObjectURL(file)} className="hidden">
                        Your browser does not support the audio element.
                      </audio>
                      <span className="text-xs text-gray-500 truncate max-w-[100px]">
                        {file.name}
                      </span>
                    </div>
                  ) : (
                    <div className="flex text-sm">
                      <span className="text-xs truncate max-w-[100px]">
                        {file.name}
                      </span>
                    </div>
                  )}
                  <button
                    onClick={() => removeFile(index)}
                    className="absolute -top-1.5 -right-1.5 text-white cursor-pointer bg-red-500 hover:bg-red-600 w-4 h-4 rounded-full flex items-center justify-center"
                    type="button"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </PromptInput>
      </div>
    </div>
  );
}

export default function WebLLMChatPage() {
  const [browserSupportsWebLLM, setBrowserSupportsWebLLM] = useState<
    boolean | null
  >(null);
  const [modelId, setModelId] = useState(MODELS[0]);

  useEffect(() => {
    setBrowserSupportsWebLLM(doesBrowserSupportWebLLM());
  }, []);

  if (browserSupportsWebLLM === null) {
    return (
      <div className="flex flex-col h-[calc(100dvh)] items-center justify-center max-w-4xl mx-auto">
        <Loader className="size-4" />
      </div>
    );
  }

  return (
    <WebLLMChat
      browserSupportsWebLLM={browserSupportsWebLLM}
      modelId={modelId}
      setModelId={setModelId}
      key={modelId}
    />
  );
}
