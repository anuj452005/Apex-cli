/**
 * ============================================================================
 * 📚 LANGGRAPH LEARNING PATH - FILE 10 OF 11
 * ============================================================================
 * 
 * 📖 WHAT IS THIS FILE?
 *    This is the SESSION file - it manages conversation state, persistence,
 *    and provides a clean API for the CLI to interact with the agent.
 * 
 * 📝 PREREQUISITES: Read state.js through graph.js (1-9) first
 * 
 * ➡️  NEXT FILE: After understanding this, read agent.js (11/11) - the CLI!
 * 
 * ============================================================================
 * 
 * 🧠 WHAT DOES A SESSION DO?
 * 
 * A session:
 *   1. Creates and manages a unique thread ID
 *   2. Sets up the checkpointer for persistence
 *   3. Creates the graph with the checkpointer
 *   4. Provides a simple .chat() method for the CLI
 *   5. Handles loading and saving session state
 * 
 * Think of it as the "manager" that handles all the LangGraph complexity
 * and gives you a simple interface.
 * 
 * ============================================================================
 */

import { MemorySaver } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import fs from "fs";
import path from "path";
import chalk from "chalk";
import { v4 as uuidv4 } from "uuid";

import { createAgentGraph, buildFullAgentGraph, buildSimpleChatGraph } from "./graph.js";
import { createInitialState } from "./state.js";
import { config } from "../../config/google.config.js";

// ============================================================================
// UNDERSTANDING SESSIONS
// ============================================================================
/**
 * A "session" in chat applications is a container for:
 *   - The conversation history
 *   - Any state (like plans, step results, etc.)
 *   - A unique ID to identify it
 * 
 * With LangGraph's checkpointer:
 *   - State is saved after each node
 *   - You can resume from where you left off
 *   - Multiple sessions can exist simultaneously
 */

// ============================================================================
// SESSION MANAGER CLASS
// ============================================================================
/**
 * AgentSession - Manages a single agent conversation session.
 * 
 * Usage:
 *   const session = new AgentSession();
 *   const result = await session.chat("Hello!");
 *   console.log(result.response);
 * 
 * To resume:
 *   const session = new AgentSession("existing-session-id");
 */
