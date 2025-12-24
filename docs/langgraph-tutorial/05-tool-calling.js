/**
 * ============================================================
 * 05 - Tool Calling: Giving Tools to Your LLM
 * ============================================================
 * 
 * How to define and use tools with LangGraph and Gemini.
 * 
 * LEARNING GOALS:
 * - Define tools with DynamicStructuredTool
 * - Use Zod for input validation
 * - Bind tools to your LLM
 * - Handle tool calls and results
 */

import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

// ============================================================
// STEP 1: DEFINE TOOLS
// ============================================================

/**
 * What is a Tool?
 * 
 * A tool is a function that the LLM can call.
 * It has:
 * - name: Unique identifier
 * - description: What the tool does (LLM reads this!)
 * - schema: Input parameters using Zod
 * - func: The actual function to execute
 */

/**
 * TOOL 1: Calculator
 * 
 * A simple calculator for math operations.
 */
const calculatorTool = new DynamicStructuredTool({
  name: "calculator",
  description: "Perform mathematical calculations. Use this for any math operation.",
  
  // Schema defines the input parameters
  // This uses Zod for validation
  schema: z.object({
    expression: z.string().describe("The mathematical expression to evaluate, e.g., '2 + 2'"),
  }),
  
  // The function that runs when the tool is called
  func: async ({ expression }) => {
    console.log(`   🔧 Calculator called with: ${expression}`);
    try {
      // WARNING: eval is dangerous in production!
      // Use a proper math parser like mathjs
      const result = eval(expression);
      return `The result of ${expression} is ${result}`;
    } catch (error) {
      return `Error calculating: ${error.message}`;
    }
  },
});

/**
 * TOOL 2: Weather (Simulated)
 * 
 * Simulates getting weather data.
 */
const weatherTool = new DynamicStructuredTool({
  name: "get_weather",
  description: "Get the current weather for a location. Use this when the user asks about weather.",
  
  schema: z.object({
    location: z.string().describe("The city name, e.g., 'New York'"),
  }),
  
  func: async ({ location }) => {
    console.log(`   🔧 Weather tool called for: ${location}`);
    // Simulated weather data
    const weather = {
      "new york": { temp: 72, condition: "Sunny" },
      "london": { temp: 58, condition: "Cloudy" },
      "tokyo": { temp: 80, condition: "Humid" },
    };
    
    const data = weather[location.toLowerCase()] || { temp: 70, condition: "Clear" };
    return `Weather in ${location}: ${data.temp}°F and ${data.condition}`;
  },
});

/**
 * TOOL 3: Search (Simulated)
 * 
 * Simulates web search.
 */
const searchTool = new DynamicStructuredTool({
  name: "web_search",
  description: "Search the web for information. Use this when you need to look something up.",
  
  schema: z.object({
    query: z.string().describe("The search query"),
  }),
  
  func: async ({ query }) => {
    console.log(`   🔧 Search tool called with: ${query}`);
    // Simulated search results
    return `Search results for "${query}":\n` +
           `1. Wikipedia article about ${query}\n` +
           `2. ${query} - complete guide\n` +
           `3. Understanding ${query} for beginners`;
  },
});

// Collect all tools
const tools = [calculatorTool, weatherTool, searchTool];

// ============================================================
// STEP 2: CREATE LLM WITH TOOLS
// ============================================================

/**
 * Bind tools to the LLM.
 * This tells the LLM that these tools are available.
 */
const llm = new ChatGoogleGenerativeAI({
  model: "gemini-2.0-flash",
  temperature: 0,
  apiKey: process.env.GOOGLE_API_KEY,
});

// Bind tools to create a tool-aware LLM
const llmWithTools = llm.bindTools(tools);

// ============================================================
// STEP 3: DEFINE STATE
// ============================================================

const ToolState = Annotation.Root({
  messages: Annotation({
    reducer: (curr, update) => [...curr, ...(Array.isArray(update) ? update : [update])],
    default: () => [],
  }),
});

// ============================================================
// STEP 4: DEFINE NODES
// ============================================================

/**
 * NODE: Call the LLM
 * 
 * This node calls the LLM which may decide to use a tool.
 */
async function callModelNode(state) {
  console.log("📍 callModelNode");

  const response = await llmWithTools.invoke(state.messages);
  
  // Check if the LLM wants to call a tool
  if (response.tool_calls && response.tool_calls.length > 0) {
    console.log(`   LLM wants to use ${response.tool_calls.length} tool(s)`);
    response.tool_calls.forEach(tc => {
      console.log(`   → Tool: ${tc.name}`);
    });
  } else {
    console.log(`   LLM response: "${response.content?.slice(0, 50)}..."`);
  }

  return {
    messages: [response],
  };
}

