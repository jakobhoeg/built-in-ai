"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mic, Upload, X, Play, Pause, Square, MicIcon } from "lucide-react";
import { experimental_transcribe as transcribe } from "ai";
import {
  transformersJS,
  doesBrowserSupportTransformersJS,
  TransformersJSTranscriptionModel,
} from "@built-in-ai/transformers-js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TRANSCRIPTION_MODELS,
  DEFAULT_TRANSCRIPTION_MODEL,
  TranscriptionModelConfig,
} from "@/app/transcription/util/transcription-models-config";

interface TranscriptionResult {
  text: string;
  language?: string;
  durationInSeconds?: number;
  segments: Array<{
    text: string;
    startSecond: number;
    endSecond: number;
  }>;
}

export function TranscriptionDemo() {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<TranscriptionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [transcriptionModel, setTranscriptionModel] =
    useState<TransformersJSTranscriptionModel | null>(null);
  const [modelConfig, setModelConfig] = useState<TranscriptionModelConfig>(
    DEFAULT_TRANSCRIPTION_MODEL
  );
  const [browserSupportsTransformers, setBrowserSupportsTransformers] = useState(false);
  const [isClient, setIsClient] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    setIsClient(true);
    setBrowserSupportsTransformers(doesBrowserSupportTransformersJS());
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("audio/")) {
      setAudioFile(file);
      setResult(null);
      setError(null);
    }
  };

  const removeFile = () => {
    setAudioFile(null);
    setRecordedAudio(null);
    setResult(null);
    setError(null);
    setPermissionError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const togglePlayback = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const startRecording = async () => {
    try {
      setPermissionError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setRecordedAudio(audioBlob);

        // Create a File object from the recorded audio
        const recordedFile = new File([audioBlob], 'recorded-audio.wav', {
          type: 'audio/wav',
          lastModified: Date.now(),
        });

        setAudioFile(recordedFile);
        setResult(null);
        setError(null);

        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setPermissionError('Unable to access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleTranscribe = async () => {
    if (!audioFile) return;

    if (!browserSupportsTransformers) {
      setError("Your browser doesn't support client-side transcription. Please use a modern browser like Chrome, Edge, or Firefox.");
      return;
    }

    setIsTranscribing(true);
    setProgress(0);
    setError(null);
    setResult(null);

    try {
      const audioBuffer = await audioFile.arrayBuffer();

      let model = transcriptionModel;

      if (!model || model.modelId !== modelConfig.id) {
        model = transformersJS.transcription(
          modelConfig.id,
          {
            device: modelConfig.device,
            dtype: modelConfig.dtype,
            maxNewTokens: modelConfig.maxNewTokens,
            returnTimestamps: modelConfig.returnTimestamps,
            language: modelConfig.language,
          },
        ) as TransformersJSTranscriptionModel;

        setTranscriptionModel(model);

        // Track progress
        await model.createSessionWithProgress((progress) => {
          setProgress(progress.progress * 100);
        });
      }

      // Client-side transcription
      const transcript = await transcribe({
        model,
        audio: audioBuffer,
        providerOptions: {
          "transformers-js": {
            language: "en",
            returnTimestamps: false,
          },
        },
      });

      setResult({
        text: transcript.text,
        language: transcript.language,
        durationInSeconds: transcript.durationInSeconds,
        segments: transcript.segments,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transcription failed");
    } finally {
      setIsTranscribing(false);
      setProgress(100);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mic className="w-5 h-5" />
          Client-side Audio Transcription
        </CardTitle>
        {isClient && !browserSupportsTransformers && (
          <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-md">
            ⚠️ Your browser doesn't support WebGPU or WebAssembly. Please use a modern browser like Chrome, Edge, or Firefox.
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Model Selection */}
        {browserSupportsTransformers && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Model Selection</label>
              <Badge variant="outline" className="text-xs">
                {modelConfig.memoryUsage}
              </Badge>
            </div>
            <Select
              value={modelConfig.id}
              onValueChange={(value) => {
                const newConfig = TRANSCRIPTION_MODELS.find(m => m.id === value);
                if (newConfig) {
                  setModelConfig(newConfig);
                  // Reset model instance to force reload with new config
                  setTranscriptionModel(null);
                }
              }}
              disabled={isTranscribing}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRANSCRIPTION_MODELS.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    <div className="flex flex-col items-start">
                      <span className="font-medium">{model.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {model.description} • {model.memoryUsage}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {/* Voice Recording */}
        <div className="border-2 border-dashed border-blue-300 rounded-lg p-6 text-center bg-blue-50/50">
          <MicIcon className="w-8 h-8 mx-auto mb-2 text-blue-500" />
          <p className="text-sm text-blue-700 mb-3">
            Record your voice directly
          </p>

          {!isRecording ? (
            <Button
              onClick={startRecording}
              variant="outline"
              className="border-blue-300 text-blue-700 hover:bg-blue-100"
              disabled={isTranscribing}
            >
              <Mic className="w-4 h-4 mr-2" />
              Start Recording
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-red-600">Recording...</span>
              </div>
              <Button
                onClick={stopRecording}
                variant="outline"
                className="border-red-300 text-red-700 hover:bg-red-100"
              >
                <Square className="w-4 h-4 mr-2" />
                Stop Recording
              </Button>
            </div>
          )}

          {permissionError && (
            <p className="text-xs text-red-500 mt-2">{permissionError}</p>
          )}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-gray-200"></div>
          <span className="text-xs text-gray-500 uppercase tracking-wide">or</span>
          <div className="flex-1 h-px bg-gray-200"></div>
        </div>

        {/* File Upload */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          {!audioFile ? (
            <div>
              <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p className="text-sm text-gray-600 mb-2">
                Select an audio file to transcribe
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
              >
                Choose Audio File
              </Button>
              <p className="text-xs text-gray-500 mt-2">
                Supports MP3, WAV, M4A, and other audio formats
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{audioFile.name}</span>
                  {recordedAudio && (
                    <Badge variant="secondary" className="text-xs">
                      Recorded
                    </Badge>
                  )}
                </div>
                <Button
                  onClick={removeFile}
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Audio Player */}
              <div className="flex items-center gap-2">
                <Button
                  onClick={togglePlayback}
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </Button>
                <span className="text-xs text-gray-500">
                  {(audioFile.size / 1024 / 1024).toFixed(2)} MB
                </span>
              </div>

              <audio
                ref={audioRef}
                src={URL.createObjectURL(audioFile)}
                onEnded={() => setIsPlaying(false)}
                className="hidden"
              />
            </div>
          )}
        </div>

        {/* Progress */}
        {isTranscribing && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                Loading model and transcribing...
              </span>
              <span className="text-sm text-gray-500">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="w-full" />
          </div>
        )}

        {/* Transcribe Button */}
        <Button
          onClick={handleTranscribe}
          disabled={!audioFile || isTranscribing || !browserSupportsTransformers}
          className="w-full"
        >
          {isTranscribing ? "Transcribing..." : "Transcribe Audio"}
        </Button>

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-md">
              <h3 className="font-medium text-green-800 mb-2">Transcription Result</h3>
              <p className="text-sm text-green-700 whitespace-pre-wrap">
                {result.text}
              </p>

              {/* Metadata */}
              <div className="mt-3 flex flex-wrap gap-2">
                {result.language && (
                  <Badge variant="outline">
                    Language: {result.language}
                  </Badge>
                )}
                {result.durationInSeconds && (
                  <Badge variant="outline">
                    Duration: {result.durationInSeconds.toFixed(1)}s
                  </Badge>
                )}
                {result.segments.length > 0 && (
                  <Badge variant="outline">
                    Segments: {result.segments.length}
                  </Badge>
                )}
              </div>
            </div>

            {/* Segments */}
            {result.segments.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Segments with Timestamps</h4>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {result.segments.map((segment, index) => (
                    <div
                      key={index}
                      className="text-xs p-2 bg-gray-50 rounded border"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-gray-500">
                          {segment.startSecond.toFixed(1)}s - {segment.endSecond.toFixed(1)}s
                        </span>
                      </div>
                      <p>{segment.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
