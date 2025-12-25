
import { Annotation } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";

export const AgentState = Annotation.Root({

  messages: Annotation({
    reducer: (currentMessages, newMessages) => currentMessages.concat(newMessages),
    default: () => [],
  }),

  plan: Annotation({
    reducer: (_, newPlan) => newPlan,
    default: () => null,
  }),

  currentStep: Annotation({
    reducer: (_, newStep) => newStep,
    default: () => 0,
  }),

  stepResults: Annotation({
    reducer: (current, newResults) => ({ ...current, ...newResults }),
    default: () => ({}),
  }),

  reflection: Annotation({
    reducer: (_, newReflection) => newReflection,
    default: () => null,
  }),

  pendingToolCall: Annotation({
    reducer: (_, newPending) => newPending,
    default: () => null,
  }),

  toolApproved: Annotation({
    reducer: (_, newApproval) => newApproval,
    default: () => null,
  }),

  iterations: Annotation({
    reducer: (_, newCount) => newCount,
    default: () => 0,
  }),

  error: Annotation({
    reducer: (_, newError) => newError,
    default: () => null,
  }),

  mode: Annotation({
    reducer: (_, newMode) => newMode,
    default: () => "agent",
  }),
});

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

export function isAgentComplete(state) {

  if (state.error) return true;

  if (!state.plan) return false;

  const allStepsComplete = state.plan.steps.every(
    (step) => state.stepResults[step.id]?.success === true
  );

  return allStepsComplete;
}
