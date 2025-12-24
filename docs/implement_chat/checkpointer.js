/**
 * Checkpointer for LangGraph State Persistence
 * 
 * Provides memory persistence for conversation state.
 * This allows conversations to maintain context across invocations.
 */

import { MemorySaver } from "@langchain/langgraph";
import fs from "fs/promises";
import path from "path";
import os from "os";

// Directory for persistent storage
const APEX_DIR = path.join(os.homedir(), ".apex-cli");
const SESSIONS_FILE = path.join(APEX_DIR, "sessions.json");

/**
 * In-memory checkpointer for session state
 * Uses LangGraph's built-in MemorySaver
 */
export const memoryCheckpointer = new MemorySaver();

/**
 * Session Manager for persistent conversation storage
 * Saves/loads conversation sessions to disk
 */
export class SessionManager {
  constructor() {
    this.sessions = new Map();
    this.initialized = false;
  }

  /**
   * Initialize the session manager
   * Loads existing sessions from disk
   */
  async init() {
    if (this.initialized) return;

    try {
      // Ensure directory exists
      await fs.mkdir(APEX_DIR, { recursive: true });

      // Try to load existing sessions
      try {
        const data = await fs.readFile(SESSIONS_FILE, "utf-8");
        const parsed = JSON.parse(data);
        
        for (const [key, value] of Object.entries(parsed)) {
          this.sessions.set(key, value);
        }
      } catch {
        // No existing sessions file, start fresh
      }

      this.initialized = true;
    } catch (error) {
      console.error("Failed to initialize session manager:", error.message);
    }
  }

  /**
   * Save a session to disk
   */
  async saveSession(sessionId, state) {
    await this.init();

    const sessionData = {
      ...state,
      updatedAt: new Date().toISOString(),
    };

    this.sessions.set(sessionId, sessionData);
    await this._persist();
  }

  /**
   * Load a session from disk
   */
  async loadSession(sessionId) {
    await this.init();
    return this.sessions.get(sessionId) || null;
  }

  /**
   * List all sessions
   */
  async listSessions() {
    await this.init();
    
    return Array.from(this.sessions.entries()).map(([id, data]) => ({
      id,
      createdAt: data.metadata?.startTime,
      updatedAt: data.updatedAt,
      messageCount: data.messages?.length || 0,
    }));
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId) {
    await this.init();
    this.sessions.delete(sessionId);
    await this._persist();
  }

  /**
   * Clear all sessions
   */
  async clearAllSessions() {
    await this.init();
    this.sessions.clear();
    await this._persist();
  }

  /**
   * Persist sessions to disk
   */
  async _persist() {
    const data = Object.fromEntries(this.sessions);
    await fs.writeFile(SESSIONS_FILE, JSON.stringify(data, null, 2), "utf-8");
  }
}

// Singleton instance
export const sessionManager = new SessionManager();

export default memoryCheckpointer;
