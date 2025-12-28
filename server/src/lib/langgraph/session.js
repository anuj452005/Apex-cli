
import { MemorySaver } from "@langchain/langgraph";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import fs from "fs";
import path from "path";
import chalk from "chalk";
import { v4 as uuidv4 } from "uuid";

import { createAgentGraph, buildFullAgentGraph, buildSimpleChatGraph } from "./graph.js";
import { createInitialState } from "./state.js";
import { config } from "../../config/google.config.js";

// Import memory module
import { conversationStore, SlidingWindowManager, ConversationSummarizer } from "./memory/index.js";

export class AgentSession {

  constructor(sessionId = null, mode = "agent") {

    this.sessionId = sessionId || this.generateSessionId();
    this.mode = mode;

    this.sessionsDir = config.sessionsDir;
    this.ensureSessionsDir();

    this.checkpointer = new MemorySaver();

    // Initialize memory managers
    this.slidingWindow = new SlidingWindowManager({
      windowSize: config.memory?.windowSize || 10,
      includeSummary: true
    });
    
    this.summarizer = new ConversationSummarizer({
      threshold: config.memory?.summarizationThreshold || 20,
      keepRecent: config.memory?.windowSize || 10,
      enabled: config.memory?.enableSummarization !== false
    });

    // Track if using database memory
    this.useDatabaseMemory = config.memory?.useDatabase !== false;

    if (mode === "agent") {
      this.graph = buildFullAgentGraph(this.checkpointer);
    } else {
      this.graph = buildSimpleChatGraph(this.checkpointer);
    }

    this.threadConfig = {
      configurable: {
        thread_id: this.sessionId,
      },
    };

    console.log(chalk.gray(`   Session initialized: ${this.sessionId}`));
    if (this.useDatabaseMemory) {
      console.log(chalk.gray(`   📦 Database memory enabled (window: ${config.memory?.windowSize || 10})`));
    }
  }

  async chat(userMessage) {
    console.log(chalk.gray(`\n💬 Processing: "${userMessage.slice(0, 50)}..."`));

    try {
      // Step 1: Load context from database (sliding window + summary)
      let contextSummary = null;
      let previousMessages = [];

      if (this.useDatabaseMemory) {
        const { messages, summary, totalCount } = await this.slidingWindow.getRecentMessages(this.sessionId);
        previousMessages = messages;
        contextSummary = summary;
        
        if (totalCount > 0) {
          console.log(chalk.gray(`   📚 Loaded ${messages.length}/${totalCount} messages from history`));
        }
      }

      // Step 2: Build input with context
      const input = {
        messages: [...previousMessages, new HumanMessage(userMessage)],
        mode: this.mode,
        contextSummary: contextSummary,
        sessionId: this.sessionId
      };

      // Step 3: Invoke the graph
      const result = await this.graph.invoke(input, this.threadConfig);

      const lastMessage = result.messages[result.messages.length - 1];
      const response = lastMessage?.content || "No response";

      // Step 4: Save messages to database
      if (this.useDatabaseMemory) {
        await this.saveMessagesToDatabase(userMessage, result);
      }

      // Step 5: Save session metadata (file-based backup)
      this.saveSession(result);

      // Step 6: Trigger background summarization if needed
      if (this.useDatabaseMemory) {
        this.summarizer.summarizeInBackground(this.sessionId);
      }

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

  /**
   * Save messages to PostgreSQL database
   */
  async saveMessagesToDatabase(userMessage, result) {
    try {
      // Save user message
      await conversationStore.addMessage(this.sessionId, {
        role: 'human',
        content: userMessage
      });

      // Save AI/tool messages from result
      const newMessages = result.messages || [];
      for (const msg of newMessages) {
        const role = this.getMessageRole(msg);
        const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        
        // Skip empty messages
        if (!content || content === '""') continue;

        await conversationStore.addMessage(this.sessionId, {
          role,
          content,
          toolCalls: msg.tool_calls || null,
          toolCallId: msg.tool_call_id || null
        });
      }
    } catch (error) {
      console.error(chalk.yellow(`   ⚠️ Warning: Could not save to database: ${error.message}`));
    }
  }

  /**
   * Get role string from LangChain message
   */
  getMessageRole(message) {
    const type = message._getType?.() || message.constructor?.name || 'unknown';
    const roleMap = {
      'human': 'human',
      'HumanMessage': 'human',
      'ai': 'ai',
      'AIMessage': 'ai',
      'AIMessageChunk': 'ai',
      'system': 'system',
      'SystemMessage': 'system',
      'tool': 'tool',
      'ToolMessage': 'tool'
    };
    return roleMap[type] || 'ai';
  }

  async *stream(userMessage) {
    // Load context for streaming
    let contextSummary = null;
    let previousMessages = [];

    if (this.useDatabaseMemory) {
      const { messages, summary } = await this.slidingWindow.getRecentMessages(this.sessionId);
      previousMessages = messages;
      contextSummary = summary;
    }

    const input = {
      messages: [...previousMessages, new HumanMessage(userMessage)],
      mode: this.mode,
      contextSummary: contextSummary,
      sessionId: this.sessionId
    };

    for await (const event of this.graph.stream(input, {
      ...this.threadConfig,
      streamMode: "values",
    })) {
      yield event;
    }

    // Save after streaming completes
    if (this.useDatabaseMemory) {
      await conversationStore.addMessage(this.sessionId, {
        role: 'human',
        content: userMessage
      });
    }
  }

  generateSessionId() {
    const timestamp = new Date().toISOString().slice(0, 10);
    const uuid = uuidv4().slice(0, 8);
    return `session-${timestamp}-${uuid}`;
  }

  ensureSessionsDir() {
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }
  }

  getSessionFilePath() {
    return path.join(this.sessionsDir, `${this.sessionId}.json`);
  }

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

  getSessionInfo() {
    return {
      sessionId: this.sessionId,
      mode: this.mode,
      sessionsDir: this.sessionsDir,
      useDatabaseMemory: this.useDatabaseMemory,
      memoryConfig: {
        windowSize: config.memory?.windowSize || 10,
        summarizationThreshold: config.memory?.summarizationThreshold || 20,
        enableSummarization: config.memory?.enableSummarization !== false
      }
    };
  }

  /**
   * Get conversation statistics
   */
  async getStats() {
    if (!this.useDatabaseMemory) {
      return { totalMessages: 0, hasSummary: false };
    }

    const totalMessages = await conversationStore.getMessageCount(this.sessionId);
    const summary = await conversationStore.getSummary(this.sessionId);

    return {
      totalMessages,
      hasSummary: !!summary,
      summarizedMessages: summary?.messagesCount || 0
    };
  }

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

  static async deleteSession(sessionId) {
    try {
      // Delete from file system
      const filePath = path.join(config.sessionsDir, `${sessionId}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // Delete from database
      await conversationStore.deleteConversation(sessionId);
      
      console.log(chalk.gray(`   🗑️ Deleted session: ${sessionId}`));
      return true;
    } catch (error) {
      console.error(chalk.red(`Error deleting session: ${error.message}`));
    }
    return false;
  }

  /**
   * List all conversations from database
   */
  static async listConversations(userId = null) {
    return await conversationStore.listConversations(userId);
  }
}

export async function quickChat(message, mode = "agent") {
  const session = new AgentSession(null, mode);
  return session.chat(message);
}
