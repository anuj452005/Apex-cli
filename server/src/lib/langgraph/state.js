/**
 * ============================================================================
 * 📚 LANGGRAPH LEARNING PATH - FILE 1 OF 11
 * ============================================================================
 * 
 * 📖 WHAT IS THIS FILE?
 *    This is the STATE file - the foundation of any LangGraph application.
 *    State defines what data flows through your graph.
 * 
 * 📝 PREREQUISITES: None! This is where you start.
 * 
 * ➡️  NEXT FILE: After understanding this, read config.js (2/11)
 * 
 * ============================================================================
 * 
 * 🧠 WHAT IS STATE IN LANGGRAPH?
 * 
 * Think of State as a "shared memory" that all nodes in your graph can read
 * and write to. Every time a node runs, it:
 *   1. Receives the current state
 *   2. Does some work
 *   3. Returns updates to the state
 * 
 * For an AI agent, the state typically contains:
 *   - messages: The conversation history
 *   - any other data the agent needs to track
 * 
 * ============================================================================
 */

import { Annotation } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";

// ============================================================================
// UNDERSTANDING ANNOTATIONS
// ============================================================================
/**
 * In LangGraph, we define state using "Annotations". 
 * 
 * An Annotation does two things:
 *   1. Defines the TYPE of each piece of state (string, number, array, etc.)
 *   2. Defines a REDUCER - how to combine old state with new state
 * 
 * The most common reducer for messages is to APPEND new messages:
 *   Old: ["Hi"]  +  New: ["Hello!"]  =  Result: ["Hi", "Hello!"]
 */

// ============================================================================
// AGENT STATE DEFINITION
// ============================================================================
/**
 * AgentState - The complete state for our Planner/Executor/Reflector agent
 * 
 * This state supports a multi-step workflow:
 *   1. PLANNER creates a plan with steps
 *   2. EXECUTOR works through each step
 *   3. REFLECTOR evaluates and decides next action
 */
export const AgentState = Annotation.Root({
  // ─────────────────────────────────────────────────────────────────────────
  // MESSAGES - The conversation history
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * All messages in the conversation (human, AI, tool results).
   * 
   * The reducer function (x, y) => x.concat(y) means:
   *   - Take existing messages (x)
   *   - Add new messages (y) to the end
   *   - Return the combined array
   * 
   * This is necessary because each node only returns NEW messages,
   * not the entire history.
   */
  messages: Annotation({
    reducer: (currentMessages, newMessages) => currentMessages.concat(newMessages),
    default: () => [],
  }),

  // ─────────────────────────────────────────────────────────────────────────
  // PLAN - The task breakdown from the Planner
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * The plan created by the Planner node.
   * 
   * Structure:
   * {
   *   goal: "User's original task",
   *   steps: [
   *     { id: 1, description: "First step", status: "pending" },
   *     { id: 2, description: "Second step", status: "pending" },
   *   ]
   * }
   * 
   * No reducer needed - we replace the entire plan when updated.
   */
  plan: Annotation({
    reducer: (_, newPlan) => newPlan, // Replace with new value
    default: () => null,
  }),

  // ─────────────────────────────────────────────────────────────────────────
  // CURRENT STEP - Which step the Executor is working on
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Index of the current step being executed (0-based).
   * 
   * Example: If plan has 4 steps and currentStep is 1,
   *          the Executor is working on the second step.
   */
  currentStep: Annotation({
    reducer: (_, newStep) => newStep,
    default: () => 0,
  }),

  // ─────────────────────────────────────────────────────────────────────────
  // STEP RESULTS - Outcomes from each executed step
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Results from each step, stored by step ID.
   * 
   * Structure:
   * {
   *   1: { success: true, output: "Created file", retries: 0 },
   *   2: { success: false, error: "Permission denied", retries: 1 },
   * }
   * 
   * Uses a merge reducer - new results are merged with existing ones.
   */
  stepResults: Annotation({
    reducer: (current, newResults) => ({ ...current, ...newResults }),
    default: () => ({}),
  }),

  // ─────────────────────────────────────────────────────────────────────────
  // REFLECTION - The Reflector's evaluation
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * The Reflector's analysis of the current state.
   * 
   * Structure:
   * {
   *   assessment: "Step completed successfully",
   *   decision: "continue" | "retry" | "finish" | "error",
   *   reasoning: "Why this decision was made"
   * }
   */
  reflection: Annotation({
    reducer: (_, newReflection) => newReflection,
    default: () => null,
  }),

  // ─────────────────────────────────────────────────────────────────────────
  // PENDING TOOL CALL - For human-in-the-loop approval
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * When a dangerous tool is requested, store it here for approval.
   * 
   * Structure:
   * {
   *   id: "tool_call_123",
   *   name: "shell_command",
   *   args: { command: "rm -rf /" }  // would need approval!
   * }
   */
  pendingToolCall: Annotation({
    reducer: (_, newPending) => newPending,
    default: () => null,
  }),

  // ─────────────────────────────────────────────────────────────────────────
  // TOOL APPROVED - User's response to approval request
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Whether the user approved the pending dangerous tool.
   * true = approved, false = rejected, null = no pending approval
   */
  toolApproved: Annotation({
    reducer: (_, newApproval) => newApproval,
    default: () => null,
  }),

  // ─────────────────────────────────────────────────────────────────────────
  // ITERATIONS - Safety counter to prevent infinite loops
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Count of how many times we've gone through the agent loop.
   * Used to prevent infinite loops by setting a max iteration limit.
   */
  iterations: Annotation({
    reducer: (_, newCount) => newCount,
    default: () => 0,
  }),

  // ─────────────────────────────────────────────────────────────────────────
  // ERROR - For error handling
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Any error message that occurred during processing.
   * Used for graceful error handling and user feedback.
   */
  error: Annotation({
    reducer: (_, newError) => newError,
    default: () => null,
  }),

  // ─────────────────────────────────────────────────────────────────────────
  // AGENT MODE - Simple chat or full planner mode
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * The agent can operate in two modes:
   *   - "chat": Simple back-and-forth (no planning)
   *   - "agent": Full Planner → Executor → Reflector flow
   * 
   * This allows using the same code for both `apex chat` and `apex agent`
   */
  mode: Annotation({
    reducer: (_, newMode) => newMode,
    default: () => "agent",
  }),
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create an initial state object
 * 
 * This is useful when starting a new conversation.
 * 
 * @example
 * const initialState = createInitialState();
 * const result = await graph.invoke(initialState);
 */
export function createInitialState(mode = "agent") {
  return {
    messages: [],
    plan: null,
    currentStep: 0,
    stepResults: {},
    reflection: null,
    pendingToolCall: null,
    toolApproved: null,
    iterations: 0,
    error: null,
    mode,
  };
}

/**
 * Check if the agent should stop (all steps complete or error)
 */
export function isAgentComplete(state) {
  // Error state - stop
  if (state.error) return true;
  
  // No plan yet - not complete
  if (!state.plan) return false;
  
  // Check if all steps are done
  const allStepsComplete = state.plan.steps.every(
    (step) => state.stepResults[step.id]?.success === true
  );
  
  return allStepsComplete;
}

// ============================================================================
// 📝 WHAT'S NEXT?
// ============================================================================
/**
 * Great! You now understand:
 *   ✅ What State is (shared data in the graph)
 *   ✅ What Annotations are (type definitions with reducers)
 *   ✅ The state structure for our Planner/Executor/Reflector agent
 * 
 * ➡️  NEXT: Read config.js (2/11) to see the configuration and prompts
 */
