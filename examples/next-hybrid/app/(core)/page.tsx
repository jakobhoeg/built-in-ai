"use client";

import { useChat } from "@ai-sdk/react";
import { ClientSideChatTransport } from "@/app/(core)/util/client-side-chat-transport";
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
  X,
  GithubIcon,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { doesBrowserSupportBuiltInAI } from "@built-in-ai/core";
import { DefaultChatTransport, UIMessage } from "ai";
import { toast } from "sonner";
import { BuiltInAIUIMessage } from "@built-in-ai/core";
import Image from "next/image";
import { Progress } from "@/components/ui/progress";
import { AudioFileDisplay } from "@/components/audio-file-display";
import { Kbd, KbdKey } from "@/components/ui/kbd";
import { ModelSelector } from "@/components/model-selector";
import { SiGithub } from "@icons-pack/react-simple-icons";
import Link from "next/link";

const doesBrowserSupportModel = doesBrowserSupportBuiltInAI();

export default function Chat() {
  const [browserSupportsModel, setBrowserSupportsModel] = useState<
    boolean | null
  >(null);
  const [isClient, setIsClient] = useState(false);

  const [input, setInput] = useState("");
  const [files, setFiles] = useState<FileList | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check browser support only on client side
  useEffect(() => {
    setIsClient(true);
    setBrowserSupportsModel(doesBrowserSupportBuiltInAI());
  }, []);

  const { error, status, sendMessage, messages, regenerate, stop } =
    useChat<BuiltInAIUIMessage>({
      transport: doesBrowserSupportModel
        ? new ClientSideChatTransport()
        : new DefaultChatTransport<UIMessage>({
            api: "/api/chat",
          }),
      onError(error) {
        toast.error(error.message);
      },
      onData: (dataPart) => {
        // Handle transient notifications
        // we can also access the date-modelDownloadProgress here
        if (dataPart.type === "data-notification") {
          if (dataPart.data.level === "error") {
            toast.error(dataPart.data.message);
          } else if (dataPart.data.level === "warning") {
            toast.warning(dataPart.data.message);
          } else {
            toast.info(dataPart.data.message);
          }
        }
      },
      experimental_throttle: 150,
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
        <div className="flex h-full flex-col items-center justify-center text-center">
          {browserSupportsModel ? (
            <>
              <p className="text-xs">@built-in-ai/core demo</p>
              <h1 className="text-lg font-medium">
                Using your browser's built-in AI model
              </h1>
              <p className="text-sm max-w-xs">
                Your browser supports built-in AI models
              </p>
            </>
          ) : (
            <>
              <h1 className="text-lg font-medium">Using server-side model</h1>
              <p className="text-sm max-w-xs">
                Your device doesn&apos;t support built-in AI models
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
                    <Response key={partIndex}>{part.text}</Response>
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
            placeholder="What would you like to know?"
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
              <PromptInputButton>
                <MicIcon size={16} />
              </PromptInputButton>
              <PromptInputButton>
                <GlobeIcon size={16} />
                <span>Search</span>
              </PromptInputButton>
            </PromptInputTools>
            <div className="flex items-center gap-2">
              <Kbd>
                <KbdKey aria-label="Control">Ctrl</KbdKey>
                <KbdKey>Enter</KbdKey>
              </Kbd>
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
            </div>
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
