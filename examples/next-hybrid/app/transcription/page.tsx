import { TranscriptionDemo } from "@/components/transcription-demo";
import { ModeToggle } from "@/components/ui/mode-toggle";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TranscriptionPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/transformers-js">
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Back to Chat
                </Button>
              </Link>
              <h1 className="text-xl font-semibold">
                Transformers.js Transcription Demo
              </h1>
            </div>
            <ModeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold">
              Client-side Audio Transcription
            </h2>
            <p className="text-muted-foreground">
              Upload an audio file and transcribe it using Whisper models running directly in your browser.
              Choose from multiple model sizes based on your performance and accuracy needs.
            </p>
          </div>

          <TranscriptionDemo />

          <div className="text-center text-sm text-muted-foreground space-y-2">
            <p>
              Uses WebGPU/WebAssembly to run Whisper models directly in your browser.
              Models are downloaded once and cached for future use. No data leaves your device.
            </p>
            <p>
              <strong>Requirements:</strong> Modern browser with WebGPU support (Chrome 113+, Edge 113+, or Firefox with WebGPU enabled).
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
