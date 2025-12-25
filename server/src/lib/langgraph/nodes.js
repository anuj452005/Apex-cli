
import readline from "readline";
import chalk from "chalk";
import { AIMessage, ToolMessage, SystemMessage } from "@langchain/core/messages";
import { ToolNode } from "@langchain/langgraph/prebuilt";

export { plannerNode, getCurrentStep, isAllStepsComplete, getProgressString } from "./planner.js";

export { executorNode, executeDangerousToolNode } from "./executor.js";

export { reflectorNode, routeAfterReflector } from "./reflector.js";

import { createLLMWithTools, SYSTEM_PROMPT } from "./llm.js";
import { allTools, safeTools, isDangerousTool, getToolByName } from "./tools.js";
import { config } from "../../config/google.config.js";

export async function simpleAgentNode(state) {
  console.log(chalk.gray("\n📍 [Agent] Thinking..."));

  try {

    if (state.iterations >= config.maxIterations) {
      console.log(chalk.yellow("   ⚠️ Max iterations reached"));
      return {
        messages: [
          new AIMessage(
            "I've reached the maximum number of steps. Let me summarize what I've done."
          ),
        ],
        error: "Max iterations reached",
      };
    }

    const systemMessage = new SystemMessage(SYSTEM_PROMPT);
    const allMessages = [systemMessage, ...state.messages];

    let _llmWithTools = null;
    if (!_llmWithTools) {
      _llmWithTools = createLLMWithTools(allTools);
    }

    const response = await _llmWithTools.invoke(allMessages);

    if (response.tool_calls?.length > 0) {
      for (const toolCall of response.tool_calls) {
        if (isDangerousTool(toolCall.name)) {
          console.log(chalk.yellow(`   ⚠️ Dangerous tool: ${toolCall.name}`));
          return {
            messages: [response],
            pendingToolCall: {
              id: toolCall.id,
              name: toolCall.name,
              args: toolCall.args,
            },
            iterations: state.iterations + 1,
          };
        }
      }
      console.log(chalk.cyan(`   🔧 Tool call: ${response.tool_calls.map(t => t.name).join(", ")}`));
    } else if (response.content) {
      console.log(chalk.gray("   💬 Response ready"));
    }

    return {
      messages: [response],
      iterations: state.iterations + 1,
    };
  } catch (error) {
    console.error(chalk.red(`   ❌ Agent error: ${error.message}`));
    return {
      error: error.message,
      messages: [new AIMessage(`I encountered an error: ${error.message}`)],
    };
  }
}

export const safeToolNode = new ToolNode(safeTools);

export async function humanApprovalNode(state) {
  console.log(chalk.yellow("\n📍 [Human Approval] Waiting for user..."));

  const pendingTool = state.pendingToolCall;
  if (!pendingTool) {
    return { toolApproved: false };
  }

  console.log("\n" + "═".repeat(50));
  console.log(chalk.bold.yellow("⚠️  ACTION REQUIRES YOUR APPROVAL"));
  console.log("═".repeat(50));
  console.log(chalk.white(`\n📌 Tool: ${chalk.cyan(pendingTool.name)}`));
  console.log(chalk.white("📌 Arguments:"));

  Object.entries(pendingTool.args).forEach(([key, value]) => {
    const displayValue = String(value).slice(0, 100);
    const truncated = String(value).length > 100 ? "..." : "";
    console.log(chalk.gray(`   • ${key}: ${displayValue}${truncated}`));
  });
  console.log("\n" + "═".repeat(50));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await new Promise((resolve) => {
    rl.question(chalk.bold("\n✋ Approve this action? (yes/no): "), resolve);
  });
  rl.close();

  const approved = ["yes", "y", "yeah", "yep", "sure", "ok", "okay"]
    .includes(answer.toLowerCase().trim());

  console.log(
    approved
      ? chalk.green("   ✅ Approved by user")
      : chalk.red("   ❌ Rejected by user")
  );

  return {
    toolApproved: approved,
  };
}

export async function simpleDangerousToolNode(state) {
  console.log(chalk.gray("\n📍 [Execute Dangerous Tool]"));

  const pending = state.pendingToolCall;

  if (!state.toolApproved || !pending) {

    return {
      messages: [
        new ToolMessage({
          content: "User rejected this action. Do not attempt it again.",
          tool_call_id: pending?.id || "unknown",
          name: pending?.name || "unknown",
        }),
      ],
      pendingToolCall: null,
      toolApproved: null,
    };
  }

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
    console.log(chalk.green(`   ✅ Executed: ${pending.name}`));

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
    };
  } catch (error) {
    console.log(chalk.red(`   ❌ Execution failed: ${error.message}`));
    return {
      messages: [
        new ToolMessage({
          content: `Error executing ${pending.name}: ${error.message}`,
          tool_call_id: pending.id,
          name: pending.name,
        }),
      ],
      pendingToolCall: null,
      toolApproved: null,
      error: error.message,
    };
  }
}

export function routeAfterSimpleAgent(state) {

  if (state.error) {
    console.log(chalk.gray("🔀 Routing to: end (error)"));
    return "end";
  }

  if (state.pendingToolCall) {
    console.log(chalk.gray("🔀 Routing to: human_approval"));
    return "needs_approval";
  }

  const lastMessage = state.messages[state.messages.length - 1];
  if (lastMessage?.tool_calls?.length > 0) {
    console.log(chalk.gray("🔀 Routing to: safe_tools"));
    return "call_tools";
  }

  console.log(chalk.gray("🔀 Routing to: end"));
  return "end";
}

export function routeAfterPlanner(state) {
  if (state.error || !state.plan) {
    console.log(chalk.gray("🔀 Routing to: end (no plan or error)"));
    return "end";
  }

  console.log(chalk.gray("🔀 Routing to: executor"));
  return "execute";
}

export function routeAfterExecutor(state) {

  if (state.pendingToolCall) {
    console.log(chalk.gray("🔀 Routing to: human_approval"));
    return "needs_approval";
  }

  if (state.error) {
    console.log(chalk.gray("🔀 Routing to: reflector (error)"));
    return "reflect";
  }

  console.log(chalk.gray("🔀 Routing to: reflector"));
  return "reflect";
}
