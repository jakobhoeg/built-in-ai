import {
  AutoTokenizer,
  AutoModelForCausalLM,
  TextStreamer,
  InterruptableStoppingCriteria,
  PretrainedModelOptions,
  StoppingCriteriaList,
} from "@huggingface/transformers";

import type {
  TransformersJSProgressCallback,
  TransformersJSWorkerMessage,
  TransformersJSWorkerResponse,
  TransformersJSGenerationOutput,
  TransformersJSKeyValueCache,
  TransformersJSWorkerGlobalScope,
  TransformersJSModelInstance,
  TransformersJSWorkerLoadOptions,
} from "./transformers-js-worker-types";

// Declare self with worker methods
declare const self: TransformersJSWorkerGlobalScope;

class TextGenerationPipeline {
  static model_id = "HuggingFaceTB/SmolLM2-360M-Instruct";
  static dtype: PretrainedModelOptions["dtype"] | undefined;
  static device: PretrainedModelOptions["device"] | undefined;
  static use_external_data_format: boolean | undefined;
  static tokenizer: Promise<TransformersJSModelInstance[0]> | undefined;
  static model: Promise<TransformersJSModelInstance[1]> | undefined;

  static configure(options?: { modelId?: string; dtype?: PretrainedModelOptions["dtype"]; device?: PretrainedModelOptions["device"]; use_external_data_format?: boolean }) {
    if (options?.modelId) this.model_id = options.modelId;
    if (options?.dtype) this.dtype = options.dtype;
    if (options?.device) this.device = options.device;
    if (options?.use_external_data_format !== undefined) this.use_external_data_format = options.use_external_data_format;
  }

  static async getInstance(progress_callback: TransformersJSProgressCallback | null = null) {
    this.tokenizer ??= AutoTokenizer.from_pretrained(this.model_id, {
      progress_callback: progress_callback || undefined,
      legacy: true,
    });

    this.model ??= AutoModelForCausalLM.from_pretrained(this.model_id, {
      dtype: this.dtype ?? "auto",
      device: this.device ?? "auto",
      use_external_data_format: this.use_external_data_format ?? false,
      progress_callback: progress_callback || undefined,
    });

    return Promise.all([this.tokenizer, this.model]) as Promise<TransformersJSModelInstance>;
  }
}

export class TransformersJSWorkerHandler {
  private stopping_criteria = new InterruptableStoppingCriteria();
  private past_key_values_cache: TransformersJSKeyValueCache = null;

  async generate(messages: Array<{ role: string; content: string }>) {
    try {
      const [tokenizer, model] = await TextGenerationPipeline.getInstance();

      const inputs = tokenizer.apply_chat_template(messages, {
        add_generation_prompt: true,
        return_dict: true,
      });

      let startTime: number | undefined;
      let numTokens = 0;
      let tps: number | undefined;
      const token_callback_function = () => {
        startTime ??= performance.now();
        if (numTokens++ > 0) {
          tps = (numTokens / (performance.now() - startTime)) * 1000;
        }
      };
      const callback_function = (output: string) => {
        const response: TransformersJSWorkerResponse = { status: "update", output, tps, numTokens };
        self.postMessage(response);
      };

      const streamer = new TextStreamer(tokenizer, {
        skip_prompt: true,
        skip_special_tokens: true,
        callback_function,
        token_callback_function,
      });

      const startResponse: TransformersJSWorkerResponse = { status: "start" };
      self.postMessage(startResponse);

      // Create stopping criteria list
      const stoppingCriteriaList = new StoppingCriteriaList();
      stoppingCriteriaList.push(this.stopping_criteria);

      const generationOptions = {
        do_sample: true,
        top_k: 3,
        temperature: 0.7,
        max_new_tokens: 512,
        streamer,
        stopping_criteria: stoppingCriteriaList,
        return_dict_in_generate: true,
      };

      // Combine inputs and options properly
      const allOptions = Object.assign({}, inputs, generationOptions);
      const generationOutput = await model.generate(allOptions) as TransformersJSGenerationOutput;

      const { past_key_values, sequences } = generationOutput;
      this.past_key_values_cache = past_key_values;

      const decoded = tokenizer.batch_decode(sequences, { skip_special_tokens: true });
      const completeResponse: TransformersJSWorkerResponse = { status: "complete", output: decoded };
      self.postMessage(completeResponse);
    } catch (error) {
      const errorResponse: TransformersJSWorkerResponse = {
        status: "error",
        data: error instanceof Error ? error.message : String(error)
      };
      self.postMessage(errorResponse);
    }
  }

  async load(options?: TransformersJSWorkerLoadOptions) {
    try {
      if (options) TextGenerationPipeline.configure(options);
      const loadingResponse: TransformersJSWorkerResponse = { status: "loading", data: "Loading model..." };
      self.postMessage(loadingResponse);

      console.log("About to load model...");
      const [tokenizer, model] = await TextGenerationPipeline.getInstance((progress) => {
        self.postMessage(progress);
      });
      console.log("Model loaded successfully");

      const compilingResponse: TransformersJSWorkerResponse = { status: "loading", data: "Compiling shaders and warming up model..." };
      self.postMessage(compilingResponse);
      const inputs = tokenizer("a");
      await model.generate({ ...inputs, max_new_tokens: 1 });
      const readyResponse: TransformersJSWorkerResponse = { status: "ready" };
      self.postMessage(readyResponse);
    } catch (error) {
      console.error("Error in worker load:", error);
      const errorResponse: TransformersJSWorkerResponse = {
        status: "error",
        data: error instanceof Error ? error.message : String(error)
      };
      self.postMessage(errorResponse);
    }
  }

  interrupt() {
    this.stopping_criteria.interrupt();
  }

  reset() {
    this.past_key_values_cache = null;
    this.stopping_criteria.reset();
  }

  onmessage(e: MessageEvent<TransformersJSWorkerMessage>) {
    console.log("TransformersJSWorkerHandler.onmessage called with:", e.data);
    try {
      const { type, data } = e.data || {} as TransformersJSWorkerMessage;
      switch (type) {
        case "load":
          this.load(data);
          break;
        case "generate":
          this.stopping_criteria.reset();
          this.generate(data);
          break;
        case "interrupt":
          this.interrupt();
          break;
        case "reset":
          this.reset();
          break;
        default:
          const errorResponse: TransformersJSWorkerResponse = {
            status: "error",
            data: `Unknown message type: ${type}`
          };
          self.postMessage(errorResponse);
          break;
      }
    } catch (error) {
      const errorResponse: TransformersJSWorkerResponse = {
        status: "error",
        data: error instanceof Error ? error.message : String(error)
      };
      self.postMessage(errorResponse);
    }
  }
}
