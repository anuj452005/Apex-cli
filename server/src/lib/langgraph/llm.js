
import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { config, SYSTEM_PROMPT } from "../../config/google.config.js";

function createOpenRouterLLM(options = {}) {
  if (!config.openRouterApiKey) {
    throw new Error(
      "OpenRouter API key not configured. Run: apex config set OPENROUTER_API_KEY <your-key>\n" +
      "Get your key at: https://openrouter.ai/keys"
    );
  }

  process.env.OPENAI_API_KEY = config.openRouterApiKey;

  return new ChatOpenAI({
    modelName: options.model || config.model,
    temperature: options.temperature ?? config.temperature,
    maxTokens: options.maxTokens || config.maxOutputTokens,
    configuration: {
      baseURL: "https://openrouter.ai/api/v1",
    },
    modelKwargs: {

      headers: {
        "HTTP-Referer": "https://apex-cli.local",
        "X-Title": "Apex CLI Agent",
      },
    },
  });
}

function createGoogleLLM(options = {}) {
  if (!config.googleApiKey) {
    throw new Error(
      "Google API key not configured. Run: apex config set GOOGLE_API_KEY <your-key>"
    );
  }

  return new ChatGoogleGenerativeAI({
    model: options.model || config.model,
    apiKey: config.googleApiKey,
    temperature: options.temperature ?? config.temperature,
    maxOutputTokens: options.maxTokens || config.maxOutputTokens,
  });
}

export function createBaseLLM(options = {}) {
  if (config.llmProvider === "google") {
    return createGoogleLLM(options);
  }
  return createOpenRouterLLM(options);
}

export function createLLMWithTools(tools, options = {}) {
  const baseLLM = createBaseLLM(options);
  return baseLLM.bindTools(tools);
}

export function createPlannerLLM() {
  return createBaseLLM({ temperature: 0.3 });
}

export function createExecutorLLM(tools) {
  const llm = createBaseLLM({ temperature: 0.5 });
  return llm.bindTools(tools);
}

export function createReflectorLLM() {
  return createBaseLLM({ temperature: 0.2, maxTokens: 1024 });
}

export { SYSTEM_PROMPT };