export class AgentSession {
  /**
   * Create a new session or resume an existing one.
   * 
   * @param {string} sessionId - Optional session ID to resume
   * @param {string} mode - "agent" for full planning, "chat" for simple chat
   */
  constructor(sessionId = null, mode = "agent") {
    // ─────────────────────────────────────────────────────────────────────────
    // SESSION ID
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Each session has a unique ID. If not provided, generate one.
     * The ID is used as the "thread_id" for the checkpointer.
     */
    this.sessionId = sessionId || this.generateSessionId();
    this.mode = mode;
    
    // ─────────────────────────────────────────────────────────────────────────
    // FILE-BASED PERSISTENCE
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * We store session data in ~/.apex-cli/sessions/
     * Each session gets its own JSON file.
     */
    this.sessionsDir = config.sessionsDir;
    this.ensureSessionsDir();
    
    // ─────────────────────────────────────────────────────────────────────────
    // CHECKPOINTER
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * MemorySaver is LangGraph's built-in in-memory checkpointer.
     * It saves state in memory and persists it when we save to file.
     * 
     * For production, you might use:
     *   - PostgresSaver (database)
     *   - RedisSaver (cache)
     *   - Custom file-based saver
     */
    this.checkpointer = new MemorySaver();
    
    // ─────────────────────────────────────────────────────────────────────────
    // CREATE THE GRAPH
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Build the graph with our checkpointer.
     * The checkpointer enables:
     *   - State saving after each node
     *   - Resuming from checkpoints
     *   - Thread-based conversations
     */
    if (mode === "agent") {
      this.graph = buildFullAgentGraph(this.checkpointer);
    } else {
      this.graph = buildSimpleChatGraph(this.checkpointer);
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // THREAD CONFIG
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Thread config is passed to every graph invocation.
     * It tells the checkpointer which thread (session) to use.
     */
    this.threadConfig = {
      configurable: {
        thread_id: this.sessionId,
      },
    };
    
    console.log(chalk.gray(`   Session initialized: ${this.sessionId}`));
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // CHAT METHOD
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Send a message to the agent and get a response.
   * 
   * This is the main method you'll use!
   * 
   * @param {string} userMessage - The user's message
   * @returns {Object} { response, iterations, error }
   * 
   * @example
   * const result = await session.chat("Create a hello.txt file");
   * console.log(result.response);
   */
  async chat(userMessage) {
    console.log(chalk.gray(`\n💬 Processing: "${userMessage.slice(0, 50)}..."`));
    
    try {
      // ─────────────────────────────────────────────────────────────────────
      // STEP 1: CREATE INPUT STATE
      // ─────────────────────────────────────────────────────────────────────
      /**
       * We only need to provide the new message as input.
       * The checkpointer will provide the rest of the state from memory.
       */
      const input = {
        messages: [new HumanMessage(userMessage)],
        mode: this.mode,
      };
      
      // ─────────────────────────────────────────────────────────────────────
      // STEP 2: INVOKE THE GRAPH
      // ─────────────────────────────────────────────────────────────────────
      /**
       * graph.invoke() runs the entire graph from START to END.
       * It returns the final state after all nodes have run.
       */
      const result = await this.graph.invoke(input, this.threadConfig);
      
      // ─────────────────────────────────────────────────────────────────────
      // STEP 3: EXTRACT THE RESPONSE
      // ─────────────────────────────────────────────────────────────────────
      /**
       * Get the last AI message from the messages array.
       * This is the agent's final response.
       */
      const lastMessage = result.messages[result.messages.length - 1];
      const response = lastMessage?.content || "No response";
      
      // ─────────────────────────────────────────────────────────────────────
      // STEP 4: SAVE SESSION
      // ─────────────────────────────────────────────────────────────────────
      this.saveSession(result);
      
      return {
        response,
        iterations: result.iterations,
        plan: result.plan,
        stepResults: result.stepResults,
        error: result.error,
      };
      
    } catch (error) {
      console.error(chalk.red(`Session error: ${error.message}`));
      return {
        response: `Error: ${error.message}`,
        error: error.message,
      };
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // STREAM METHOD (Advanced)
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Stream the agent's execution for real-time updates.
   * 
   * This is more advanced - it yields events as the graph runs.
   * Useful for showing progress in a UI.
   * 
   * @param {string} userMessage - The user's message
   * @yields {Object} Events from the graph execution
   */
  async *stream(userMessage) {
    const input = {
      messages: [new HumanMessage(userMessage)],
      mode: this.mode,
    };
    
    // Stream events from the graph
    for await (const event of this.graph.stream(input, {
      ...this.threadConfig,
      streamMode: "values",
    })) {
      yield event;
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // SESSION MANAGEMENT HELPERS
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Generate a unique session ID.
   */
  generateSessionId() {
    const timestamp = new Date().toISOString().slice(0, 10);
    const uuid = uuidv4().slice(0, 8);
    return `session-${timestamp}-${uuid}`;
  }
  
  /**
   * Ensure the sessions directory exists.
   */
  ensureSessionsDir() {
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }
  }
  
  /**
   * Get the file path for this session.
   */
  getSessionFilePath() {
    return path.join(this.sessionsDir, `${this.sessionId}.json`);
  }
  
  /**
   * Save session state to file.
   */
  saveSession(state) {
    try {
      const sessionData = {
        sessionId: this.sessionId,
        mode: this.mode,
        savedAt: new Date().toISOString(),
        plan: state.plan,
        currentStep: state.currentStep,
        stepResults: state.stepResults,
        iterations: state.iterations,
        // Don't save full messages - they can be large
        messageCount: state.messages?.length || 0,
      };
      
      fs.writeFileSync(
        this.getSessionFilePath(),
        JSON.stringify(sessionData, null, 2)
      );
    } catch (error) {
      console.error(chalk.yellow(`Warning: Could not save session: ${error.message}`));
    }
  }
  
  /**
   * Load session metadata.
   */
  loadSession() {
    try {
      const filePath = this.getSessionFilePath();
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, "utf-8"));
      }
    } catch (error) {
      console.error(chalk.yellow(`Warning: Could not load session: ${error.message}`));
    }
    return null;
  }
  
  /**
   * Get session info for display.
   */
  getSessionInfo() {
    return {
      sessionId: this.sessionId,
      mode: this.mode,
      sessionsDir: this.sessionsDir,
    };
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // STATIC METHODS
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * List all saved sessions.
   */
  static async listSessions() {
    try {
      if (!fs.existsSync(config.sessionsDir)) {
        return [];
      }
      
      const files = fs.readdirSync(config.sessionsDir);
      return files
        .filter(f => f.endsWith(".json"))
        .map(f => f.replace(".json", ""));
    } catch (error) {
      return [];
    }
  }
  
  /**
   * Delete a session.
   */
  static async deleteSession(sessionId) {
    try {
      const filePath = path.join(config.sessionsDir, `${sessionId}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
    } catch (error) {
      console.error(chalk.red(`Error deleting session: ${error.message}`));
    }
    return false;
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Quick chat without managing a session explicitly.
 * 
 * @param {string} message - User message
 * @param {string} mode - Agent mode
 * @returns {Object} Chat result
 */
export async function quickChat(message, mode = "agent") {
  const session = new AgentSession(null, mode);
  return session.chat(message);
}

// ============================================================================
// 📝 WHAT'S NEXT?
// ============================================================================
/**
 * Great! You now understand:
 *   ✅ What a session is (container for conversation state)
 *   ✅ How the checkpointer enables persistence
 *   ✅ How to use session.chat() for simple interaction
 *   ✅ How sessions are saved and loaded
 * 
 * ➡️  FINAL: Read agent.js (11/11) to see the CLI that uses all of this!
 */
