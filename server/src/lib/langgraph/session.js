/**
 * LangGraph Session Management
 * 
 * Provides AgentSession class and FileCheckpointer for
 * file-based persistence of conversation state.
 */

import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { BaseCheckpointSaver } from "@langchain/langgraph";
import fs from "fs/promises";
import path from "path";

import { buildFullAgent } from "./graph.js";
import { config } from "../../config/google.config.js";

// ============================================================
// FILE-BASED CHECKPOINTER
// ============================================================

/**
 * File-based checkpointer for persistent storage
 * Saves session state to JSON files in the sessions directory
 */
export class FileCheckpointer extends BaseCheckpointSaver {
  constructor(sessionsDir = config.sessionsDir) {
    super();
    this.sessionsDir = sessionsDir;
    this.storage = new Map();
  }

  /**
   * Get the file path for a thread
   */
  _getFilePath(threadId) {
    return path.join(this.sessionsDir, `${threadId}.json`);
  }

  /**
   * Ensure the sessions directory exists
   */
  async _ensureDir() {
    await fs.mkdir(this.sessionsDir, { recursive: true });
  }

  /**
   * Load state from file
   */
  async _loadFromFile(threadId) {
    try {
      const filePath = this._getFilePath(threadId);
      const content = await fs.readFile(filePath, "utf-8");
      const data = JSON.parse(content);
      this.storage.set(threadId, data);
      return data;
    } catch (error) {
      // File doesn't exist yet
      return null;
    }
  }

  /**
   * Save state to file
   */
  async _saveToFile(threadId, data) {
    await this._ensureDir();
    const filePath = this._getFilePath(threadId);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
  }

  /**
   * Get a checkpoint tuple
   */
  async getTuple(config) {
    const threadId = config.configurable?.thread_id;
    if (!threadId) return undefined;

    // Try memory first, then file
    let data = this.storage.get(threadId);
    if (!data) {
      data = await this._loadFromFile(threadId);
    }

    if (!data) return undefined;

    return {
      config,
      checkpoint: data.checkpoint,
      metadata: data.metadata,
      parentConfig: data.parentConfig,
    };
  }

  /**
   * List checkpoints - returns async generator
   */
  async *list(config, options) {
    const threadId = config.configurable?.thread_id;
    if (!threadId) return;

    const tuple = await this.getTuple(config);
    if (tuple) {
      yield tuple;
    }
  }

  /**
   * Put a checkpoint
   */
  async put(config, checkpoint, metadata) {
    const threadId = config.configurable?.thread_id;
    if (!threadId) return config;

    const data = {
      checkpoint,
      metadata,
      parentConfig: config,
      savedAt: new Date().toISOString(),
    };

    this.storage.set(threadId, data);
    await this._saveToFile(threadId, data);

    return {
      configurable: {
        thread_id: threadId,
        checkpoint_id: checkpoint.id,
      },
    };
  }

  /**
   * Put writes - for pending writes
   */
  async putWrites(config, writes, taskId) {
    // Not implemented for file-based storage
    // This is for more complex checkpoint scenarios
  }
}

// ============================================================
// AGENT SESSION CLASS
// ============================================================

/**
 * AgentSession provides a clean interface for using the agent.
 * Handles session management, memory persistence, and conversation flow.
 */
export class AgentSession {
  /**
   * Create a new agent session
   * @param {string} sessionId - Optional session ID (generates one if not provided)
   */
  constructor(sessionId = null) {
    this.sessionId = sessionId || `session_${Date.now()}`;
    this.checkpointer = new FileCheckpointer();
    this.agent = buildFullAgent(this.checkpointer);
    this.config = {
      configurable: { thread_id: this.sessionId },
    };
  }

  /**
   * Send a message and get a response
   * @param {string} message - User message
   * @returns {Promise<Object>} Response with content, iterations, and error
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
      (m) => m._getType?.() === "ai" && m.content
    );
    const lastAI = aiMessages[aiMessages.length - 1];

    return {
      response: lastAI?.content || "No response",
      iterations: result.iterations,
      error: result.error,
    };
  }

  /**
   * Stream responses (yields chunks as they become available)
   * Note: LangGraph streaming is event-based, this is a simplified version
   * @param {string} message - User message
   */
  async *stream(message) {
    const result = await this.agent.invoke(
      {
        messages: [new HumanMessage(message)],
      },
      this.config
    );

    // Get the final AI message
    const aiMessages = result.messages.filter(
      (m) => m._getType?.() === "ai" && m.content
    );
    const lastAI = aiMessages[aiMessages.length - 1];

    if (lastAI?.content) {
      // Simulate streaming by yielding chunks
      const content = lastAI.content;
      const chunkSize = 10;
      for (let i = 0; i < content.length; i += chunkSize) {
        yield content.slice(i, i + chunkSize);
        // Small delay for visual effect
        await new Promise((r) => setTimeout(r, 20));
      }
    }
  }

  /**
   * Get session info
   */
  getSessionInfo() {
    return {
      sessionId: this.sessionId,
      sessionsDir: this.checkpointer.sessionsDir,
    };
  }

  /**
   * List all available sessions
   */
  static async listSessions() {
    try {
      await fs.mkdir(config.sessionsDir, { recursive: true });
      const files = await fs.readdir(config.sessionsDir);
      return files
        .filter((f) => f.endsWith(".json"))
        .map((f) => f.replace(".json", ""));
    } catch (error) {
      return [];
    }
  }

  /**
   * Delete a session
   * @param {string} sessionId - Session ID to delete
   */
  static async deleteSession(sessionId) {
    try {
      const filePath = path.join(config.sessionsDir, `${sessionId}.json`);
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      return false;
    }
  }
}
