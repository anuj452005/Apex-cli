/**
 * ============================================================
 * 06 - ReAct Agent: Reasoning and Acting
 * ============================================================
 * 
 * Build a proper ReAct (Reasoning + Acting) agent.
 * This is the pattern used by most AI assistants.
 * 
 * LEARNING GOALS:
 * - Understand the ReAct pattern
 * - Use ToolNode for automatic tool execution
 * - Build a complete agent loop
 * - Handle multi-step reasoning
 */

import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

// ============================================================
// WHAT IS ReAct?
// ============================================================
/**
 * ReAct = Reasoning + Acting
 * 
 * The pattern:
 * 1. THINK: LLM reasons about what to do
 * 2. ACT: LLM decides to use a tool (or respond)
 * 3. OBSERVE: Get tool result
 * 4. REPEAT: Until task is complete
 * 
 * Example:
 * User: "What's 15% of $127.50?"
 * 
 * LLM thinks: "I need to calculate 15% of 127.50"
 * LLM acts: calculator("127.50 * 0.15")
 * Tool returns: "19.125"
 * LLM observes: The result is 19.125
 * LLM responds: "15% of $127.50 is $19.13"
 */

// ============================================================
// STEP 1: DEFINE TOOLS
// ============================================================

const calculatorTool = new DynamicStructuredTool({
  name: "calculator",
  description: "Useful for doing math calculations. Input should be a mathematical expression.",
  schema: z.object({
    expression: z.string().describe("Mathematical expression to evaluate"),
  }),
  func: async ({ expression }) => {
    try {
      // In production, use a proper math library!
      const result = eval(expression);
      return String(result);
    } catch (e) {
      return `Error: ${e.message}`;
    }
  },
});

const currentTimeTool = new DynamicStructuredTool({
  name: "get_current_time",
  description: "Get the current date and time",
  schema: z.object({}),  // No inputs needed
  func: async () => {
    return new Date().toLocaleString();
  },
});

const reminderTool = new DynamicStructuredTool({
  name: "set_reminder",
  description: "Set a reminder for a task",
  schema: z.object({
    task: z.string().describe("What to be reminded about"),
    time: z.string().describe("When to be reminded"),
  }),
  func: async ({ task, time }) => {
    // Simulated reminder setting
    return `Reminder set: "${task}" at ${time}`;
  },
});

// All tools in an array
const tools = [calculatorTool, currentTimeTool, reminderTool];

// ============================================================
// STEP 2: CREATE THE LLM
// ============================================================

const llm = new ChatGoogleGenerativeAI({
  model: "gemini-2.0-flash",
  temperature: 0,
  apiKey: process.env.GOOGLE_API_KEY,
}).bindTools(tools);  // Bind tools to the LLM

// ============================================================
// STEP 3: DEFINE STATE
// ============================================================

/**
 * Agent State
 * 
 * For a ReAct agent, we mainly need the messages array.
 * The conversation history IS the state.
 */
const AgentState = Annotation.Root({
  // Messages array - accumulates the conversation
  messages: Annotation({
    reducer: (current, update) => {
      const newMessages = Array.isArray(update) ? update : [update];
      return [...current, ...newMessages];
    },
    default: () => [],
  }),
});

// ============================================================
// STEP 4: DEFINE THE AGENT NODE
// ============================================================

/**
 * The agent node calls the LLM with the full conversation.
 * The LLM decides whether to:
 * 1. Call a tool (returns message with tool_calls)
 * 2. Give a final answer (returns message with content)
 */
async function agentNode(state) {
  console.log("📍 agentNode - LLM is thinking...");

  // System prompt that guides the agent's behavior
  const systemMessage = new SystemMessage(`You are a helpful AI assistant with access to tools.
When you need to perform calculations, use the calculator tool.
When you need to know the current time, use the get_current_time tool.
When the user asks to set a reminder, use the set_reminder tool.
Always reason step by step about what tool to use.`);

  // Call the LLM with system prompt + conversation
  const response = await llm.invoke([
    systemMessage,
    ...state.messages,
  ]);

  // Log what the LLM decided
  if (response.tool_calls?.length > 0) {
    console.log(`   LLM decided to call ${response.tool_calls.length} tool(s):`);
    response.tool_calls.forEach(tc => {
      console.log(`   → ${tc.name}(${JSON.stringify(tc.args)})`);
    });
  } else {
    console.log(`   LLM giving final answer: "${response.content?.slice(0, 50)}..."`);
  }

  return { messages: [response] };
}

