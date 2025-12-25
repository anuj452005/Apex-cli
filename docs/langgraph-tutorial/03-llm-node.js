/**
 * ============================================================
 * 03 - LLM Node: Adding AI to Your Graph
 * ============================================================
 * 
 * How to integrate an LLM (Gemini) into your LangGraph.
 * 
 * LEARNING GOALS:
 * - Set up ChatGoogleGenerativeAI
 * - Create chat nodes
 * - Handle message formatting
 * - Build a simple chatbot graph
 */

import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// ============================================================
// STEP 1: SET UP THE LLM
// ============================================================

/**
 * Create a ChatGoogleGenerativeAI instance.
 * This is the LangChain wrapper for Google's Gemini API.
 */
const llm = new ChatGoogleGenerativeAI({
  // The model to use (gemini-2.0-flash is fast and capable)
  model: "gemini-2.0-flash",
  
  // Temperature controls randomness (0 = deterministic, 1 = creative)
  temperature: 0.7,
  
  // Maximum tokens in the response
  maxOutputTokens: 1024,
  
  // API key from environment variables
  apiKey: ,
});

// ============================================================
// STEP 2: DEFINE STATE
// ============================================================

/**
 * Chat state with messages array.
 * This is the standard pattern for chat applications.
 */
const ChatState = Annotation.Root({
  // Messages array - accumulates as conversation progresses
  messages: Annotation({
    reducer: (current, update) => {
      // Handle both single message and array
      const newMessages = Array.isArray(update) ? update : [update];
      return [...current, ...newMessages];
    },
    default: () => [],
  }),
  
  // Current user input (transient - cleared after processing)
  userInput: Annotation({
    reducer: (_, update) => update,
    default: () => "",
  }),
});

// ============================================================
// STEP 3: DEFINE NODES
// ============================================================

/**
 * System prompt that defines the AI's personality.
 * This is included at the start of every conversation.
 */
const SYSTEM_PROMPT = `You are a helpful, friendly AI assistant.
Keep your responses concise but informative.
If you don't know something, say so honestly.`;

/**
 * NODE: Process user input
 * 
 * Takes the user input and creates a HumanMessage.
 */
async function processInputNode(state) {
  console.log("📍 processInputNode");
  console.log(`   User said: "${state.userInput}"`);

  // Create a HumanMessage from the input
  const humanMessage = new HumanMessage(state.userInput);

  return {
    // Add the human message to the conversation
    messages: [humanMessage],
    // Clear the input (it's been processed)
    userInput: "",
  };
}

/**
 * NODE: Call the LLM
 * 
 * Sends messages to Gemini and gets a response.
 * This is where the AI "thinks".
 */
async function callLLMNode(state) {
  console.log("📍 callLLMNode");
  console.log(`   Processing ${state.messages.length} messages...`);

  // Build the full message list with system prompt
  const systemMessage = new SystemMessage(SYSTEM_PROMPT);
  const allMessages = [systemMessage, ...state.messages];

  // Call the LLM
  // The invoke() method sends messages and returns the AI response
  const response = await llm.invoke(allMessages);

  console.log(`   AI response: "${response.content.slice(0, 50)}..."`);

  // The response is already an AIMessage
  return {
    messages: [response],
  };
}

/**
 * NODE: Format output (optional post-processing)
 * 
 * You can add post-processing here if needed.
 */
async function formatOutputNode(state) {
  console.log("📍 formatOutputNode");
  
  // Get the last message (the AI's response)
  const lastMessage = state.messages[state.messages.length - 1];
  
  // Log the final response
  console.log(`   Final response ready: ${lastMessage.content.length} chars`);

  // No state changes needed - just pass through
  return {};
}

// ============================================================
// STEP 4: BUILD THE GRAPH
// ============================================================

/**
 * Chat Graph Structure:
 * 
 *      START
 *        │
 *        ▼
 *   process_input
 *        │
 *        ▼
 *     call_llm
 *        │
 *        ▼
 *   format_output
 *        │
 *        ▼
 *       END
 */
function buildChatGraph() {
  const graph = new StateGraph(ChatState);

  // Add all nodes
  graph.addNode("process_input", processInputNode);
  graph.addNode("call_llm", callLLMNode);
  graph.addNode("format_output", formatOutputNode);

  // Define the flow
  graph.addEdge(START, "process_input");
  graph.addEdge("process_input", "call_llm");
  graph.addEdge("call_llm", "format_output");
  graph.addEdge("format_output", END);

  return graph.compile();
}

// ============================================================
// STEP 5: RUN THE CHATBOT
// ============================================================

async function main() {
  console.log("🚀 LLM Node Example - Gemini Chatbot\n");
  console.log("=".repeat(50));

  // Check for API key
  if (!process.env.GOOGLE_API_KEY) {
    console.error("❌ Error: GOOGLE_API_KEY not set in environment");
    console.log("   Create a .env file with: GOOGLE_API_KEY=your-key-here");
    process.exit(1);
  }

  // Build the graph
  const chatbot = buildChatGraph();

  // Simulate a conversation with multiple turns
  const conversation = [
    "Hello! What can you help me with?",
    "Can you explain what an API is?",
    "Thanks! One more question: what's the difference between REST and GraphQL?",
  ];

  let state = { messages: [], userInput: "" };

  for (const userMessage of conversation) {
    console.log("\n" + "=".repeat(50));
    console.log(`\n👤 User: ${userMessage}\n`);

    // Invoke the graph with new input
    // IMPORTANT: We pass the accumulated messages + new input
    state = await chatbot.invoke({
      messages: state.messages,  // Keep conversation history
      userInput: userMessage,     // New user input
    });

    // Get the AI's response (last message)
    const aiResponse = state.messages[state.messages.length - 1];
    console.log(`\n🤖 AI: ${aiResponse.content}`);
  }

  console.log("\n" + "=".repeat(50));
  console.log("\n✅ Conversation complete!");
  console.log(`   Total messages: ${state.messages.length}`);
}

main().catch(console.error);

// ============================================================
// KEY TAKEAWAYS:
// ============================================================
/**
 * 1. ChatGoogleGenerativeAI is the LangChain wrapper for Gemini
 * 
 * 2. Messages are typed: HumanMessage, AIMessage, SystemMessage
 * 
 * 3. The LLM node calls llm.invoke(messages) to get a response
 * 
 * 4. Conversation history is maintained in the messages array
 * 
 * 5. Each graph invoke adds to the message history
 * 
 * 6. System prompt is typically added at the start of messages
 */
