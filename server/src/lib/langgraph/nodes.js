/**
 * ============================================================================
 * 📚 LANGGRAPH LEARNING PATH - FILE 8 OF 11
 * ============================================================================
 * 
 * 📖 WHAT IS THIS FILE?
 *    This is the NODES file - it brings together all the individual nodes
 *    and adds the human-in-the-loop approval mechanism.
 * 
 * 📝 PREREQUISITES: Read state.js through reflector.js (1-7) first
 * 
 * ➡️  NEXT FILE: After understanding this, read graph.js (9/11)
 * 
 * ============================================================================
 * 
 * 🧠 WHAT DOES THIS FILE DO?
 * 
 * This file serves as the central hub for all nodes:
 * 
 *   1. Re-exports nodes from other files (planner, executor, reflector)
 *   2. Adds the human approval node (for dangerous tools)
 *   3. Provides routing functions (decide which node runs next)
 *   4. Provides a simple agent node for chat mode
 * 
 * Think of this as the "index" or "orchestrator" for all node logic.
 * 
 * ============================================================================
 */

import readline from "readline";
import chalk from "chalk";
import { AIMessage, ToolMessage, SystemMessage } from "@langchain/core/messages";
import { ToolNode } from "@langchain/langgraph/prebuilt";

// ============================================================================
// RE-EXPORT NODES FROM OTHER FILES
// ============================================================================
/**
 * We re-export the main nodes so graph.js can import everything from here.
 * This keeps imports clean and organized.
 */

// Planner node and helpers
export { plannerNode, getCurrentStep, isAllStepsComplete, getProgressString } from "./planner.js";

// Executor nodes
export { executorNode, executeDangerousToolNode } from "./executor.js";

// Reflector node and routing
export { reflectorNode, routeAfterReflector } from "./reflector.js";

// ============================================================================
// IMPORTS FOR THIS FILE
// ============================================================================
import { createLLMWithTools, SYSTEM_PROMPT } from "./llm.js";
import { allTools, safeTools, isDangerousTool, getToolByName } from "./tools.js";
import { config } from "../../config/google.config.js";

// ============================================================================
// SIMPLE AGENT NODE (FOR CHAT MODE)
// ============================================================================
/**
 * A simpler agent node for basic chat without the full Planner/Executor/Reflector.
 * 
 * This is used when the user just wants to chat, not run complex tasks.
 * It still supports tool calling but doesn't use the planning pattern.
 * 
 * @param {Object} state - Agent state
 * @returns {Object} State updates
 */
