/**
 * ============================================================================
 * 📚 LANGGRAPH LEARNING PATH - FILE 3 OF 11
 * ============================================================================
 * 
 * 📖 WHAT IS THIS FILE?
 *    This is the LLM file - sets up the AI model that powers the agent.
 *    It supports both OpenRouter (recommended) and Google Gemini.
 * 
 * 📝 PREREQUISITES: Read state.js (1/11) and config.js (2/11) first
 * 
 * ➡️  NEXT FILE: After understanding this, read tools.js (4/11)
 * 
 * ============================================================================
 */

import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { config, SYSTEM_PROMPT } from "../../config/google.config.js";

// ============================================================================
// OPENROUTER LLM (RECOMMENDED)
// ============================================================================
/**
 * Creates an LLM using OpenRouter API.
 * Uses ChatOpenAI with custom baseURL pointing to OpenRouter.
 */
function createOpenRouterLLM(options = {}) {
  if (!config.openRouterApiKey) {
    throw new Error(
      "OpenRouter API key not configured. Run: apex config set OPENROUTER_API_KEY <your-key>\n" +
      "Get your key at: https://openrouter.ai/keys"
    );
  }

  // Set the API key in environment for ChatOpenAI to pick up
  process.env.OPENAI_API_KEY = config.openRouterApiKey;

  return new ChatOpenAI({
    modelName: options.model || config.model,
    temperature: options.temperature ?? config.temperature,
    maxTokens: options.maxTokens || config.maxOutputTokens,
    configuration: {
      baseURL: "https://openrouter.ai/api/v1",
    },
    modelKwargs: {
      // OpenRouter specific headers
      headers: {
        "HTTP-Referer": "https://apex-cli.local",
        "X-Title": "Apex CLI Agent",
      },
    },
  });
}

// ============================================================================
// GOOGLE GEMINI LLM (ALTERNATIVE)
// ============================================================================
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

// ============================================================================
// BASE LLM FACTORY
// ============================================================================
/**
 * Creates a base LLM based on the configured provider.
 */
export function createBaseLLM(options = {}) {
  if (config.llmProvider === "google") {
    return createGoogleLLM(options);
  }
  return createOpenRouterLLM(options);
}

// ============================================================================
// LLM WITH TOOLS
// ============================================================================
/**
 * Creates an LLM with tools bound to it.
 */
export function createLLMWithTools(tools, options = {}) {
  const baseLLM = createBaseLLM(options);
  return baseLLM.bindTools(tools);
}

// ============================================================================
// SPECIALIZED LLMs FOR EACH AGENT ROLE
// ============================================================================

/**
 * Create an LLM optimized for the Planner role.
 * Lower temperature for more structured output.
 */
export function createPlannerLLM() {
  return createBaseLLM({ temperature: 0.3 });
}

/**
 * Create an LLM optimized for the Executor role.
 * Balanced temperature for task execution.
 */
export function createExecutorLLM(tools) {
  const llm = createBaseLLM({ temperature: 0.5 });
  return llm.bindTools(tools);
}

/**
 * Create an LLM optimized for the Reflector role.
 * Very low temperature for consistent evaluations.
 */
export function createReflectorLLM() {
  return createBaseLLM({ temperature: 0.2, maxTokens: 1024 });
}

// Re-export system prompt
export { SYSTEM_PROMPT };

// ============================================================================
// 📝 WHAT'S NEXT?
// ============================================================================
/**
 * ➡️  NEXT: Read tools.js (4/11) to see how tools are defined
 */
