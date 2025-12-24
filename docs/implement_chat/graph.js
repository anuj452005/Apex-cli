/**
 * LangGraph Chat Graph Definition
 * 
 * This file defines the complete conversation graph using LangGraph.
 * The graph orchestrates the flow of chat messages through various nodes.
 */

import { StateGraph, START, END } from "@langchain/langgraph";
import { ChatState, createInitialState } from "./state.js";
import {
  validateInputNode,
  chatNode,
  formatResponseNode,
  errorHandlerNode,
  routeAfterValidation,
  routeAfterChat,
} from "./nodes.js";
import { memoryCheckpointer, sessionManager } from "./checkpointer.js";

/**
 * Build the Chat Graph
 * 
 * Graph Flow:
 * START → validate_input → chat → format_response → END
 *              ↓                         ↓
 *         error_handler ←───────────────┘
 *              ↓
 *             END
 */
function buildChatGraph() {
  // Create a new StateGraph with our state schema
  const graph = new StateGraph(ChatState);

  // Add nodes to the graph
  graph.addNode("validate_input", validateInputNode);
  graph.addNode("chat", chatNode);
  graph.addNode("format_response", formatResponseNode);
  graph.addNode("error_handler", errorHandlerNode);

  // Define edges (flow)
  
  // Start → Validate
  graph.addEdge(START, "validate_input");

  // Validate → Chat or Error (conditional)
  graph.addConditionalEdges("validate_input", routeAfterValidation, {
    chat: "chat",
    error_handler: "error_handler",
  });

  // Chat → Format or Error (conditional)
  graph.addConditionalEdges("chat", routeAfterChat, {
    format_response: "format_response",
    error_handler: "error_handler",
  });

  // Format → End
  graph.addEdge("format_response", END);

  // Error → End
  graph.addEdge("error_handler", END);

  return graph;
}

/**
 * Compiled Chat Application
 * Ready to use for invoking conversations
 */
export const chatGraph = buildChatGraph().compile({
  checkpointer: memoryCheckpointer,
});

/**
 * Chat Session Handler
 * Manages a complete chat session with persistence
 */
export class ChatSession {
  constructor(user = null, sessionId = null) {
    this.user = user;
    this.sessionId = sessionId || `session_${Date.now()}`;
    this.state = null;
  }

  /**
   * Initialize or resume a session
   */
  async init() {
    // Try to load existing session
    const existingState = await sessionManager.loadSession(this.sessionId);

    if (existingState) {
      this.state = existingState;
    } else {
      this.state = createInitialState(this.user);
      this.state.sessionId = this.sessionId;
    }

    return this;
  }

  /**
   * Send a message and get a response
   */
  async sendMessage(message) {
    // Prepare input state
    const inputState = {
      ...this.state,
      currentInput: message,
    };

    // Run the graph with thread ID for checkpointing
    const config = {
      configurable: {
        thread_id: this.sessionId,
      },
    };

    // Invoke the graph
    const result = await chatGraph.invoke(inputState, config);

    // Update local state
    this.state = result;

    // Persist session
    await sessionManager.saveSession(this.sessionId, this.state);

    // Return the last AI message
    const aiMessages = result.messages.filter(
      (m) => m._getType?.() === "ai" || m.constructor.name === "AIMessage"
    );

    return aiMessages[aiMessages.length - 1]?.content || null;
  }

  /**
   * Get conversation history
   */
  getHistory() {
    return this.state?.messages || [];
  }

  /**
   * Clear conversation history
   */
  async clearHistory() {
    this.state = createInitialState(this.user);
    this.state.sessionId = this.sessionId;
    await sessionManager.saveSession(this.sessionId, this.state);
  }
}

/**
 * Quick chat function for one-off messages
 * (No session persistence)
 */
export async function quickChat(message, user = null) {
  const initialState = createInitialState(user);
  initialState.currentInput = message;

  const result = await chatGraph.invoke(initialState);

  const aiMessages = result.messages.filter(
    (m) => m._getType?.() === "ai" || m.constructor.name === "AIMessage"
  );

  return aiMessages[aiMessages.length - 1]?.content || null;
}

export default chatGraph;