export async function simpleAgentNode(state) {
  console.log(chalk.gray("\n📍 [Agent] Thinking..."));
  
  try {
    // Check iteration limit
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
    
    // Build messages with system prompt
    const systemMessage = new SystemMessage(SYSTEM_PROMPT);
    const allMessages = [systemMessage, ...state.messages];
    
    // Create LLM with tools
    let _llmWithTools = null;
    if (!_llmWithTools) {
      _llmWithTools = createLLMWithTools(allTools);
    }
    
    // Call LLM
    const response = await _llmWithTools.invoke(allMessages);
    
    // Check for dangerous tool calls
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

// ============================================================================
// SAFE TOOL NODE
// ============================================================================
/**
 * Node that executes safe tools automatically (no approval needed).
 * 
 * This uses LangGraph's built-in ToolNode which:
 *   1. Looks at the last message for tool_calls
 *   2. Executes each tool
 *   3. Returns ToolMessage results
 */
export const safeToolNode = new ToolNode(safeTools);

// ============================================================================
// HUMAN APPROVAL NODE
// ============================================================================
/**
 * Prompts the user for approval before running dangerous tools.
 * 
 * This is the HUMAN-IN-THE-LOOP pattern. When the agent wants to:
 *   - Run a shell command
 *   - Write/delete files
 *   - Make HTTP requests
 * 
 * We ask the user first!
 * 
 * @param {Object} state - Agent state
 * @returns {Object} State updates (toolApproved: true/false)
 */
export async function humanApprovalNode(state) {
  console.log(chalk.yellow("\n📍 [Human Approval] Waiting for user..."));
  
  const pendingTool = state.pendingToolCall;
  if (!pendingTool) {
    return { toolApproved: false };
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // DISPLAY THE PENDING ACTION
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n" + "═".repeat(50));
  console.log(chalk.bold.yellow("⚠️  ACTION REQUIRES YOUR APPROVAL"));
  console.log("═".repeat(50));
  console.log(chalk.white(`\n📌 Tool: ${chalk.cyan(pendingTool.name)}`));
  console.log(chalk.white("📌 Arguments:"));
  
  // Display arguments (truncated for readability)
  Object.entries(pendingTool.args).forEach(([key, value]) => {
    const displayValue = String(value).slice(0, 100);
    const truncated = String(value).length > 100 ? "..." : "";
    console.log(chalk.gray(`   • ${key}: ${displayValue}${truncated}`));
  });
  console.log("\n" + "═".repeat(50));
  
  // ─────────────────────────────────────────────────────────────────────────
  // GET USER INPUT
  // ─────────────────────────────────────────────────────────────────────────
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  const answer = await new Promise((resolve) => {
    rl.question(chalk.bold("\n✋ Approve this action? (yes/no): "), resolve);
  });
  rl.close();
  
  // Check if approved
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

// ============================================================================
// EXECUTE DANGEROUS TOOL NODE (Legacy - for simple agent mode)
// ============================================================================
/**
 * Execute the dangerous tool after approval (for simple chat mode).
 * 
 * Note: executor.js has a more complete version for the full agent mode.
 * This one is kept for backward compatibility with simple chat.
 * 
 * @param {Object} state - Agent state
 * @returns {Object} State updates
 */
export async function simpleDangerousToolNode(state) {
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

// ============================================================================
// ROUTING FUNCTIONS
// ============================================================================
/**
 * Routing functions tell LangGraph which node to run next.
 * They examine the current state and return a string (the route name).
 */

/**
 * Route after the simple agent node (for chat mode).
 * 
 * @param {Object} state - Current state
 * @returns {string} Next route
 */
export function routeAfterSimpleAgent(state) {
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
  
  // Check for tool calls in the last message
  const lastMessage = state.messages[state.messages.length - 1];
  if (lastMessage?.tool_calls?.length > 0) {
    console.log(chalk.gray("🔀 Routing to: safe_tools"));
    return "call_tools";
  }
  
  // No more actions needed
  console.log(chalk.gray("🔀 Routing to: end"));
  return "end";
}

/**
 * Route after the planner node (for full agent mode).
 * 
 * @param {Object} state - Current state  
 * @returns {string} Next route
 */
export function routeAfterPlanner(state) {
  if (state.error || !state.plan) {
    console.log(chalk.gray("🔀 Routing to: end (no plan or error)"));
    return "end";
  }
  
  console.log(chalk.gray("🔀 Routing to: executor"));
  return "execute";
}

/**
 * Route after the executor node.
 * 
 * @param {Object} state - Current state
 * @returns {string} Next route
 */
export function routeAfterExecutor(state) {
  // Check for pending approval
  if (state.pendingToolCall) {
    console.log(chalk.gray("🔀 Routing to: human_approval"));
    return "needs_approval";
  }
  
  // Check for errors
  if (state.error) {
    console.log(chalk.gray("🔀 Routing to: reflector (error)"));
    return "reflect";
  }
  
  // Go to reflector to evaluate
  console.log(chalk.gray("🔀 Routing to: reflector"));
  return "reflect";
}

// ============================================================================
// 📝 WHAT'S NEXT?
// ============================================================================
/**
 * Great! You now understand:
 *   ✅ How nodes are organized and exported
 *   ✅ The human approval node (human-in-the-loop)
 *   ✅ The difference between simple chat and full agent mode
 *   ✅ How routing functions direct the flow
 * 
 * ➡️  NEXT: Read graph.js (9/11) to see how the graph is built
 */
