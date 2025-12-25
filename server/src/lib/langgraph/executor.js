
import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import chalk from "chalk";

import { createExecutorLLM } from "./llm.js";
import { EXECUTOR_PROMPT } from "../../config/google.config.js";
import { allTools, safeTools, isDangerousTool, getToolByName, getToolDescriptions } from "./tools.js";
import { getCurrentStep, getProgressString } from "./planner.js";
import { config } from "../../config/google.config.js";

const safeToolNode = new ToolNode(safeTools);

export async function executorNode(state) {
  const progress = getProgressString(state);
  console.log(chalk.cyan(`\n📍 [Executor] Step ${state.currentStep + 1} (${progress})`));

  try {

    const currentStep = getCurrentStep(state);

    if (!currentStep) {

      console.log(chalk.green("   ✅ All steps complete!"));
      return {
        reflection: {
          assessment: "All steps completed",
          success: true,
          decision: "finish",
          reasoning: "No more steps in the plan",
        },
      };
    }

    console.log(chalk.gray(`   Step: "${currentStep.description.slice(0, 60)}..."`));

    const existingResult = state.stepResults[currentStep.id];
    if (existingResult?.retries >= config.maxRetries) {
      console.log(chalk.yellow(`   ⚠️ Max retries reached for this step`));
      return {
        stepResults: {
          [currentStep.id]: {
            ...existingResult,
            success: false,
            error: "Max retries reached",
          },
        },
        error: `Step ${currentStep.id} failed after ${config.maxRetries} retries`,
      };
    }

    const isSimpleQuery = state.plan?.query_type === "simple";

    const userMessages = state.messages.filter(
      (m) => m._getType() === "human" || m.constructor.name === "HumanMessage"
    );
    const userMessage = userMessages.length > 0
      ? userMessages[userMessages.length - 1].content
      : "";

    if (isSimpleQuery) {
      console.log(chalk.cyan(`   💬 Simple query - generating direct response`));

      const simplePrompt = `You are Apex, a friendly AI coding assistant.

The user said: "${userMessage}"

Respond naturally and conversationally. Be friendly and helpful.
- For greetings: Respond with a warm greeting and offer to help
- For "who are you": Briefly introduce yourself as Apex CLI agent
- For thanks: Acknowledge warmly
- Keep it concise but friendly`;

      const llm = createExecutorLLM([]);

      const response = await llm.invoke([
        new SystemMessage(simplePrompt),
        new HumanMessage(userMessage),
      ]);

      console.log(chalk.green(`   ✅ Direct response generated`));

      return {
        messages: [response],
        stepResults: {
          [currentStep.id]: {
            success: true,
            output: response.content,
            retries: 0,
          },
        },
        iterations: state.iterations + 1,
      };
    }

    const previousResults = Object.entries(state.stepResults)
      .map(([id, result]) => {
        const status = result.success ? "✓ SUCCESS" : "✗ FAILED";
        const output = result.output || result.error || "(no output)";

        return `Step ${id} ${status}:\n${output.slice(0, 1000)}`;
      })
      .join("\n\n");

    const isAnalysisStep = currentStep.tools_needed?.length === 0 ||
      /analyze|summarize|present|explain|synthesize|review/i.test(currentStep.description);

    let contextPrompt;

    if (isAnalysisStep && previousResults) {

      contextPrompt = `${EXECUTOR_PROMPT}

## IMPORTANT: This is an ANALYSIS step
You should analyze and synthesize the information from Previous Results below.
DO NOT call any tools - just provide your analysis based on the data already collected.

## Overall Goal:
${state.plan?.goal || "Complete the user's request"}

## Current Step to Execute:
Step ${currentStep.id}: ${currentStep.description}

## Previous Results (USE THIS DATA):
${previousResults}

Based on the Previous Results above, provide a clear and helpful response.`;
    } else {

      contextPrompt = `${EXECUTOR_PROMPT}

## Available Tools:
${getToolDescriptions()}

## Overall Goal:
${state.plan?.goal || "Complete the user's request"}

## Current Step to Execute:
Step ${currentStep.id}: ${currentStep.description}

## Previous Results:
${previousResults || "No previous steps"}

Now complete this step using the appropriate tools.`;
    }

    const llm = isAnalysisStep ? createExecutorLLM([]) : createExecutorLLM(allTools);

    const response = await llm.invoke([
      new SystemMessage(contextPrompt),
      new HumanMessage(`Execute step ${currentStep.id}: ${currentStep.description}`),
    ]);

    if (response.tool_calls && response.tool_calls.length > 0) {

      for (const toolCall of response.tool_calls) {
        if (isDangerousTool(toolCall.name)) {
          console.log(chalk.yellow(`   ⚠️ Dangerous tool: ${toolCall.name}`));

          return {
            messages: [response],
            pendingToolCall: {
              id: toolCall.id,
              name: toolCall.name,
              args: toolCall.args,
              stepId: currentStep.id,
            },
            iterations: state.iterations + 1,
          };
        }
      }

      console.log(chalk.cyan(`   🔧 Executing: ${response.tool_calls.map(t => t.name).join(", ")}`));

      const toolResults = await executeTools(response.tool_calls);

      return {
        messages: [response, ...toolResults],
        stepResults: {
          [currentStep.id]: {
            success: true,
            output: toolResults.map(t => t.content).join("\n").slice(0, 500),
            retries: existingResult?.retries || 0,
          },
        },
        iterations: state.iterations + 1,
      };
    }

    console.log(chalk.gray(`   💬 Response without tools`));

    return {
      messages: [response],
      stepResults: {
        [currentStep.id]: {
          success: true,
          output: response.content.slice(0, 500),
          retries: existingResult?.retries || 0,
        },
      },
      iterations: state.iterations + 1,
    };

  } catch (error) {
    console.error(chalk.red(`   ❌ Executor error: ${error.message}`));

    const currentStep = getCurrentStep(state);
    const existingResult = state.stepResults[currentStep?.id];

    return {
      stepResults: {
        [currentStep?.id || 0]: {
          success: false,
          error: error.message,
          retries: (existingResult?.retries || 0) + 1,
        },
      },
      error: error.message,
      iterations: state.iterations + 1,
    };
  }
}

