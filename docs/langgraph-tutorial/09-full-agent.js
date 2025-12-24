/**
 * ============================================================
 * 09 - Full Agent: Production-Ready Implementation
 * ============================================================
 * 
 * A complete, production-ready agent combining everything
 * we've learned in this tutorial.
 * 
 * FEATURES:
 * - ReAct pattern with tool calling
 * - Memory and persistence
 * - Human-in-the-loop for dangerous actions
 * - Streaming responses
 * - Error handling
 * - Session management
 */

import { StateGraph, START, END, Annotation, MemorySaver } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { HumanMessage, AIMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import os from "os";
import readline from "readline";
import dotenv from "dotenv";

dotenv.config();

// ============================================================
// CONFIGURATION
// ============================================================

/**
 * Central configuration for the agent.
 * In production, load from environment or config file.
 */
const AGENT_CONFIG = {
  // LLM settings
  llm: {
    model: "gemini-2.0-flash",
    temperature: 0.7,
    maxOutputTokens: 2048,
  },

  // Tools that require user approval
  dangerousTools: ["shell_command", "write_file", "delete_file"],

  // Maximum tool call iterations to prevent infinite loops
  maxIterations: 10,

  // System prompt
  systemPrompt: `You are a helpful AI assistant with access to various tools.
You can search the web, read files, and perform calculations.
Some actions require user approval for safety.
Always explain what you're doing and why.
Be concise but thorough.`,
};

// ============================================================
// TOOLS DEFINITION
// ============================================================

/**
 * Calculator tool
 * Safe - no approval needed
 */
const calculatorTool = new DynamicStructuredTool({
  name: "calculator",
  description: "Perform mathematical calculations",
  schema: z.object({
    expression: z.string().describe("Mathematical expression to evaluate"),
  }),
  func: async ({ expression }) => {
    try {
      // Use Function constructor for safer eval
      const calculate = new Function("return " + expression);
      const result = calculate();
      return `Result: ${result}`;
    } catch (error) {
      return `Calculation error: ${error.message}`;
    }
  },
});

/**
 * Weather tool (simulated)
 * Safe - no approval needed
 */
const weatherTool = new DynamicStructuredTool({
  name: "get_weather",
  description: "Get current weather for a location",
  schema: z.object({
    location: z.string().describe("City name"),
  }),
  func: async ({ location }) => {
    // Simulated - in production, call a weather API
    const conditions = ["Sunny", "Cloudy", "Rainy", "Windy"];
    const temp = Math.floor(Math.random() * 30) + 50;
    const condition = conditions[Math.floor(Math.random() * conditions.length)];
    return `Weather in ${location}: ${temp}°F, ${condition}`;
  },
});

/**
 * Read file tool
 * Safe - no approval needed
 */
const readFileTool = new DynamicStructuredTool({
  name: "read_file",
  description: "Read contents of a file",
  schema: z.object({
    filePath: z.string().describe("Path to the file to read"),
  }),
  func: async ({ filePath }) => {
    try {
      const absolutePath = path.resolve(filePath);
      const content = await fs.readFile(absolutePath, "utf-8");
      return `File contents:\n${content.slice(0, 2000)}${content.length > 2000 ? "\n... (truncated)" : ""}`;
    } catch (error) {
      return `Error reading file: ${error.message}`;
    }
  },
});

/**
 * Write file tool
 * DANGEROUS - requires approval
 */
const writeFileTool = new DynamicStructuredTool({
  name: "write_file",
  description: "Write content to a file (REQUIRES APPROVAL)",
  schema: z.object({
    filePath: z.string().describe("Path to the file"),
    content: z.string().describe("Content to write"),
  }),
  func: async ({ filePath, content }) => {
    try {
      const absolutePath = path.resolve(filePath);
      await fs.writeFile(absolutePath, content, "utf-8");
      return `Successfully wrote to ${absolutePath}`;
    } catch (error) {
      return `Error writing file: ${error.message}`;
    }
  },
});

/**
 * Shell command tool
 * DANGEROUS - requires approval
 */
const shellTool = new DynamicStructuredTool({
  name: "shell_command",
  description: "Execute a shell command (REQUIRES APPROVAL)",
  schema: z.object({
    command: z.string().describe("Shell command to execute"),
  }),
  func: async ({ command }) => {
    const { exec } = await import("child_process");
    return new Promise((resolve) => {
      exec(command, { timeout: 10000 }, (error, stdout, stderr) => {
        if (error) {
          resolve(`Error: ${error.message}`);
        } else {
          resolve(stdout || stderr || "Command executed (no output)");
        }
      });
    });
  },
});

// All tools
const allTools = [calculatorTool, weatherTool, readFileTool, writeFileTool, shellTool];

// ============================================================
// STATE DEFINITION
// ============================================================

const FullAgentState = Annotation.Root({
  // Conversation messages
  messages: Annotation({
    reducer: (curr, update) => [...curr, ...(Array.isArray(update) ? update : [update])],
    default: () => [],
  }),

  // Session identifier
  sessionId: Annotation({
    reducer: (_, update) => update,
    default: () => `session_${Date.now()}`,
  }),

  // Pending tool call that needs approval
  pendingToolCall: Annotation({
    reducer: (_, update) => update,
    default: () => null,
  }),

  // Whether the pending tool call was approved
  toolApproved: Annotation({
    reducer: (_, update) => update,
    default: () => null,
  }),

  // Current iteration count (for loop prevention)
  iterations: Annotation({
    reducer: (curr, update) => (typeof update === "number" ? update : curr + 1),
    default: () => 0,
  }),

  // Error state
  error: Annotation({
    reducer: (_, update) => update,
    default: () => null,
  }),
});

// ============================================================
// LLM SETUP
// ============================================================

const llm = new ChatGoogleGenerativeAI({
  model: AGENT_CONFIG.llm.model,
  temperature: AGENT_CONFIG.llm.temperature,
  maxOutputTokens: AGENT_CONFIG.llm.maxOutputTokens,
  apiKey: process.env.GOOGLE_API_KEY,
}).bindTools(allTools);

// ============================================================
// NODE DEFINITIONS
// ============================================================

/**
 * Main agent node
 * Calls the LLM with conversation history
 */
async function agentNode(state) {
  console.log("\n📍 [Agent] Thinking...");

  try {
    // Check iteration limit
    if (state.iterations >= AGENT_CONFIG.maxIterations) {
      console.log("   ⚠️ Max iterations reached");
      return {
        messages: [new AIMessage("I've reached the maximum number of steps. Let me summarize what I've done so far.")],
        error: "Max iterations reached",
      };
    }

    // Build messages with system prompt
    const systemMessage = new SystemMessage(AGENT_CONFIG.systemPrompt);
    const allMessages = [systemMessage, ...state.messages];

    // Call LLM
    const response = await llm.invoke(allMessages);

    // Check for dangerous tool calls
    if (response.tool_calls?.length > 0) {
      for (const toolCall of response.tool_calls) {
        if (AGENT_CONFIG.dangerousTools.includes(toolCall.name)) {
          console.log(`   ⚠️ Dangerous tool: ${toolCall.name} - needs approval`);
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
      console.log(`   🔧 Safe tool call: ${response.tool_calls.map(t => t.name).join(", ")}`);
    } else {
      console.log(`   💬 Final response: "${response.content?.slice(0, 50)}..."`);
    }

    return {
      messages: [response],
      iterations: state.iterations + 1,
    };
  } catch (error) {
    console.error("   ❌ Agent error:", error.message);
    return {
      error: error.message,
      messages: [new AIMessage(`I encountered an error: ${error.message}`)],
    };
  }
}

/**
 * Tool execution node (for safe tools only)
 */
const safeToolNode = new ToolNode(
  allTools.filter(t => !AGENT_CONFIG.dangerousTools.includes(t.name))
);

/**
 * Human approval node
 * Prompts user for confirmation on dangerous actions
 */
async function humanApprovalNode(state) {
  console.log("\n📍 [Human Approval] Waiting for user...");

  const pendingTool = state.pendingToolCall;
  if (!pendingTool) {
    return { toolApproved: false };
  }

  // Display the pending action
  console.log("\n" + "═".repeat(50));
  console.log("⚠️  ACTION REQUIRES YOUR APPROVAL");
  console.log("═".repeat(50));
  console.log(`\n📌 Tool: ${pendingTool.name}`);
  console.log(`📌 Arguments:`);
  Object.entries(pendingTool.args).forEach(([key, value]) => {
    console.log(`   • ${key}: ${String(value).slice(0, 100)}`);
  });
  console.log("\n" + "═".repeat(50));

  // Get user input
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await new Promise((resolve) => {
    rl.question("\n✋ Approve this action? (yes/no): ", resolve);
  });
  rl.close();

  const approved = answer.toLowerCase().trim() === "yes" || answer.toLowerCase().trim() === "y";
  console.log(approved ? "   ✅ Approved by user" : "   ❌ Rejected by user");

  return {
    toolApproved: approved,
  };
}

/**
 * Execute the approved dangerous tool
 */
async function executeDangerousToolNode(state) {
  console.log("\n📍 [Execute Dangerous Tool]");

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
  const tool = allTools.find(t => t.name === pending.name);
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
    console.log(`   ✅ Executed: ${pending.name}`);

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
    console.log(`   ❌ Execution failed: ${error.message}`);
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

function routeAfterAgent(state) {
  // Check for errors
  if (state.error) {
    console.log("🔀 Routing to: end (error)");
    return "end";
  }

  // Check for pending approval
  if (state.pendingToolCall) {
    console.log("🔀 Routing to: human_approval");
    return "needs_approval";
  }

  // Check for tool calls
  const lastMessage = state.messages[state.messages.length - 1];
  if (lastMessage.tool_calls?.length > 0) {
    console.log("🔀 Routing to: safe_tools");
    return "call_tools";
  }

  // No more actions needed
  console.log("🔀 Routing to: end");
  return "end";
}

function routeAfterApproval(state) {
  console.log("🔀 Routing to: execute_dangerous");
  return "execute";
}

// ============================================================
// BUILD THE GRAPH
// ============================================================

/**
 * Complete Agent Graph:
 * 
 *              START
 *                │
 *                ▼
 *            ┌──agent◄───────────────┐
 *            │    │                  │
 *    ┌───────┼────┼────────┐         │
 *    │       │    │        │         │
 *    ▼       ▼    ▼        ▼         │
 * approve  tools error   END         │
 *    │       │     │                 │
 *    ▼       │     │                 │
 * execute    │     │                 │
 *    │       │     │                 │
 *    └───────┴─────┴─────────────────┘
 */
function buildFullAgent() {
  const graph = new StateGraph(FullAgentState);

  // Add nodes
  graph.addNode("agent", agentNode);
  graph.addNode("safe_tools", safeToolNode);
  graph.addNode("human_approval", humanApprovalNode);
  graph.addNode("execute_dangerous", executeDangerousToolNode);

  // Entry point
  graph.addEdge(START, "agent");

  // After agent - route based on state
  graph.addConditionalEdges("agent", routeAfterAgent, {
    call_tools: "safe_tools",
    needs_approval: "human_approval",
    end: END,
  });

  // After safe tools - back to agent
  graph.addEdge("safe_tools", "agent");

  // After approval - execute the dangerous tool
  graph.addEdge("human_approval", "execute_dangerous");

  // After executing dangerous tool - back to agent
  graph.addEdge("execute_dangerous", "agent");

  // Compile with memory
  return graph.compile({
    checkpointer: new MemorySaver(),
  });
}

// ============================================================
// AGENT SESSION CLASS
// ============================================================

/**
 * AgentSession provides a clean interface for using the agent.
 */
class AgentSession {
  constructor(sessionId = null) {
    this.sessionId = sessionId || `session_${Date.now()}`;
    this.agent = buildFullAgent();
    this.config = {
      configurable: { thread_id: this.sessionId },
    };
  }

  /**
   * Send a message and get a response
   */
  async chat(message) {
    const result = await this.agent.invoke(
      {
        messages: [new HumanMessage(message)],
      },
      this.config
    );

    // Get the final AI message
    const aiMessages = result.messages.filter(
      m => m._getType?.() === "ai" && m.content
    );
    const lastAI = aiMessages[aiMessages.length - 1];

    return {
      response: lastAI?.content || "No response",
      iterations: result.iterations,
      error: result.error,
    };
  }

  /**
   * Stream responses (basic implementation)
   */
  async *stream(message) {
    const result = await this.agent.invoke(
      {
        messages: [new HumanMessage(message)],
      },
      this.config
    );

    // Yield final response
    const aiMessages = result.messages.filter(
      m => m._getType?.() === "ai" && m.content
    );
    const lastAI = aiMessages[aiMessages.length - 1];
    
    if (lastAI?.content) {
      yield lastAI.content;
    }
  }
}

// ============================================================
// MAIN - INTERACTIVE DEMO
// ============================================================

async function main() {
  console.log("═".repeat(50));
  console.log("🤖 Full Production Agent Demo");
  console.log("═".repeat(50));
  console.log("\nThis agent can:");
  console.log("  • Do calculations");
  console.log("  • Check weather");
  console.log("  • Read files");
  console.log("  • Write files (with approval)");
  console.log("  • Run shell commands (with approval)");
  console.log("\nType 'exit' to quit.\n");

  if (!process.env.GOOGLE_API_KEY) {
    console.error("❌ GOOGLE_API_KEY not set");
    process.exit(1);
  }

  const session = new AgentSession();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const askQuestion = () => {
    rl.question("\n👤 You: ", async (input) => {
      const trimmed = input.trim();

      if (trimmed.toLowerCase() === "exit") {
        console.log("\n👋 Goodbye!");
        rl.close();
        return;
      }

      if (!trimmed) {
        askQuestion();
        return;
      }

      try {
        const result = await session.chat(trimmed);
        console.log(`\n🤖 Agent: ${result.response}`);
        
        if (result.iterations) {
          console.log(`\n   📊 Iterations: ${result.iterations}`);
        }
      } catch (error) {
        console.error(`\n❌ Error: ${error.message}`);
      }

      askQuestion();
    });
  };

  askQuestion();
}

main().catch(console.error);

// ============================================================
// EXPORTED API
// ============================================================

export {
  buildFullAgent,
  AgentSession,
  AGENT_CONFIG,
  allTools,
};

// ============================================================
// KEY TAKEAWAYS:
// ============================================================
/**
 * 1. Combine all patterns: ReAct + Memory + Human-in-the-loop
 * 
 * 2. Central configuration makes it easy to modify behavior
 * 
 * 3. Separate tools into safe and dangerous categories
 * 
 * 4. Use iteration limits to prevent infinite loops
 * 
 * 5. Proper error handling at every node
 * 
 * 6. AgentSession provides a clean API
 * 
 * 7. This pattern can be extended for any use case
 */
