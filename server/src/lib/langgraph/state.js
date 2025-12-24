/**
 * LangGraph State Definition
 * 
 * Defines the state that flows through the agent graph.
 * Uses Annotation.Root for type-safe state management.
 */

import { Annotation } from "@langchain/langgraph";

/**
 * Agent State Schema
 * 
 * @property messages - Conversation history (append pattern)
 * @property sessionId - Unique session identifier
 * @property pendingToolCall - Tool awaiting approval
 * @property toolApproved - Whether pending tool was approved
 * @property iterations - Current iteration count
 * @property error - Error state
 */
export const AgentState = Annotation.Root({
  // Conversation messages - append pattern
  messages: Annotation({
    reducer: (curr, update) => [
      ...curr,
      ...(Array.isArray(update) ? update : [update]),
    ],
    default: () => [],
  }),

  // Session identifier - replace pattern
  sessionId: Annotation({
    reducer: (_, update) => update,
    default: () => `session_${Date.now()}`,
  }),

  // Pending tool call that needs approval
  pendingToolCall: Annotation({
    reducer: (_, update) => update,
    default: () => null,
  }),

  // Whether the pending tool call was approved
  toolApproved: Annotation({
    reducer: (_, update) => update,
    default: () => null,
  }),

  // Current iteration count (for loop prevention)
  iterations: Annotation({
    reducer: (curr, update) =>
      typeof update === "number" ? update : curr + 1,
    default: () => 0,
  }),

  // Error state
  error: Annotation({
    reducer: (_, update) => update,
    default: () => null,
  }),
});
