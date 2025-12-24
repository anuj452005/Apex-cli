/**
 * LLM (Language Model) Setup
 * 
 * Initializes and exports the Gemini AI model for use across the application.
 * This is a shared module used by all LangGraph features.
 */

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { CHAT_CONFIG, validateConfig } from "./config.js";

// Validate config on module load
validateConfig();

/**
 * Primary LLM instance using Gemini
 * Used for chat conversations
 */
export const chatLLM = new ChatGoogleGenerativeAI({
  model: CHAT_CONFIG.llm.model,
  temperature: CHAT_CONFIG.llm.temperature,
  maxOutputTokens: CHAT_CONFIG.llm.maxTokens,
  apiKey: CHAT_CONFIG.llm.apiKey,
});

/**
 * Create a custom LLM with specific settings
 * Useful for different use cases (coding, creative, etc.)
 */
export function createCustomLLM(options = {}) {
  return new ChatGoogleGenerativeAI({
    model: options.model || CHAT_CONFIG.llm.model,
    temperature: options.temperature ?? CHAT_CONFIG.llm.temperature,
    maxOutputTokens: options.maxTokens || CHAT_CONFIG.llm.maxTokens,
    apiKey: CHAT_CONFIG.llm.apiKey,
    ...options,
  });
}

/**
 * LLM presets for different use cases
 */
export const LLM_PRESETS = {
  // For precise code generation
  coding: createCustomLLM({
    temperature: 0.2,
    model: "gemini-2.0-flash",
  }),

  // For creative responses
  creative: createCustomLLM({
    temperature: 0.9,
    model: "gemini-2.0-flash",
  }),

  // For balanced responses (default)
  balanced: chatLLM,
};

export default chatLLM;
