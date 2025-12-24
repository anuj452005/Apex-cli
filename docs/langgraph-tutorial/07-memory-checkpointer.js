/**
 * ============================================================
 * 07 - Memory & Checkpointer: Persistent Conversations
 * ============================================================
 * 
 * How to save and resume conversations across sessions.
 * 
 * LEARNING GOALS:
 * - Understand checkpointers
 * - Use MemorySaver for development
 * - Create a file-based checkpointer
 * - Manage conversation threads
 */

import { StateGraph, START, END, Annotation, MemorySaver } from "@langchain/langgraph";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import fs from "fs/promises";
import path from "path";
import os from "os";
import dotenv from "dotenv";

dotenv.config();

// ============================================================
// WHAT IS A CHECKPOINTER?
// ============================================================
/**
 * A Checkpointer saves the state of your graph at each step.
 * This enables:
 * 
 * 1. PERSISTENCE: Save conversation to disk/database
 * 2. RESUMPTION: Continue a conversation later
 * 3. THREADS: Multiple independent conversations
 * 4. TIME TRAVEL: Go back to previous states
 * 
 * Common checkpointers:
 * - MemorySaver: In-memory (lost on restart) - for development
 * - SqliteSaver: SQLite database
 * - PostgresSaver: PostgreSQL database
 * - Custom: Your own implementation
 */

// ============================================================
// STEP 1: MEMORY SAVER (Development)
// ============================================================

/**
 * MemorySaver stores state in memory.
 * Fast but lost when the process ends.
 */
const memorySaver = new MemorySaver();

// ============================================================
// STEP 2: CUSTOM FILE-BASED CHECKPOINTER
// ============================================================

/**
 * For production, you might want to save to files or a database.
 * Here's a simple file-based session manager.
 */
class FileSessionManager {
  constructor(sessionDir) {
    // Default to ~/.apex-cli/sessions
    this.sessionDir = sessionDir || path.join(os.homedir(), ".apex-cli", "sessions");
  }

  async initialize() {
    // Create session directory if it doesn't exist
    await fs.mkdir(this.sessionDir, { recursive: true });
  }

  _getSessionPath(sessionId) {
    return path.join(this.sessionDir, `${sessionId}.json`);
  }

  /**
   * Save session data
   */
  async saveSession(sessionId, data) {
    const sessionPath = this._getSessionPath(sessionId);
    
    // Prepare data for JSON serialization
    const serializable = {
      ...data,
      messages: data.messages.map(msg => ({
        type: msg._getType ? msg._getType() : msg.constructor.name,
        content: msg.content,
        additional_kwargs: msg.additional_kwargs || {},
      })),
      savedAt: new Date().toISOString(),
    };

    await fs.writeFile(sessionPath, JSON.stringify(serializable, null, 2));
    console.log(`   💾 Session saved: ${sessionId}`);
  }

  /**
   * Load session data
   */
  async loadSession(sessionId) {
    const sessionPath = this._getSessionPath(sessionId);

    try {
      const content = await fs.readFile(sessionPath, "utf-8");
      const data = JSON.parse(content);

      // Reconstruct message objects
      data.messages = data.messages.map(msg => {
        switch (msg.type) {
          case "human":
            return new HumanMessage(msg.content);
          case "ai":
            return new AIMessage(msg.content);
          case "system":
            return new SystemMessage(msg.content);
          default:
            return new HumanMessage(msg.content);
        }
      });

      console.log(`   📂 Session loaded: ${sessionId}`);
      return data;
    } catch (error) {
      if (error.code === "ENOENT") {
        console.log(`   📂 No existing session: ${sessionId}`);
        return null;
      }
      throw error;
    }
  }

  /**
   * List all sessions
   */
  async listSessions() {
    try {
      const files = await fs.readdir(this.sessionDir);
      return files
        .filter(f => f.endsWith(".json"))
        .map(f => f.replace(".json", ""));
    } catch {
      return [];
    }
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId) {
    const sessionPath = this._getSessionPath(sessionId);
    await fs.unlink(sessionPath);
    console.log(`   🗑️ Session deleted: ${sessionId}`);
  }
}

// ============================================================
// STEP 3: DEFINE STATE AND GRAPH
// ============================================================

const ChatState = Annotation.Root({
  messages: Annotation({
    reducer: (curr, update) => [...curr, ...(Array.isArray(update) ? update : [update])],
    default: () => [],
  }),
  sessionId: Annotation({
    reducer: (_, update) => update,
    default: () => null,
  }),
});

const llm = new ChatGoogleGenerativeAI({
  model: "gemini-2.0-flash",
  temperature: 0.7,
  apiKey: process.env.GOOGLE_API_KEY,
});

async function chatNode(state) {
  console.log("📍 chatNode");

  const systemMessage = new SystemMessage(
    "You are a helpful assistant. Keep responses concise."
  );

  const response = await llm.invoke([systemMessage, ...state.messages]);

  return { messages: [response] };
}

