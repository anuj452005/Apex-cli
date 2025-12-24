/**
 * LangGraph LLM Configuration
 * 
 * Configures the Gemini LLM with optional tool binding.
 */

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { config } from "../../config/google.config.js";

/**
 * System prompt for the agent
 */
export const SYSTEM_PROMPT = `You are a helpful AI assistant with access to various tools.
You can search the web, read files, perform calculations, and execute commands.
Some actions require user approval for safety.
Always explain what you're doing and why.
Be concise but thorough.`;

/**
 * Create a base LLM instance (without tools)
 */
export function createLLM() {
  if (!config.googleApiKey) {
    throw new Error(
      "GOOGLE_API_KEY is not set.\n\n" +
      "To fix this, run:\n" +
      "  apex config set GOOGLE_API_KEY <your-api-key>\n\n" +
      "Get your API key from: https://aistudio.google.com/apikey"
    );
  }

  return new ChatGoogleGenerativeAI({
    model: config.model,
    temperature: config.temperature,
    maxOutputTokens: config.maxOutputTokens,
    apiKey: config.googleApiKey,
  });
}

/**
 * Create an LLM instance with tools bound
 * @param {Array} tools - Array of tool definitions
 */
export function createLLMWithTools(tools) {
  const llm = createLLM();
  return llm.bindTools(tools);
}
