/**
 * ============================================================
 * 02 - State Basics: Understanding State and Reducers
 * ============================================================
 * 
 * Deep dive into LangGraph state management.
 * 
 * LEARNING GOALS:
 * - Understand different reducer patterns
 * - Learn when to use each type
 * - Handle complex state structures
 * - Understand message state patterns
 */

import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { BaseMessage, HumanMessage, AIMessage } from "@langchain/core/messages";

// ============================================================
// REDUCER PATTERNS
// ============================================================

/**
 * PATTERN 1: Replace Reducer
 * 
 * Use when you want the new value to completely replace the old.
 * Common for: counters, flags, current status, single objects
 */
const ReplaceState = Annotation.Root({
  // The underscore (_) means "ignore this parameter"
  currentValue: Annotation({
    reducer: (_, newValue) => newValue,
    default: () => null,
  }),
});

/**
 * PATTERN 2: Append Reducer
 * 
 * Use when you want to accumulate values in an array.
 * Common for: logs, history, message lists
 */
const AppendState = Annotation.Root({
  items: Annotation({
    reducer: (existingItems, newItems) => {
      // Handle both single item and array of items
      if (Array.isArray(newItems)) {
        return [...existingItems, ...newItems];
      }
      // Single item - wrap in array
      return [...existingItems, newItems];
    },
    default: () => [],
  }),
});

/**
 * PATTERN 3: Merge Reducer
 * 
 * Use for objects where you want to update specific fields.
 * Common for: metadata, settings, user info
 */
const MergeState = Annotation.Root({
  config: Annotation({
    reducer: (currentConfig, updates) => ({
      ...currentConfig,  // Keep existing fields
      ...updates,        // Overwrite with new fields
    }),
    default: () => ({
      theme: "dark",
      language: "en",
    }),
  }),
});

/**
 * PATTERN 4: Conditional Reducer
 * 
 * Use when update logic depends on the values.
 * Common for: max/min tracking, conditional updates
 */
const ConditionalState = Annotation.Root({
  highScore: Annotation({
    reducer: (current, newScore) => {
      // Only update if new score is higher
      return newScore > current ? newScore : current;
    },
    default: () => 0,
  }),
});

// ============================================================
// MESSAGES STATE (Most Common Pattern)
// ============================================================

/**
 * PATTERN 5: Messages State
 * 
 * This is the most common pattern in LangGraph for chat applications.
 * Messages accumulate as the conversation progresses.
 */
const MessagesState = Annotation.Root({
  // Messages array - the core of any chat application
  messages: Annotation({
    reducer: (currentMessages, newMessages) => {
      // Ensure newMessages is always an array
      const toAdd = Array.isArray(newMessages) ? newMessages : [newMessages];
      return [...currentMessages, ...toAdd];
    },
    default: () => [],
  }),
});

// ============================================================
// COMPLEX STATE EXAMPLE
// ============================================================

/**
 * A realistic state schema for a chat agent.
 * Combines multiple patterns.
 */
const AgentState = Annotation.Root({
  // Pattern: Append (messages accumulate)
  messages: Annotation({
    reducer: (curr, update) => [...curr, ...(Array.isArray(update) ? update : [update])],
    default: () => [],
  }),

  // Pattern: Replace (only latest input matters)
  currentInput: Annotation({
    reducer: (_, newValue) => newValue,
    default: () => "",
  }),

  // Pattern: Replace (current status)
  status: Annotation({
    reducer: (_, newValue) => newValue,
    default: () => "idle", // idle, thinking, responding, error
  }),

  // Pattern: Merge (metadata grows)
  metadata: Annotation({
    reducer: (curr, update) => ({ ...curr, ...update }),
    default: () => ({
      startTime: null,
      messageCount: 0,
      tokensUsed: 0,
    }),
  }),

  // Pattern: Replace (error state)
  error: Annotation({
    reducer: (_, newValue) => newValue,
    default: () => null,
  }),
});

// ============================================================
// EXAMPLE: Using State in Nodes
// ============================================================

// Node that processes user input
async function processInputNode(state) {
  console.log("📍 processInputNode");
  console.log("   Current messages:", state.messages.length);
  console.log("   Input:", state.currentInput);

  // Create a HumanMessage from the input
  const userMessage = new HumanMessage(state.currentInput);

  return {
    // Add the message to the array (append reducer)
    messages: [userMessage],
    // Update status (replace reducer)
    status: "thinking",
    // Update metadata (merge reducer)
    metadata: {
      messageCount: state.messages.length + 1,
    },
  };
}

// Node that generates a response
async function respondNode(state) {
  console.log("📍 respondNode");
  
  // Simulate AI response
  const aiMessage = new AIMessage("Hello! How can I help you today?");

  return {
    messages: [aiMessage],
    status: "idle",
    metadata: {
      lastResponseTime: new Date().toISOString(),
    },
  };
}

// ============================================================
// BUILD AND RUN
// ============================================================

async function main() {
  console.log("🚀 State Basics Example\n");
  console.log("=".repeat(50));

  // Build a simple graph
  const graph = new StateGraph(AgentState);

  graph.addNode("process_input", processInputNode);
  graph.addNode("respond", respondNode);

  graph.addEdge(START, "process_input");
  graph.addEdge("process_input", "respond");
  graph.addEdge("respond", END);

  const app = graph.compile();

  // Run with initial input
  const result = await app.invoke({
    currentInput: "Hello, AI!",
  });

  console.log("\n" + "=".repeat(50));
  console.log("\n✅ Final State:");
  console.log("   Status:", result.status);
  console.log("   Messages:", result.messages.length);
  console.log("   Metadata:", result.metadata);

  // Print messages
  console.log("\n📨 Messages:");
  result.messages.forEach((msg, i) => {
    const type = msg._getType ? msg._getType() : msg.constructor.name;
    console.log(`   ${i + 1}. [${type}] ${msg.content}`);
  });
}

main().catch(console.error);

// ============================================================
// KEY TAKEAWAYS:
// ============================================================
/**
 * 1. REPLACE reducer: (_, new) => new
 *    - For single values that get overwritten
 * 
 * 2. APPEND reducer: (curr, new) => [...curr, ...new]
 *    - For arrays that grow (messages, logs)
 * 
 * 3. MERGE reducer: (curr, new) => ({...curr, ...new})
 *    - For objects with partial updates
 * 
 * 4. The reducer determines HOW state updates happen
 * 
 * 5. Nodes return PARTIAL state - only what they change
 * 
 * 6. LangGraph handles merging using your reducers
 */
