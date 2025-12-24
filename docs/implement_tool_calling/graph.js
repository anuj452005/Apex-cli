/**
 * Tool-Enabled LangGraph using ReAct Pattern
 * 
 * This graph implements the ReAct (Reasoning + Acting) pattern,
 * where the LLM decides which tools to call and processes results.
 */

import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { getAllTools } from "./registry.js";
import { TOOLS_CONFIG } from "./config.js";
import { memoryCheckpointer } from "../shared/checkpointer.js";

/**
 * State definition for tool-enabled agent
 */
const ToolAgentState = Annotation.Root({
  messages: Annotation({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),
  
  toolCallCount: Annotation({
    reducer: (_, update) => update,
    default: () => 0,
  }),
});

/**
 * Create LLM with tool binding
 */
function createToolLLM() {
  const llm = new ChatGoogleGenerativeAI({
    model: TOOLS_CONFIG.llm.model,
    temperature: TOOLS_CONFIG.llm.temperature,
    apiKey: TOOLS_CONFIG.llm.apiKey,
  });

  // Bind all available tools to the LLM
  const tools = getAllTools();
  return llm.bindTools(tools);
}

/**
 * Call Model Node
 * Invokes the LLM which may return tool calls
 */
async function callModelNode(state) {
  const { messages } = state;

  // Create LLM with tools bound
  const llmWithTools = createToolLLM();

  // Add system prompt if not present
  let allMessages = messages;
  if (messages.length === 0 || messages[0]._getType?.() !== "system") {
    allMessages = [
      new SystemMessage(TOOLS_CONFIG.systemPrompt),
      ...messages,
    ];
  }

  // Invoke the model
  const response = await llmWithTools.invoke(allMessages);

  return {
    messages: [response],
  };
}

/**
 * Tools Node
 * Uses LangGraph's prebuilt ToolNode to execute tool calls
 */
const toolNode = new ToolNode(getAllTools());

async function executeToolsNode(state) {
  const { messages, toolCallCount } = state;

  // Check if max tool calls exceeded
  if (toolCallCount >= TOOLS_CONFIG.general.maxToolCalls) {
    return {
      messages: [
        new AIMessage(
          "I've reached the maximum number of tool calls for this turn. Please ask me to continue if you need more actions."
        ),
      ],
    };
  }

  // Execute tools using the prebuilt ToolNode
  const result = await toolNode.invoke(state);

  return {
    ...result,
    toolCallCount: toolCallCount + 1,
  };
}

/**
 * Routing function
 * Determines whether to call tools or end the conversation
 */
function shouldCallTools(state) {
  const { messages } = state;
  const lastMessage = messages[messages.length - 1];

  // Check if the last message has tool calls
  if (
    lastMessage._getType?.() === "ai" &&
    lastMessage.tool_calls &&
    lastMessage.tool_calls.length > 0
  ) {
    return "tools";
  }

  return "end";
}

/**
 * Build the Tool-Enabled Agent Graph
 * 
 * Flow:
 * START → call_model → [has_tool_calls?] → tools → call_model (loop)
 *                    → [no_tool_calls?] → END
 */
function buildToolAgentGraph() {
  const graph = new StateGraph(ToolAgentState);

  // Add nodes
  graph.addNode("call_model", callModelNode);
  graph.addNode("tools", executeToolsNode);

  // Add edges
  graph.addEdge(START, "call_model");

  // Conditional edge based on tool calls
  graph.addConditionalEdges("call_model", shouldCallTools, {
    tools: "tools",
    end: END,
  });

  // After tools, go back to model
  graph.addEdge("tools", "call_model");

  return graph;
}

/**
 * Compiled Tool Agent
 */
export const toolAgent = buildToolAgentGraph().compile({
  checkpointer: memoryCheckpointer,
});

/**
 * Tool Agent Session
 * Manages a tool-enabled conversation session
 */
export class ToolAgentSession {
  constructor(sessionId = null) {
    this.sessionId = sessionId || `tool_session_${Date.now()}`;
    this.messages = [];
  }

  /**
   * Send a message and get a response (may include tool calls)
   */
  async sendMessage(message) {
    // Add user message
    const humanMessage = new HumanMessage(message);
    this.messages.push(humanMessage);

    // Run the agent
    const config = {
      configurable: {
        thread_id: this.sessionId,
      },
    };

    const result = await toolAgent.invoke(
      {
        messages: this.messages,
        toolCallCount: 0,
      },
      config
    );

    // Update local messages
    this.messages = result.messages;

    // Get the last AI message
    const aiMessages = result.messages.filter(
      m => m._getType?.() === "ai" && !m.tool_calls?.length
    );

    return aiMessages[aiMessages.length - 1]?.content || null;
  }

  /**
   * Stream responses (for progressive UI updates)
   */
  async *streamMessage(message) {
    const humanMessage = new HumanMessage(message);

    const config = {
      configurable: {
        thread_id: this.sessionId,
      },
    };

    // Stream through the graph
    for await (const chunk of await toolAgent.stream(
      {
        messages: [...this.messages, humanMessage],
        toolCallCount: 0,
      },
      config
    )) {
      yield chunk;
    }
  }

  /**
   * Get conversation history
   */
  getHistory() {
    return this.messages;
  }

  /**
   * Clear conversation
   */
  clearHistory() {
    this.messages = [];
  }
}

/**
 * Quick tool agent invocation
 */
export async function invokeToolAgent(message, sessionId = null) {
  const session = new ToolAgentSession(sessionId);
  return await session.sendMessage(message);
}

export default toolAgent;