/**
 * NODE: Execute Tools
 * 
 * When the LLM requests a tool call, this node executes it.
 */
async function executeToolsNode(state) {
  console.log("📍 executeToolsNode");

  // Get the last message (should be AIMessage with tool_calls)
  const lastMessage = state.messages[state.messages.length - 1];
  
  if (!lastMessage.tool_calls || lastMessage.tool_calls.length === 0) {
    console.log("   No tools to execute");
    return {};
  }

  // Execute each tool call
  const toolResults = [];
  
  for (const toolCall of lastMessage.tool_calls) {
    console.log(`   Executing tool: ${toolCall.name}`);
    
    // Find the tool
    const tool = tools.find(t => t.name === toolCall.name);
    
    if (tool) {
      // Execute the tool
      const result = await tool.invoke(toolCall.args);
      
      // Create a ToolMessage with the result
      const toolMessage = new ToolMessage({
        content: result,
        tool_call_id: toolCall.id,
        name: toolCall.name,
      });
      
      toolResults.push(toolMessage);
      console.log(`   Tool result: ${result.slice(0, 50)}...`);
    }
  }

  return {
    messages: toolResults,
  };
}

// ============================================================
// STEP 5: ROUTING FUNCTION
// ============================================================

/**
 * Check if we should call tools or end.
 * 
 * This creates a loop:
 * - If LLM wants to use tools → execute them → call LLM again
 * - If LLM gives a final answer → end
 */
function shouldCallTools(state) {
  const lastMessage = state.messages[state.messages.length - 1];
  
  // If the LLM made tool calls, we need to execute them
  if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
    console.log("🔀 Routing to: tools");
    return "call_tools";
  }
  
  // Otherwise, we're done
  console.log("🔀 Routing to: end");
  return "end";
}

// ============================================================
// STEP 6: BUILD THE GRAPH
// ============================================================

/**
 * Tool Calling Loop:
 * 
 *        START
 *          │
 *          ▼
 *      call_model ◄──────┐
 *          │             │
 *    [should call?]      │
 *      │       │         │
 *     yes     no         │
 *      │       │         │
 *      ▼       ▼         │
 *   tools     END        │
 *      │                 │
 *      └─────────────────┘
 */
function buildToolGraph() {
  const graph = new StateGraph(ToolState);

  // Add nodes
  graph.addNode("call_model", callModelNode);
  graph.addNode("tools", executeToolsNode);

  // Start by calling the model
  graph.addEdge(START, "call_model");

  // After model, check if we need to call tools
  graph.addConditionalEdges("call_model", shouldCallTools, {
    "call_tools": "tools",
    "end": END,
  });

  // After tools, go back to the model (with tool results)
  graph.addEdge("tools", "call_model");

  return graph.compile();
}

// ============================================================
// STEP 7: RUN EXAMPLES
// ============================================================

async function main() {
  console.log("🚀 Tool Calling Example\n");
  console.log("=".repeat(50));

  if (!process.env.GOOGLE_API_KEY) {
    console.error("❌ GOOGLE_API_KEY not set");
    process.exit(1);
  }

  const agent = buildToolGraph();

  // Test queries that require tools
  const queries = [
    "What is 25 * 17?",
    "What's the weather like in Tokyo?",
    "Search for information about LangGraph",
  ];

  for (const query of queries) {
    console.log("\n" + "=".repeat(50));
    console.log(`\n👤 User: "${query}"\n`);

    const result = await agent.invoke({
      messages: [new HumanMessage(query)],
    });

    // Get final response
    const finalMessage = result.messages[result.messages.length - 1];
    console.log(`\n🤖 Final Answer: ${finalMessage.content}`);
    
    console.log(`\n📊 Message count: ${result.messages.length}`);
  }
}

main().catch(console.error);

// ============================================================
// KEY TAKEAWAYS:
// ============================================================
/**
 * 1. Tools are defined with DynamicStructuredTool
 * 
 * 2. Zod schemas define and validate tool inputs
 * 
 * 3. llm.bindTools(tools) makes the LLM aware of tools
 * 
 * 4. LLM returns tool_calls when it wants to use a tool
 * 
 * 5. ToolMessage carries the result back to the LLM
 * 
 * 6. The graph loops: call_model → tools → call_model
 * 
 * 7. This is the foundation of the ReAct pattern
 */
