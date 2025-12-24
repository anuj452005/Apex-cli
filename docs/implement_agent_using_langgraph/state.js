/**
 * Agent State Definition
 * 
 * Complex state schema for the autonomous agent.
 * Tracks plans, subtasks, execution history, and reflections.
 */

import { Annotation } from "@langchain/langgraph";

/**
 * Subtask status enum
 */
export const SubtaskStatus = {
  PENDING: "pending",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  FAILED: "failed",
  SKIPPED: "skipped",
};

/**
 * Agent State Schema
 */
export const AgentState = Annotation.Root({
  // Original user task
  task: Annotation({
    reducer: (_, newValue) => newValue,
    default: () => "",
  }),

  // Execution plan with subtasks
  plan: Annotation({
    reducer: (_, newValue) => newValue,
    default: () => ({
      subtasks: [],
      currentIndex: 0,
      status: "planning",
    }),
  }),

  // Messages/conversation history
  messages: Annotation({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),

  // Current subtask being executed
  currentSubtask: Annotation({
    reducer: (_, newValue) => newValue,
    default: () => null,
  }),

  // Execution history
  history: Annotation({
    reducer: (current, update) => [...current, update],
    default: () => [],
  }),

  // Reflection/observations
  reflections: Annotation({
    reducer: (current, update) => [...current, update],
    default: () => [],
  }),

  // Active subagent
  activeSubagent: Annotation({
    reducer: (_, newValue) => newValue,
    default: () => null,
  }),

  // Error state
  error: Annotation({
    reducer: (_, newValue) => newValue,
    default: () => null,
  }),

  // Iteration counter
  iteration: Annotation({
    reducer: (_, newValue) => newValue,
    default: () => 0,
  }),

  // Final result
  result: Annotation({
    reducer: (_, newValue) => newValue,
    default: () => null,
  }),

  // Metadata
  metadata: Annotation({
    reducer: (current, newValue) => ({ ...current, ...newValue }),
    default: () => ({
      startTime: null,
      endTime: null,
      totalActions: 0,
      successfulActions: 0,
    }),
  }),
});

/**
 * Create initial agent state
 */
export function createAgentState(task) {
  return {
    task,
    plan: { subtasks: [], currentIndex: 0, status: "planning" },
    messages: [],
    currentSubtask: null,
    history: [],
    reflections: [],
    activeSubagent: null,
    error: null,
    iteration: 0,
    result: null,
    metadata: {
      startTime: new Date().toISOString(),
      endTime: null,
      totalActions: 0,
      successfulActions: 0,
    },
  };
}

/**
 * Subtask factory
 */
export function createSubtask(id, description, type = "general") {
  return {
    id,
    description,
    type,
    status: SubtaskStatus.PENDING,
    assignedTo: null,
    result: null,
    error: null,
    attempts: 0,
  };
}

export default AgentState;
