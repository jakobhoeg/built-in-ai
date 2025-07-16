export { WebLLMLanguageModel } from "./web-llm-language-model";
export type { WebLLMModelId, WebLLMSettings } from "./web-llm-language-model";
import {
  WebLLMLanguageModel,
  WebLLMModelId,
  WebLLMSettings,
} from "./web-llm-language-model";

/**
 * Create a WebLLM language model (runs in main thread)
 */
export function webLLM(modelId: WebLLMModelId, settings?: WebLLMSettings) {
  return new WebLLMLanguageModel(modelId, settings);
}