// ============================================================
// STEP 5: USE TOOLNODE
// ============================================================

/**
 * ToolNode is a prebuilt node that automatically:
 * 1. Detects tool calls in the last message
 * 2. Executes the appropriate tools
 * 3. Returns ToolMessages with results
 * 
 * This is much cleaner than writing your own tool executor!
 */
const toolNode = new ToolNode(tools);

// ============================================================
// STEP 6: ROUTING FUNCTION
// ============================================================

/**
 * Determine next step based on LLM response.
 */
function shouldContinue(state) {
  const lastMessage = state.messages[state.messages.length - 1];

  // If the LLM made tool calls, execute them
  if (lastMessage.tool_calls?.length > 0) {
    console.log("🔀 Routing to: tools");
    return "tools";
  }

  // Otherwise, we're done
  console.log("🔀 Routing to: end");
  return "end";
}

// ============================================================
// STEP 7: BUILD THE GRAPH
// ============================================================

/**
 * ReAct Loop:
 * 
 *        START
 *          │
 *          ▼
 *        agent ◄────────┐
 *          │            │
 *    [has tools?]       │
 *      │       │        │
 *     yes     no        │
 *      │       │        │
 *      ▼       ▼        │
 *    tools    END       │
 *      │                │
 *      └────────────────┘
 */
function buildReActAgent() {
  const graph = new StateGraph(AgentState);

  // Add nodes
  graph.addNode("agent", agentNode);
  graph.addNode("tools", toolNode);  // Using the prebuilt ToolNode

  // Entry point
  graph.addEdge(START, "agent");

  // Conditional: after agent, check if we need tools
  graph.addConditionalEdges("agent", shouldContinue, {
    tools: "tools",
    end: END,
  });

  // After tools, always go back to agent
  graph.addEdge("tools", "agent");

  return graph.compile();
}

// ============================================================
// STEP 8: RUN THE AGENT
// ============================================================

async function main() {
  console.log("🚀 ReAct Agent Example\n");
  console.log("=".repeat(50));

  if (!process.env.GOOGLE_API_KEY) {
    console.error("❌ GOOGLE_API_KEY not set");
    process.exit(1);
  }

  const agent = buildReActAgent();

  // Test queries
  const queries = [
    "What is 15% of $127.50?",
    "What time is it right now?",
    "Set a reminder to call mom at 5pm",
    "Calculate (25 * 4) + (18 / 3)",
  ];

  for (const query of queries) {
    console.log("\n" + "=".repeat(50));
    console.log(`\n👤 User: "${query}"\n`);

    const result = await agent.invoke({
      messages: [new HumanMessage(query)],
    });

    // Get final answer
    const finalMessage = result.messages[result.messages.length - 1];
    console.log(`\n🤖 Agent: ${finalMessage.content}`);
    console.log(`\n📊 Steps taken: ${result.messages.length} messages`);
  }
}

main().catch(console.error);

// ============================================================
// UNDERSTANDING THE LOOP
// ============================================================
/**
 * For query: "What is 15% of $127.50?"
 * 
 * Step 1: User sends HumanMessage
 * messages: [HumanMessage("What is 15% of $127.50?")]
 * 
 * Step 2: Agent decides to use calculator
 * messages: [..., AIMessage(tool_calls: [{name: "calculator", args: {...}}])]
 * 
 * Step 3: ToolNode executes calculator
 * messages: [..., ToolMessage("19.125")]
 * 
 * Step 4: Agent sees result, formulates answer
 * messages: [..., AIMessage("15% of $127.50 is $19.13")]
 * 
 * Step 5: No more tools, route to END
 */

// ============================================================
// KEY TAKEAWAYS:
// ============================================================
/**
 * 1. ReAct = Reasoning + Acting in a loop
 * 
 * 2. ToolNode is a prebuilt node for executing tools
 * 
 * 3. The agent loop: agent → tools → agent → ... → end
 * 
 * 4. LLM decides when to use tools vs give final answer
 * 
 * 5. tool_calls triggers tool execution
 * 
 * 6. ToolMessages carry results back to the LLM
 * 
 * 7. This pattern can handle multi-step reasoning
 */
