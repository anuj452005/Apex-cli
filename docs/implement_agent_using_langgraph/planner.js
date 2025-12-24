/**
 * Planner Node
 * 
 * Responsible for breaking down tasks into subtasks
 * and creating execution plans.
 */

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { AGENT_CONFIG } from "./config.js";
import { createSubtask, SubtaskStatus } from "./state.js";

const plannerLLM = new ChatGoogleGenerativeAI({
  model: AGENT_CONFIG.llm.model,
  temperature: 0.3,
  apiKey: AGENT_CONFIG.llm.apiKey,
});

/**
 * Planning Node
 * Creates a detailed execution plan from the user's task
 */
export async function plannerNode(state) {
  const { task, iteration } = state;

  // If replanning after failure
  const isReplanning = iteration > 0;

  const systemPrompt = AGENT_CONFIG.prompts.planner + `

${isReplanning ? `
IMPORTANT: This is attempt ${iteration + 1}. Previous attempts had issues.
Review the history and adjust your plan accordingly.
` : ""}

Output your plan in this JSON format:
{
  "analysis": "Brief analysis of the task",
  "subtasks": [
    {
      "id": "1",
      "description": "What to do",
      "type": "code|file|research|general",
      "dependencies": []
    }
  ],
  "estimatedComplexity": "low|medium|high"
}`;

  const response = await plannerLLM.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(`Task: ${task}\n\n${
      isReplanning ? `Previous attempts:\n${JSON.stringify(state.history.slice(-3))}` : ""
    }`),
  ]);

  // Parse the plan
  let planData;
  try {
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    planData = JSON.parse(jsonMatch ? jsonMatch[0] : "{}");
  } catch {
    planData = {
      analysis: response.content,
      subtasks: [{ id: "1", description: task, type: "general" }],
    };
  }

  // Create subtask objects
  const subtasks = (planData.subtasks || []).map((st, i) =>
    createSubtask(st.id || String(i + 1), st.description, st.type)
  );

  return {
    plan: {
      subtasks,
      currentIndex: 0,
      status: "executing",
      analysis: planData.analysis,
      complexity: planData.estimatedComplexity,
    },
    messages: [response],
  };
}

/**
 * Get next subtask to execute
 */
export function getNextSubtask(plan) {
  const { subtasks, currentIndex } = plan;
  
  if (currentIndex >= subtasks.length) {
    return null;
  }

  return subtasks[currentIndex];
}

/**
 * Update subtask status
 */
export function updateSubtaskStatus(plan, subtaskId, status, result = null) {
  const updatedSubtasks = plan.subtasks.map(st => {
    if (st.id === subtaskId) {
      return { ...st, status, result };
    }
    return st;
  });

  const nextIndex = status === SubtaskStatus.COMPLETED || status === SubtaskStatus.SKIPPED
    ? plan.currentIndex + 1
    : plan.currentIndex;

  return {
    ...plan,
    subtasks: updatedSubtasks,
    currentIndex: nextIndex,
  };
}

export default plannerNode;
