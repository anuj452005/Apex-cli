/**
 * Chat Configuration
 * 
 * Central configuration for the chat feature.
 * All configurable values are defined here.
 */

import dotenv from "dotenv";
dotenv.config();

export const CHAT_CONFIG = {
  // LLM Configuration
  llm: {
    model: "gemini-2.0-flash",
    temperature: 0.7,
    maxTokens: 4096,
    apiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY,
  },

  // System prompt for the AI assistant
  systemPrompt: `You are Apex AI, a helpful and knowledgeable CLI assistant. 
You are running inside a terminal environment.

Guidelines:
- Be concise but thorough in your responses
- Format code blocks with proper syntax highlighting hints
- When explaining code, break it down step by step
- If you're unsure about something, say so
- Use markdown formatting for better readability in the terminal
- Be friendly and professional

You can help with:
- Answering programming questions
- Explaining concepts
- Reviewing code
- Suggesting best practices
- General assistance`,

  // Chat behavior settings
  behavior: {
    maxHistoryMessages: 20,  // Keep last N messages in context
    streamResponse: true,     // Stream responses for better UX
    showThinking: false,      // Show "thinking" indicator
  },

  // UI/UX settings for CLI
  ui: {
    promptSymbol: "❯",
    userColor: "cyan",
    aiColor: "green",
    errorColor: "red",
    thinkingMessage: "Thinking...",
  },

  // Rate limiting
  rateLimit: {
    maxRequestsPerMinute: 30,
    cooldownMs: 2000,
  },
};

/**
 * Validate configuration
 * Ensures required values are present
 */
export function validateConfig() {
  const errors = [];

  if (!CHAT_CONFIG.llm.apiKey) {
    errors.push("Missing GOOGLE_API_KEY or GEMINI_API_KEY in environment");
  }

  if (errors.length > 0) {
    throw new Error(`Configuration errors:\n${errors.join("\n")}`);
  }

  return true;
}

export default CHAT_CONFIG;
