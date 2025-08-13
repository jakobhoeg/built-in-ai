"use client";

import { useChat } from "@ai-sdk/react";
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
  AIInputModelSelect,
  AIInputModelSelectTrigger,
  AIInputModelSelectValue,
  AIInputModelSelectContent,
  AIInputModelSelectItem,
} from "@/components/ai/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { PlusIcon, RefreshCcw, Copy, X } from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { DefaultChatTransport, UIMessage } from "ai";
import { toast } from "sonner";
import Image from "next/image";
import { Spinner } from "@/components/ui/spinner";
import { Progress } from "@/components/ui/progress";
import { AudioFileDisplay } from "@/components/audio-file-display";
import { ModelSelector } from "@/components/model-selector";
import { TransformersChatTransport } from "./util/transformers-chat-transport";
import {
  doesBrowserSupportTransformersJS,
  transformersJS,
  TransformersUIMessage,
} from "@built-in-ai/transformers-js";
import { ModelConfig, MODELS } from "./util/models-config";

function TransformersJSChat({
  useClientSideInference,
  setUseClientSideInference,
  modelConfig,
  setModelConfig,
}: {
  useClientSideInference: boolean;
  setUseClientSideInference: (value: boolean) => void;
  modelConfig: ModelConfig;
  setModelConfig: (modelConfig: ModelConfig) => void;
}) {
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<FileList | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const chatTransport = useMemo(() => {
    if (useClientSideInference) {
      const { id, name, ...modelOptions } = modelConfig;

      const model = transformersJS(modelConfig.id, {
        ...modelOptions,
        worker: new Worker(new URL("./util/worker.ts", import.meta.url), {
          type: "module",
        }),
      });
      return new TransformersChatTransport(model); // Client side chat transport
    }
    return new DefaultChatTransport<UIMessage>({
      // server side (api route)
      api: "/api/transformers-chat",
    });
  }, [modelConfig, useClientSideInference]);

  const { error, status, sendMessage, messages, regenerate, stop } =
    useChat<TransformersUIMessage>({
      transport: chatTransport, // use custom transport
      onError(error) {
        toast.error(error.message);
      },
      id: `chat-${useClientSideInference ? 'client' : 'server'}-${useClientSideInference ? modelConfig.id : 'default'}`, // Forces state refresh (not necessary but fine for this minimal example app)
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
          {useClientSideInference ? (
            <>
              <p className="text-xs">@built-in-ai/transformers-js demo</p>
              <h1 className="text-lg font-medium">
                Using Transformers.js client-side
              </h1>
              <p className="text-sm max-w-xs">Switch model at the bottom of this page</p>
            </>
          ) : (
            <>
              <p className="text-xs">@built-in-ai/transformers-js demo</p>
              <h1 className="text-lg font-medium">Using server-side TransformersJS</h1>
              <p className="text-sm max-w-xs">
                Your device doesn&apos;t support client side inference
              </p>
            </>
          )}
        </div>
      )}
      <AIConversation className="flex-1">
        <AIConversationContent>
          {messages.map((m, index) => (
            <AIMessage
              from={m.role === "system" ? "assistant" : m.role}
              key={m.id}
            >
              <AIMessageContent>
                {/* Handle download progress parts first */}
                {m.parts
                  .filter((part) => part.type === "data-modelDownloadProgress")
                  .map((part, partIndex) => {
                    // Only show if message is not empty (hiding completed/cleared progress)
                    if (!part.data.message) return null;

                    // Don't show the entire div when actively streaming
                    if (status === "ready") return null;

                    return (
                      <div key={partIndex}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="flex items-center gap-1">
                            <Spinner className="size-4 " />
                            {part.data.message}
                          </span>
                        </div>
                        {part.data.status === "downloading" &&
                          part.data.progress !== undefined && (
                            <Progress value={part.data.progress} />
                          )}
                      </div>
                    );
                  })}

                {/* Handle file parts */}
                {m.parts
                  .filter((part) => part.type === "file")
                  .map((part, partIndex) => {
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
                  })}

                {/* Handle text parts */}
                {m.parts
                  .filter((part) => part.type === "text")
                  .map((part, partIndex) => (
                    <AIResponse key={partIndex}>{part.text}</AIResponse>
                  ))}

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
                <div className="flex gap-1 items-center text-gray-500">
                  <Spinner className="size-4" />
                  Thinking...
                </div>
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

      <div className="p-4">
        <AIInput
          onSubmit={handleSubmit}
          className="bg-accent dark:bg-card rounded-lg"
        >
          <AIInputTextarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={useClientSideInference
              ? "What would you like to know? (Powered by TransformersJS)"
              : "What would you like to know? (Powered by Server-side TransformersJS)"
            }
            minHeight={48}
            maxHeight={164}
            className="bg-accent dark:bg-card"
          />
          <AIInputToolbar>
            <AIInputTools>
              <AIInputButton
                onClick={() => fileInputRef.current?.click()}>
                <PlusIcon size={16} />
              </AIInputButton>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                multiple
                accept="image/*,text/*,audio/*"
                className="hidden"
              />
              <AIInputModelSelect
                disabled={!useClientSideInference}
                onValueChange={(modelId) => {
                  const selectedModel = MODELS.find(m => m.id === modelId);
                  if (selectedModel) setModelConfig(selectedModel);
                }}
                value={modelConfig.id}
              >
                <AIInputModelSelectTrigger>
                  <AIInputModelSelectValue />
                </AIInputModelSelectTrigger>
                <AIInputModelSelectContent>
                  {MODELS.map((model) => (
                    <AIInputModelSelectItem key={model.id} value={model.id}>
                      {model.name}
                    </AIInputModelSelectItem>
                  ))}
                </AIInputModelSelectContent>
              </AIInputModelSelect>
            </AIInputTools>
            <AIInputSubmit
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
          </AIInputToolbar>

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
        </AIInput>
      </div>
    </div>
  );
}

export default function TransformersJSChatPage() {
  const [useClientSideInference, setUseClientSideInference] = useState<
    boolean | null
  >(null);
  const [modelConfig, setModelConfig] = useState<ModelConfig>(MODELS[0]);

  useEffect(() => {
    setUseClientSideInference(doesBrowserSupportTransformersJS());
  }, []);

  if (useClientSideInference === null) {
    return (
      <div className="flex flex-col h-[calc(100dvh)] items-center justify-center max-w-4xl mx-auto">
        <Spinner className="size-4" />
      </div>
    );
  }

  return (
    <TransformersJSChat
      useClientSideInference={useClientSideInference}
      setUseClientSideInference={setUseClientSideInference}
      modelConfig={modelConfig}
      setModelConfig={setModelConfig}
    />
  );
}