async function executeTools(toolCalls) {
  const results = [];

  for (const toolCall of toolCalls) {
    const tool = getToolByName(toolCall.name);

    if (!tool) {
      results.push(new ToolMessage({
        content: `Tool not found: ${toolCall.name}`,
        tool_call_id: toolCall.id,
        name: toolCall.name,
      }));
      continue;
    }

    try {
      const result = await tool.invoke(toolCall.args);
      results.push(new ToolMessage({
        content: result,
        tool_call_id: toolCall.id,
        name: toolCall.name,
      }));
      console.log(chalk.green(`      ✅ ${toolCall.name} completed`));
    } catch (error) {
      results.push(new ToolMessage({
        content: `Error: ${error.message}`,
        tool_call_id: toolCall.id,
        name: toolCall.name,
      }));
      console.log(chalk.red(`      ❌ ${toolCall.name} failed`));
    }
  }

  return results;
}

export async function executeDangerousToolNode(state) {
  console.log(chalk.cyan("\n📍 [Execute Dangerous Tool]"));

  const pending = state.pendingToolCall;

  if (!pending) {
    console.log(chalk.yellow("   No pending tool"));
    return { pendingToolCall: null };
  }

  if (!state.toolApproved) {
    console.log(chalk.red("   ❌ Tool was rejected"));

    return {
      messages: [
        new ToolMessage({
          content: "User rejected this action. Try a different approach.",
          tool_call_id: pending.id,
          name: pending.name,
        }),
      ],
      pendingToolCall: null,
      toolApproved: null,
      stepResults: {
        [pending.stepId]: {
          success: false,
          error: "User rejected the action",
          retries: (state.stepResults[pending.stepId]?.retries || 0) + 1,
        },
      },
    };
  }

  console.log(chalk.green(`   ✅ Executing approved tool: ${pending.name}`));

  const tool = getToolByName(pending.name);

  if (!tool) {
    return {
      messages: [
        new ToolMessage({
          content: `Tool not found: ${pending.name}`,
          tool_call_id: pending.id,
          name: pending.name,
        }),
      ],
      pendingToolCall: null,
      toolApproved: null,
    };
  }

  try {
    const result = await tool.invoke(pending.args);

    return {
      messages: [
        new ToolMessage({
          content: result,
          tool_call_id: pending.id,
          name: pending.name,
        }),
      ],
      pendingToolCall: null,
      toolApproved: null,
      stepResults: {
        [pending.stepId]: {
          success: true,
          output: result.slice(0, 500),
          retries: state.stepResults[pending.stepId]?.retries || 0,
        },
      },
    };
  } catch (error) {
    return {
      messages: [
        new ToolMessage({
          content: `Error: ${error.message}`,
          tool_call_id: pending.id,
          name: pending.name,
        }),
      ],
      pendingToolCall: null,
      toolApproved: null,
      stepResults: {
        [pending.stepId]: {
          success: false,
          error: error.message,
          retries: (state.stepResults[pending.stepId]?.retries || 0) + 1,
        },
      },
      error: error.message,
    };
  }
}
