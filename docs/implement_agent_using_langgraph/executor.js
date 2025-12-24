/**
 * Executor Node
 * 
 * Executes subtasks using available tools and subagents.
 */

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import { AGENT_CONFIG } from "./config.js";
import { SubtaskStatus, updateSubtaskStatus } from "./state.js";
import { getAllTools } from "../tools/registry.js";

const executorLLM = new ChatGoogleGenerativeAI({
  model: AGENT_CONFIG.llm.model,
  temperature: 0.2,
  apiKey: AGENT_CONFIG.llm.apiKey,
}).bindTools(getAllTools());

/**
 * Executor Node
 * Executes the current subtask
 */
export async function executorNode(state) {
  const { plan, currentSubtask, history, metadata } = state;

  if (!currentSubtask) {
    return { error: "No subtask to execute" };
  }

  const systemPrompt = `${AGENT_CONFIG.prompts.executor}

Current subtask: ${currentSubtask.description}
Subtask type: ${currentSubtask.type}
Attempt: ${currentSubtask.attempts + 1}

Use the available tools to complete this subtask.
Be thorough and verify your work.`;

  try {
    // Execute with tools
    const response = await executorLLM.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(`Execute: ${currentSubtask.description}`),
    ]);

    // Check for tool calls
    const hasToolCalls = response.tool_calls && response.tool_calls.length > 0;

    // Record execution
    const executionRecord = {
      subtaskId: currentSubtask.id,
      action: currentSubtask.description,
      toolsUsed: hasToolCalls ? response.tool_calls.map(tc => tc.name) : [],
      result: response.content,
      timestamp: new Date().toISOString(),
      success: true,
    };

    // Update plan
    const updatedPlan = updateSubtaskStatus(
      plan,
      currentSubtask.id,
      SubtaskStatus.COMPLETED,
      response.content
    );

    return {
      plan: updatedPlan,
      currentSubtask: { ...currentSubtask, status: SubtaskStatus.COMPLETED },
      history: executionRecord,
      messages: [response],
      metadata: {
        totalActions: metadata.totalActions + 1,
        successfulActions: metadata.successfulActions + 1,
      },
    };
  } catch (error) {
    const errorRecord = {
      subtaskId: currentSubtask.id,
      action: currentSubtask.description,
      error: error.message,
      timestamp: new Date().toISOString(),
      success: false,
    };

    return {
      currentSubtask: {
        ...currentSubtask,
        attempts: currentSubtask.attempts + 1,
        error: error.message,
      },
      history: errorRecord,
      error: error.message,
      metadata: {
        totalActions: metadata.totalActions + 1,
      },
    };
  }
}

/**
 * Prepare next subtask for execution
 */
export function prepareSubtaskNode(state) {
  const { plan } = state;
  const { subtasks, currentIndex } = plan;

  if (currentIndex >= subtasks.length) {
    return { currentSubtask: null };
  }

  const nextSubtask = {
    ...subtasks[currentIndex],
    status: SubtaskStatus.IN_PROGRESS,
  };

  return { currentSubtask: nextSubtask };
}

export default executorNode;
