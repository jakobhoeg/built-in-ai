import { TransformersJSTranscriptionSettings } from "@built-in-ai/transformers-js";

export interface TranscriptionModelConfig extends TransformersJSTranscriptionSettings {
  id: string;
  name: string;
  description?: string;
  memoryUsage?: string;
}

export const TRANSCRIPTION_MODELS: TranscriptionModelConfig[] = [
  {
    id: "onnx-community/whisper-tiny",
    name: "Whisper Tiny",
    description: "Fastest, lowest memory usage",
    memoryUsage: "~122 MB",
    device: "webgpu",
    dtype: {
      encoder_model: "fp32",
      decoder_model_merged: "q4",
    },
    maxNewTokens: 64,
    returnTimestamps: false,
  },
  {
    id: "onnx-community/whisper-base",
    name: "Whisper Base",
    description: "Good balance of speed and accuracy",
    memoryUsage: "~209 MB",
    device: "webgpu",
    dtype: {
      encoder_model: "fp32",
      decoder_model_merged: "q4",
    },
    maxNewTokens: 64,
    returnTimestamps: false,
  },
  {
    id: "Xenova/whisper-tiny",
    name: "Whisper Tiny (Xenova)",
    description: "Alternative tiny model implementation",
    memoryUsage: "~122 MB",
    device: "webgpu",
    dtype: {
      encoder_model: "fp32",
      decoder_model_merged: "q4",
    },
    maxNewTokens: 64,
    returnTimestamps: false,
  },
  {
    id: "Xenova/whisper-base",
    name: "Whisper Base (Xenova)",
    description: "Alternative base model implementation",
    memoryUsage: "~209 MB",
    device: "webgpu",
    dtype: {
      encoder_model: "fp32",
      decoder_model_merged: "q4",
    },
    maxNewTokens: 64,
    returnTimestamps: false,
  },
  {
    id: "Xenova/whisper-large-v3",
    name: "Whisper Large v3",
    description: "Highest accuracy, requires more memory",
    memoryUsage: "~1280 MB",
    device: "webgpu",
    dtype: {
      encoder_model: "fp16",
      decoder_model: "q4",
    },
    maxNewTokens: 64,
    returnTimestamps: false,
  },
];

export const DEFAULT_TRANSCRIPTION_MODEL = TRANSCRIPTION_MODELS[0];
