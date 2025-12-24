/**
 * LangGraph Node Definitions
 * 
 * Defines all graph nodes for the agent:
 * - agentNode: Main LLM reasoning
 * - safeToolNode: Execute safe tools
 * - humanApprovalNode: Get user approval for dangerous tools
 * - executeDangerousToolNode: Execute approved dangerous tools
 */

import { ToolNode } from "@langchain/langgraph/prebuilt";
import { AIMessage, ToolMessage, SystemMessage } from "@langchain/core/messages";
import readline from "readline";
import chalk from "chalk";

import { createLLMWithTools, SYSTEM_PROMPT } from "./llm.js";
import { allTools, safeTools, getToolByName, isDangerousTool } from "./tools.js";
import { config } from "../../config/google.config.js";

// LLM with all tools bound - lazy initialization
let _llmWithTools = null;

function getLLMWithTools() {
  if (!_llmWithTools) {
    _llmWithTools = createLLMWithTools(allTools);
  }
  return _llmWithTools;
}

// ============================================================
// AGENT NODE
// ============================================================

/**
 * Main agent node - calls the LLM with conversation history
 */
export async function agentNode(state) {
  console.log(chalk.gray("\n📍 [Agent] Thinking..."));

  try {
    // Check iteration limit
    if (state.iterations >= config.maxIterations) {
      console.log(chalk.yellow("   ⚠️ Max iterations reached"));
      return {
        messages: [
          new AIMessage(
            "I've reached the maximum number of steps. Let me summarize what I've done so far."
          ),
        ],
        error: "Max iterations reached",
      };
    }

    // Build messages with system prompt
    const systemMessage = new SystemMessage(SYSTEM_PROMPT);
    const allMessages = [systemMessage, ...state.messages];

    // Get LLM (lazy initialization)
    const llmWithTools = getLLMWithTools();

    // Call LLM
    const response = await llmWithTools.invoke(allMessages);

    // Check for dangerous tool calls
    if (response.tool_calls?.length > 0) {
      for (const toolCall of response.tool_calls) {
        if (isDangerousTool(toolCall.name)) {
          console.log(
            chalk.yellow(`   ⚠️ Dangerous tool: ${toolCall.name} - needs approval`)
          );
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
      console.log(
        chalk.cyan(
          `   🔧 Tool call: ${response.tool_calls.map((t) => t.name).join(", ")}`
        )
      );
    } else if (response.content) {
      console.log(chalk.gray(`   💬 Response ready`));
    }

    return {
      messages: [response],
      iterations: state.iterations + 1,
    };
  } catch (error) {
    console.error(chalk.red("   ❌ Agent error:"), error.message);
    return {
      error: error.message,
      messages: [new AIMessage(`I encountered an error: ${error.message}`)],
    };
  }
}

// ============================================================
// SAFE TOOL NODE
// ============================================================

/**
 * Tool execution node for safe tools only
 */
export const safeToolNode = new ToolNode(safeTools);

// ============================================================
// HUMAN APPROVAL NODE
// ============================================================

/**
 * Prompts user for confirmation on dangerous actions
 */
export async function humanApprovalNode(state) {
  console.log(chalk.yellow("\n📍 [Human Approval] Waiting for user..."));

  const pendingTool = state.pendingToolCall;
  if (!pendingTool) {
    return { toolApproved: false };
  }

  // Display the pending action
  console.log("\n" + "═".repeat(50));
  console.log(chalk.bold.yellow("⚠️  ACTION REQUIRES YOUR APPROVAL"));
  console.log("═".repeat(50));
  console.log(chalk.white(`\n📌 Tool: ${chalk.cyan(pendingTool.name)}`));
  console.log(chalk.white("📌 Arguments:"));
  Object.entries(pendingTool.args).forEach(([key, value]) => {
    const displayValue = String(value).slice(0, 100);
    console.log(chalk.gray(`   • ${key}: ${displayValue}`));
  });
  console.log("\n" + "═".repeat(50));

  // Get user input
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await new Promise((resolve) => {
    rl.question(chalk.bold("\n✋ Approve this action? (yes/no): "), resolve);
  });
  rl.close();

  const approved =
    answer.toLowerCase().trim() === "yes" ||
    answer.toLowerCase().trim() === "y";
  
  console.log(
    approved
      ? chalk.green("   ✅ Approved by user")
      : chalk.red("   ❌ Rejected by user")
  );

  return {
    toolApproved: approved,
  };
}

// ============================================================
// EXECUTE DANGEROUS TOOL NODE
// ============================================================

/**
 * Execute the approved dangerous tool
 */
export async function executeDangerousToolNode(state) {
  console.log(chalk.gray("\n📍 [Execute Dangerous Tool]"));

  const pending = state.pendingToolCall;

  if (!state.toolApproved || !pending) {
    // Rejected - notify the LLM
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

  // Find and execute the tool
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

// ============================================================
// ROUTING FUNCTIONS
// ============================================================

/**
 * Route after agent node based on state
 */
export function routeAfterAgent(state) {
  // Check for errors
  if (state.error) {
    console.log(chalk.gray("🔀 Routing to: end (error)"));
    return "end";
  }

  // Check for pending approval
  if (state.pendingToolCall) {
    console.log(chalk.gray("🔀 Routing to: human_approval"));
    return "needs_approval";
  }

  // Check for tool calls
  const lastMessage = state.messages[state.messages.length - 1];
  if (lastMessage?.tool_calls?.length > 0) {
    console.log(chalk.gray("🔀 Routing to: safe_tools"));
    return "call_tools";
  }

  // No more actions needed
  console.log(chalk.gray("🔀 Routing to: end"));
  return "end";
}