function buildChatGraph() {
  const graph = new StateGraph(ChatState);

  graph.addNode("chat", chatNode);
  graph.addEdge(START, "chat");
  graph.addEdge("chat", END);

  // IMPORTANT: Pass the checkpointer to compile()
  return graph.compile({
    checkpointer: memorySaver,  // Enable persistence
  });
}

// ============================================================
// STEP 4: USING THREADS
// ============================================================

/**
 * A THREAD is an independent conversation.
 * 
 * Each thread has a unique thread_id.
 * The checkpointer saves state per thread.
 * 
 * config = { configurable: { thread_id: "unique-id" } }
 */

async function demonstrateThreads() {
  console.log("\n🧵 DEMONSTRATING THREADS\n");
  console.log("=".repeat(50));

  const chatbot = buildChatGraph();

  // Thread 1: Conversation about coding
  const thread1Config = {
    configurable: { thread_id: "coding-chat" },
  };

  // Thread 2: Conversation about cooking
  const thread2Config = {
    configurable: { thread_id: "cooking-chat" },
  };

  // Send message to Thread 1
  console.log("\n📌 Thread 1 (Coding):");
  let result1 = await chatbot.invoke(
    { messages: [new HumanMessage("What is a function in JavaScript?")] },
    thread1Config
  );
  console.log(`   🤖 ${result1.messages[result1.messages.length - 1].content.slice(0, 100)}...`);

  // Send message to Thread 2
  console.log("\n📌 Thread 2 (Cooking):");
  let result2 = await chatbot.invoke(
    { messages: [new HumanMessage("How do I make pasta?")] },
    thread2Config
  );
  console.log(`   🤖 ${result2.messages[result2.messages.length - 1].content.slice(0, 100)}...`);

  // Continue Thread 1 (it remembers the context!)
  console.log("\n📌 Thread 1 (Continue Coding):");
  result1 = await chatbot.invoke(
    { messages: [new HumanMessage("Can you give me an example?")] },
    thread1Config
  );
  console.log(`   🤖 ${result1.messages[result1.messages.length - 1].content.slice(0, 100)}...`);
  console.log(`   📊 Total messages in Thread 1: ${result1.messages.length}`);

  // Threads are independent!
  console.log("\n📌 Thread 2 (Continue Cooking):");
  result2 = await chatbot.invoke(
    { messages: [new HumanMessage("What sauce goes well with it?")] },
    thread2Config
  );
  console.log(`   🤖 ${result2.messages[result2.messages.length - 1].content.slice(0, 100)}...`);
  console.log(`   📊 Total messages in Thread 2: ${result2.messages.length}`);
}

// ============================================================
// STEP 5: FILE-BASED PERSISTENCE DEMO
// ============================================================

async function demonstrateFilePersistence() {
  console.log("\n\n💾 DEMONSTRATING FILE PERSISTENCE\n");
  console.log("=".repeat(50));

  const sessionManager = new FileSessionManager();
  await sessionManager.initialize();

  const chatbot = buildChatGraph();
  const sessionId = "demo-session-" + Date.now().toString().slice(-6);

  // Simulate a conversation
  console.log("\n📌 Starting new session:", sessionId);

  // First message
  let state = await chatbot.invoke(
    { messages: [new HumanMessage("Hello! My name is Alice.")] },
    { configurable: { thread_id: sessionId } }
  );

  // Save after first exchange
  await sessionManager.saveSession(sessionId, state);

  // Second message
  state = await chatbot.invoke(
    { messages: [new HumanMessage("What's my name?")] },
    { configurable: { thread_id: sessionId } }
  );

  // Save again
  await sessionManager.saveSession(sessionId, state);

  // Load and verify
  console.log("\n📌 Loading saved session...");
  const loaded = await sessionManager.loadSession(sessionId);
  console.log(`   Messages in session: ${loaded.messages.length}`);
  loaded.messages.forEach((msg, i) => {
    const type = msg._getType ? msg._getType() : "message";
    console.log(`   ${i + 1}. [${type}] ${msg.content.slice(0, 50)}...`);
  });

  // List all sessions
  const sessions = await sessionManager.listSessions();
  console.log(`\n📂 All sessions: ${sessions.join(", ")}`);

  // Cleanup demo session
  await sessionManager.deleteSession(sessionId);
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log("🚀 Memory & Checkpointer Example\n");

  if (!process.env.GOOGLE_API_KEY) {
    console.error("❌ GOOGLE_API_KEY not set");
    process.exit(1);
  }

  // Demo 1: Threads with MemorySaver
  await demonstrateThreads();

  // Demo 2: File-based persistence
  await demonstrateFilePersistence();

  console.log("\n" + "=".repeat(50));
  console.log("\n✅ All demos complete!");
}

main().catch(console.error);

// ============================================================
// KEY TAKEAWAYS:
// ============================================================
/**
 * 1. Checkpointer = saves state at each step
 * 
 * 2. MemorySaver = in-memory, for development
 * 
 * 3. thread_id = unique identifier for each conversation
 * 
 * 4. Pass config to invoke(): { configurable: { thread_id: "..." } }
 * 
 * 5. Each thread maintains its own conversation history
 * 
 * 6. For production: use database-backed checkpointers
 * 
 * 7. Custom persistence: save/load state manually
 */
