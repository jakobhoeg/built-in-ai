import {
  WebLLMLanguageModel,
  WebLLMModelId,
  WebLLMSettings,
} from "./web-llm-language-model";

/**
 * Create a new WebLLMLanguageModel.
 * @param modelId The model ID to use (e.g., 'Llama-3.1-8B-Instruct-q4f32_1-MLC')
 * @param settings Options for the model
 */
export function webLLM(
  modelId: WebLLMModelId,
  settings?: WebLLMSettings,
): WebLLMLanguageModel {
  return new WebLLMLanguageModel(modelId, settings);
}
