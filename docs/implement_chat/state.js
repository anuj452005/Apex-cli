/**
 * Chat State Definition using LangGraph Annotation API
 * 
 * This file defines the state schema for the chat graph.
 * The state maintains conversation history and metadata.
 */

import { Annotation } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";

/**
 * Chat State Schema
 * Uses LangGraph's Annotation API for type-safe state management
 */
export const ChatState = Annotation.Root({
  /**
   * Array of messages in the conversation
   * Uses reducer to append new messages rather than replacing
   */
  messages: Annotation({
    reducer: (currentMessages, newMessages) => {
      // Handle both single message and array of messages
      if (Array.isArray(newMessages)) {
        return [...currentMessages, ...newMessages];
      }
      return [...currentMessages, newMessages];
    },
    default: () => [],
  }),

  /**
   * Unique session identifier for conversation tracking
   */
  sessionId: Annotation({
    reducer: (_, newValue) => newValue,
    default: () => `session_${Date.now()}`,
  }),

  /**
   * User information from authentication
   */
  user: Annotation({
    reducer: (_, newValue) => newValue,
    default: () => null,
  }),

  /**
   * Current input from the user (transient)
   */
  currentInput: Annotation({
    reducer: (_, newValue) => newValue,
    default: () => "",
  }),

  /**
   * Error state for graceful error handling
   */
  error: Annotation({
    reducer: (_, newValue) => newValue,
    default: () => null,
  }),

  /**
   * Metadata for tracking tokens, timing, etc.
   */
  metadata: Annotation({
    reducer: (current, newValue) => ({ ...current, ...newValue }),
    default: () => ({
      totalTokens: 0,
      startTime: null,
      model: "gemini-2.0-flash",
    }),
  }),
});

/**
 * Initial state factory
 * Creates a fresh state for new conversations
 */
export function createInitialState(user = null) {
  return {
    messages: [],
    sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    user,
    currentInput: "",
    error: null,
    metadata: {
      totalTokens: 0,
      startTime: new Date().toISOString(),
      model: "gemini-2.0-flash",
    },
  };
}

export default ChatState;
