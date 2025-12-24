/**
 * LangGraph Node Functions for Chat
 * 
 * Each node is a function that transforms the state.
 * Nodes are the building blocks of the conversation graph.
 */

import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { chatLLM } from "./llm.js";
import { CHAT_CONFIG } from "./config.js";

/**
 * VALIDATE NODE
 * Validates and preprocesses user input
 * 
 * @param {ChatState} state - Current graph state
 * @returns {Partial<ChatState>} - State updates
 */
export async function validateInputNode(state) {
  const { currentInput } = state;

  // Check if input is empty or only whitespace
  if (!currentInput || currentInput.trim().length === 0) {
    return {
      error: "Please enter a message.",
    };
  }

  // Check for very long inputs (prevent abuse)
  if (currentInput.length > 10000) {
    return {
      error: "Message is too long. Please keep it under 10,000 characters.",
    };
  }

  // Clear any previous errors and prepare the input
  const humanMessage = new HumanMessage(currentInput.trim());

  return {
    messages: [humanMessage],
    error: null,
  };
}

/**
 * CHAT NODE
 * Core chat processing using Gemini AI
 * 
 * @param {ChatState} state - Current graph state
 * @returns {Partial<ChatState>} - State updates with AI response
 */
export async function chatNode(state) {
  const { messages, metadata } = state;

  try {
    // Build conversation context with system prompt
    const systemMessage = new SystemMessage(CHAT_CONFIG.systemPrompt);

    // Limit history to prevent context overflow
    const recentMessages = messages.slice(-CHAT_CONFIG.behavior.maxHistoryMessages);

    // Prepare messages for LLM
    const llmMessages = [systemMessage, ...recentMessages];

    // Get AI response
    const response = await chatLLM.invoke(llmMessages);

    // Create AI message
    const aiMessage = new AIMessage(response.content);

    // Update token count (approximate)
    const newTokens = (response.content?.length || 0) / 4; // Rough estimate

    return {
      messages: [aiMessage],
      metadata: {
        totalTokens: (metadata.totalTokens || 0) + newTokens,
        lastResponseTime: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error("Chat node error:", error);
    
    return {
      error: `AI Error: ${error.message}`,
    };
  }
}

/**
 * FORMAT RESPONSE NODE
 * Formats the AI response for CLI display
 * 
 * @param {ChatState} state - Current graph state
 * @returns {Partial<ChatState>} - No state changes (terminal node)
 */
export async function formatResponseNode(state) {
  // This node is mainly for side effects (display)
  // The actual formatting happens in the CLI command
  // Here we just ensure the state is clean

  return {
    currentInput: "", // Clear for next input
  };
}

/**
 * ERROR HANDLER NODE
 * Handles errors gracefully
 * 
 * @param {ChatState} state - Current graph state
 * @returns {Partial<ChatState>} - State with error message
 */
export async function errorHandlerNode(state) {
  const { error } = state;

  // Log error for debugging
  console.error("Chat error:", error);

  // Create an error message for the user
  const errorMessage = new AIMessage(
    `I encountered an error: ${error}\n\nPlease try again or type 'exit' to quit.`
  );

  return {
    messages: [errorMessage],
    error: null, // Clear error after handling
  };
}

/**
 * Node routing function
 * Determines the next node based on current state
 */
export function routeAfterValidation(state) {
  if (state.error) {
    return "error_handler";
  }
  return "chat";
}

export function routeAfterChat(state) {
  if (state.error) {
    return "error_handler";
  }
  return "format_response";
}
