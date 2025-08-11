import {
  AutoTokenizer,
  AutoModelForCausalLM,
  AutoProcessor,
  AutoModelForVision2Seq,
  TextStreamer,
  InterruptableStoppingCriteria,
  PretrainedModelOptions,
  StoppingCriteriaList,
  load_image,
} from "@huggingface/transformers";

import type {
  TransformersJSProgressCallback,
  TransformersJSWorkerMessage,
  TransformersJSWorkerResponse,
  TransformersJSGenerationOutput,
  TransformersJSKeyValueCache,
  TransformersJSWorkerGlobalScope,
  TransformersJSModelInstance,
  TransformersJSVisionModelInstance,
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

class VisionGenerationPipeline {
  static model_id = "HuggingFaceTB/SmolVLM-256M-Instruct";
  static dtype: PretrainedModelOptions["dtype"] | undefined;
  static device: PretrainedModelOptions["device"] | undefined;
  static use_external_data_format: boolean | undefined;
  static processor: Promise<TransformersJSVisionModelInstance[0]> | undefined;
  static model: Promise<TransformersJSVisionModelInstance[1]> | undefined;

  static configure(options?: { modelId?: string; dtype?: PretrainedModelOptions["dtype"]; device?: PretrainedModelOptions["device"]; use_external_data_format?: boolean }) {
    if (options?.modelId) this.model_id = options.modelId;
    if (options?.dtype) this.dtype = options.dtype;
    if (options?.device) this.device = options.device;
    if (options?.use_external_data_format !== undefined) this.use_external_data_format = options.use_external_data_format;
  }

  static async getInstance(progress_callback: TransformersJSProgressCallback | null = null) {
    this.processor ??= AutoProcessor.from_pretrained(this.model_id, {
      progress_callback: progress_callback || undefined,
    });

    this.model ??= AutoModelForVision2Seq.from_pretrained(this.model_id, {
      dtype: this.dtype ?? "fp32",
      device: this.device ?? "webgpu",
      use_external_data_format: this.use_external_data_format ?? false,
      progress_callback: progress_callback || undefined,
    });

    return Promise.all([this.processor, this.model]) as Promise<TransformersJSVisionModelInstance>;
  }
}

export class TransformersJSWorkerHandler {
  private stopping_criteria = new InterruptableStoppingCriteria();
  private past_key_values_cache: TransformersJSKeyValueCache = null;
  private isVisionModel = false;

  async generate(messages: Array<{ role: string; content: any }>) {
    try {
      if (this.isVisionModel) {
        await this.generateVision(messages);
      } else {
        await this.generateText(messages);
      }
    } catch (error) {
      const errorResponse: TransformersJSWorkerResponse = {
        status: "error",
        data: error instanceof Error ? error.message : String(error)
      };
      self.postMessage(errorResponse);
    }
  }

  private async generateText(messages: Array<{ role: string; content: string }>) {
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
  }

  private async generateVision(messages: Array<{ role: string; content: any }>) {
    // For this demo, we only respond to the last message
    const lastMessages = messages.slice(-1);

    const [processor, model] = await VisionGenerationPipeline.getInstance();

    // Load all images from messages
    const images = await Promise.all(
      lastMessages
        .map((x) => x.content)
        .flat(Infinity)
        .filter((msg) => msg.image !== undefined)
        .map((msg) => load_image(msg.image))
    );

    // Prepare inputs
    const text = processor.apply_chat_template(lastMessages, {
      add_generation_prompt: true,
    });
    const inputs = await processor(text, images);

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

    const streamer = new TextStreamer(processor.tokenizer!, {
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
      do_sample: false,
      repetition_penalty: 1.1,
      max_new_tokens: 1024,
      streamer,
      stopping_criteria: stoppingCriteriaList,
      return_dict_in_generate: true,
    };

    // Combine inputs and options properly
    const allOptions = Object.assign({}, inputs, generationOptions);
    const generationOutput = await model.generate(allOptions) as TransformersJSGenerationOutput;

    const { past_key_values, sequences } = generationOutput;
    this.past_key_values_cache = past_key_values;

    const decoded = processor.batch_decode(sequences, { skip_special_tokens: true });
    const completeResponse: TransformersJSWorkerResponse = { status: "complete", output: decoded };
    self.postMessage(completeResponse);
  }

  async load(options?: TransformersJSWorkerLoadOptions) {
    try {
      // Reset cached instances to ensure clean state
      TextGenerationPipeline.tokenizer = undefined;
      TextGenerationPipeline.model = undefined;
      VisionGenerationPipeline.processor = undefined;
      VisionGenerationPipeline.model = undefined;

      this.isVisionModel = options?.isVisionModel || false;

      if (this.isVisionModel) {
        VisionGenerationPipeline.configure(options);
      } else {
        TextGenerationPipeline.configure(options);
      }

      const loadingResponse: TransformersJSWorkerResponse = { status: "loading", data: "Loading model..." };
      self.postMessage(loadingResponse);

      if (this.isVisionModel) {
        const [processor, model] = await VisionGenerationPipeline.getInstance((progress) => {
          self.postMessage(progress);
        });

        const compilingResponse: TransformersJSWorkerResponse = { status: "loading", data: "Model loaded and ready..." };
        self.postMessage(compilingResponse);
      } else {
        const [tokenizer, model] = await TextGenerationPipeline.getInstance((progress) => {
          self.postMessage(progress);
        });

        const compilingResponse: TransformersJSWorkerResponse = { status: "loading", data: "Compiling shaders and warming up model..." };
        self.postMessage(compilingResponse);
        const inputs = tokenizer("a");
        await model.generate({ ...inputs, max_new_tokens: 1 });
      }

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
    // Reset cached instances to ensure clean state
    TextGenerationPipeline.tokenizer = undefined;
    TextGenerationPipeline.model = undefined;
    VisionGenerationPipeline.processor = undefined;
    VisionGenerationPipeline.model = undefined;
  }

  onmessage(e: MessageEvent<TransformersJSWorkerMessage>) {
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
