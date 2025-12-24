/**
 * ============================================================
 * 08 - Human-in-the-Loop: Pausing for User Input
 * ============================================================
 * 
 * How to pause graph execution for human approval or input.
 * 
 * LEARNING GOALS:
 * - Understand interrupt points
 * - Create approval workflows
 * - Handle user decisions
 * - Resume execution after interrupts
 */

import { StateGraph, START, END, Annotation, MemorySaver } from "@langchain/langgraph";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import readline from "readline";
import dotenv from "dotenv";

dotenv.config();

// ============================================================
// WHY HUMAN-IN-THE-LOOP?
// ============================================================
/**
 * Some actions need human approval before executing:
 * 
 * 1. DANGEROUS OPERATIONS: Deleting files, running commands
 * 2. FINANCIAL: Making purchases, transfers
 * 3. COMMUNICATION: Sending emails, messages
 * 4. CLARIFICATION: When AI is uncertain
 * 
 * LangGraph supports this with:
 * - interrupt_before: Pause BEFORE entering a node
 * - interrupt_after: Pause AFTER a node completes
 */

// ============================================================
// HELPER: Get user input
// ============================================================

function askUser(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

// ============================================================
// STEP 1: DEFINE TOOLS (some require approval)
// ============================================================

// Safe tool - no approval needed
const searchTool = new DynamicStructuredTool({
  name: "web_search",
  description: "Search the web for information",
  schema: z.object({
    query: z.string(),
  }),
  func: async ({ query }) => {
    return `Search results for "${query}": [simulated results]`;
  },
});

// Dangerous tool - needs approval!
const sendEmailTool = new DynamicStructuredTool({
  name: "send_email",
  description: "Send an email to someone",
  schema: z.object({
    to: z.string().describe("Email recipient"),
    subject: z.string().describe("Email subject"),
    body: z.string().describe("Email body"),
  }),
  func: async ({ to, subject, body }) => {
    // This would actually send an email in production
    return `Email sent to ${to} with subject "${subject}"`;
  },
});

// Another dangerous tool
const deleteFileTool = new DynamicStructuredTool({
  name: "delete_file",
  description: "Delete a file from the filesystem",
  schema: z.object({
    path: z.string().describe("Path to file to delete"),
  }),
  func: async ({ path }) => {
    // This would actually delete in production
    return `File deleted: ${path}`;
  },
});

const tools = [searchTool, sendEmailTool, deleteFileTool];
const dangerousTools = ["send_email", "delete_file"];

// ============================================================
// STEP 2: DEFINE STATE
// ============================================================

const HumanLoopState = Annotation.Root({
  messages: Annotation({
    reducer: (curr, update) => [...curr, ...(Array.isArray(update) ? update : [update])],
    default: () => [],
  }),

  // Pending action that needs approval
  pendingAction: Annotation({
    reducer: (_, update) => update,
    default: () => null,
  }),

  // User's decision (approve/reject)
  approved: Annotation({
    reducer: (_, update) => update,
    default: () => null,
  }),
});

// ============================================================
// STEP 3: DEFINE NODES
// ============================================================

const llm = new ChatGoogleGenerativeAI({
  model: "gemini-2.0-flash",
  temperature: 0,
  apiKey: process.env.GOOGLE_API_KEY,
}).bindTools(tools);

/**
 * Agent node - decides what to do
 */
async function agentNode(state) {
  console.log("📍 agentNode");

  const response = await llm.invoke(state.messages);

  // Check if it wants to use a dangerous tool
  if (response.tool_calls?.length > 0) {
    const toolCall = response.tool_calls[0];

    if (dangerousTools.includes(toolCall.name)) {
      console.log(`   ⚠️ Dangerous tool requested: ${toolCall.name}`);
      
      // Store the pending action for approval
      return {
        messages: [response],
        pendingAction: {
          tool: toolCall.name,
          args: toolCall.args,
          toolCallId: toolCall.id,
        },
      };
    }
  }

  return {
    messages: [response],
    pendingAction: null,
  };
}

/**
 * Human approval node
 * 
 * This is where we pause and ask the user.
 */
async function humanApprovalNode(state) {
  console.log("\n📍 humanApprovalNode");
  console.log("   Waiting for human approval...");

  const action = state.pendingAction;
  
  console.log("\n" + "=".repeat(40));
  console.log("⚠️  ACTION REQUIRES APPROVAL");
  console.log("=".repeat(40));
  console.log(`Tool: ${action.tool}`);
  console.log(`Args: ${JSON.stringify(action.args, null, 2)}`);
  console.log("=".repeat(40));

  // Ask user for approval
  const answer = await askUser("\nApprove this action? (yes/no): ");
  const approved = answer === "yes" || answer === "y";

  console.log(approved ? "   ✅ Approved" : "   ❌ Rejected");

  return {
    approved: approved,
  };
}

/**
 * Execute the approved action
 */
async function executeNode(state) {
  console.log("📍 executeNode");

  const action = state.pendingAction;

  if (!state.approved) {
    console.log("   Action was rejected, skipping execution");
    
    return {
      messages: [new AIMessage("I understand. I won't proceed with that action.")],
      pendingAction: null,
      approved: null,
    };
  }

  // Find and execute the tool
  const tool = tools.find(t => t.name === action.tool);
  const result = await tool.invoke(action.args);

  console.log(`   Executed: ${action.tool}`);
  console.log(`   Result: ${result}`);

  return {
    messages: [new AIMessage(`Done! ${result}`)],
    pendingAction: null,
    approved: null,
  };
}

/**
 * Execute safe tools (no approval needed)
 */
async function executeSafeToolsNode(state) {
  console.log("📍 executeSafeToolsNode");

  const lastMessage = state.messages[state.messages.length - 1];
  
  if (!lastMessage.tool_calls?.length) {
    return {};
  }

  const results = [];
  
  for (const toolCall of lastMessage.tool_calls) {
    if (!dangerousTools.includes(toolCall.name)) {
      const tool = tools.find(t => t.name === toolCall.name);
      if (tool) {
        const result = await tool.invoke(toolCall.args);
        console.log(`   Executed safe tool: ${toolCall.name}`);
        results.push(new AIMessage(result));
      }
    }
  }

  return {
    messages: results,
  };
}

// ============================================================
// STEP 4: ROUTING
// ============================================================

function routeAfterAgent(state) {
  const lastMessage = state.messages[state.messages.length - 1];

  // If there's a pending dangerous action, get approval
  if (state.pendingAction) {
    console.log("🔀 Routing to: human_approval");
    return "needs_approval";
  }

  // If there are safe tool calls, execute them
  if (lastMessage.tool_calls?.length > 0) {
    console.log("🔀 Routing to: safe_tools");
    return "safe_tools";
  }

  // Otherwise, we're done
  console.log("🔀 Routing to: end");
  return "end";
}

// ============================================================
// STEP 5: BUILD THE GRAPH
// ============================================================

/**
 * Graph with human-in-the-loop:
 * 
 *        START
 *          │
 *          ▼
 *        agent
 *          │
 *    ┌─────┼─────┐
 *    ▼     ▼     ▼
 * approve safe  END
 *    │     │
 *    ▼     │
 * execute  │
 *    │     │
 *    └──┬──┘
 *       ▼
 *      END
 */
function buildHumanLoopGraph() {
  const graph = new StateGraph(HumanLoopState);

  // Add nodes
  graph.addNode("agent", agentNode);
  graph.addNode("human_approval", humanApprovalNode);
  graph.addNode("execute", executeNode);
  graph.addNode("safe_tools", executeSafeToolsNode);

  // Entry
  graph.addEdge(START, "agent");

  // After agent, route based on pending action
  graph.addConditionalEdges("agent", routeAfterAgent, {
    needs_approval: "human_approval",
    safe_tools: "safe_tools",
    end: END,
  });

  // After approval, execute
  graph.addEdge("human_approval", "execute");

  // After execute, end
  graph.addEdge("execute", END);

  // After safe tools, end
  graph.addEdge("safe_tools", END);

  return graph.compile({
    checkpointer: new MemorySaver(),
  });
}

// ============================================================
// STEP 6: RUN THE DEMO
// ============================================================

async function main() {
  console.log("🚀 Human-in-the-Loop Example\n");
  console.log("=".repeat(50));

  if (!process.env.GOOGLE_API_KEY) {
    console.error("❌ GOOGLE_API_KEY not set");
    process.exit(1);
  }

  const agent = buildHumanLoopGraph();

  // Test 1: Safe action (no approval needed)
  console.log("\n📌 Test 1: Safe action (search)");
  let result = await agent.invoke({
    messages: [new HumanMessage("Search for information about LangGraph")],
  }, {
    configurable: { thread_id: "test1" },
  });
  console.log(`\n🤖 Result: ${result.messages[result.messages.length - 1].content}`);

  // Test 2: Dangerous action (needs approval)
  console.log("\n" + "=".repeat(50));
  console.log("\n📌 Test 2: Dangerous action (send email)");
  result = await agent.invoke({
    messages: [new HumanMessage("Send an email to bob@example.com saying hello")],
  }, {
    configurable: { thread_id: "test2" },
  });
  console.log(`\n🤖 Result: ${result.messages[result.messages.length - 1].content}`);
}

main().catch(console.error);

// ============================================================
// ALTERNATIVE: Using interrupt_before
// ============================================================
/**
 * LangGraph also supports automatic interrupts:
 * 
 * const graph = builder.compile({
 *   checkpointer: new MemorySaver(),
 *   interrupt_before: ["dangerous_node"],  // Pause before this node
 *   interrupt_after: ["review_node"],      // Pause after this node
 * });
 * 
 * // First invoke - runs until interrupt
 * const checkpoint = await graph.invoke(input, config);
 * 
 * // Get user decision, then resume
 * await graph.invoke(
 *   { ...checkpoint, userDecision: "approved" },
 *   config
 * );
 */

// ============================================================
// KEY TAKEAWAYS:
// ============================================================
/**
 * 1. Human-in-the-loop = pause for user approval
 * 
 * 2. Store pending actions in state
 * 
 * 3. Use routing to direct to approval node
 * 
 * 4. After approval, execute or skip
 * 
 * 5. interrupt_before/after can auto-pause at nodes
 * 
 * 6. Checkpointer is needed to resume after interrupt
 * 
 * 7. Common for: shell commands, file operations, emails
 */
