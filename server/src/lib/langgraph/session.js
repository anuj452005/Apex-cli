
import { MemorySaver } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import fs from "fs";
import path from "path";
import chalk from "chalk";
import { v4 as uuidv4 } from "uuid";

import { createAgentGraph, buildFullAgentGraph, buildSimpleChatGraph } from "./graph.js";
import { createInitialState } from "./state.js";
import { config } from "../../config/google.config.js";

export class AgentSession {

  constructor(sessionId = null, mode = "agent") {

    this.sessionId = sessionId || this.generateSessionId();
    this.mode = mode;

    this.sessionsDir = config.sessionsDir;
    this.ensureSessionsDir();

    this.checkpointer = new MemorySaver();

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
  }

  async chat(userMessage) {
    console.log(chalk.gray(`\n💬 Processing: "${userMessage.slice(0, 50)}..."`));

    try {

      const input = {
        messages: [new HumanMessage(userMessage)],
        mode: this.mode,
      };

      const result = await this.graph.invoke(input, this.threadConfig);

      const lastMessage = result.messages[result.messages.length - 1];
      const response = lastMessage?.content || "No response";

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

  async *stream(userMessage) {
    const input = {
      messages: [new HumanMessage(userMessage)],
      mode: this.mode,
    };

    for await (const event of this.graph.stream(input, {
      ...this.threadConfig,
      streamMode: "values",
    })) {
      yield event;
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

export async function quickChat(message, mode = "agent") {
  const session = new AgentSession(null, mode);
  return session.chat(message);
}
