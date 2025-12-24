/**
 * Reflector Node
 * 
 * Self-reflection and evaluation after each action.
 * Determines if corrections are needed.
 */

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { AGENT_CONFIG } from "./config.js";
import { SubtaskStatus } from "./state.js";

const reflectorLLM = new ChatGoogleGenerativeAI({
  model: AGENT_CONFIG.llm.model,
  temperature: 0.2,
  apiKey: AGENT_CONFIG.llm.apiKey,
});

/**
 * Reflector Node
 * Evaluates the last execution and decides next steps
 */
export async function reflectorNode(state) {
  const { currentSubtask, history, plan, error } = state;
  const lastExecution = history[history.length - 1];

  if (!lastExecution) {
    return { reflections: { type: "skip", reason: "No execution to reflect on" } };
  }

  const systemPrompt = `${AGENT_CONFIG.prompts.reflector}

Evaluate this execution:
- Subtask: ${currentSubtask?.description}
- Result: ${lastExecution.result || lastExecution.error}
- Success: ${lastExecution.success}

Output your reflection in JSON:
{
  "evaluation": "success|partial|failure",
  "issues": ["list of issues if any"],
  "corrections": ["suggested corrections if needed"],
  "shouldRetry": true/false,
  "shouldContinue": true/false,
  "notes": "any additional observations"
}`;

  const response = await reflectorLLM.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(`Reflect on: ${JSON.stringify(lastExecution)}`),
  ]);

  // Parse reflection
  let reflection;
  try {
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    reflection = JSON.parse(jsonMatch ? jsonMatch[0] : "{}");
  } catch {
    reflection = {
      evaluation: lastExecution.success ? "success" : "failure",
      shouldRetry: !lastExecution.success,
      shouldContinue: lastExecution.success,
      notes: response.content,
    };
  }

  reflection.subtaskId = currentSubtask?.id;
  reflection.timestamp = new Date().toISOString();

  return {
    reflections: reflection,
    error: reflection.evaluation === "failure" ? reflection.issues?.join(", ") : null,
  };
}

/**
 * Routing after reflection
 * Decides: retry, continue, or complete
 */
export function routeAfterReflection(state) {
  const { plan, reflections, iteration, error, currentSubtask } = state;
  const lastReflection = reflections[reflections.length - 1];

  // Check max iterations
  if (iteration >= AGENT_CONFIG.behavior.maxIterations) {
    return "complete";
  }

  // Check if all subtasks done
  if (plan.currentIndex >= plan.subtasks.length) {
    return "complete";
  }

  // Check if should retry
  if (lastReflection?.shouldRetry && currentSubtask?.attempts < AGENT_CONFIG.behavior.maxRetries) {
    return "retry";
  }

  // Continue to next subtask
  return "continue";
}

export default reflectorNode;
