/**
 * ============================================================================
 * CHAT COMMAND
 * ============================================================================
 * 
 * Simple chat mode - uses the simple chat graph (no planning).
 * This is a lighter weight alternative to the full agent.
 * 
 * Usage: apex chat
 */

import { Command } from "commander";
import readline from "readline";
import chalk from "chalk";

import { AgentSession } from "../../lib/langgraph/session.js";
import { requireAuth } from "./auth/login.js";
import { config } from "../../config/google.config.js";

/**
 * Main chat action
 */
async function chatAction(options) {
  // Require authentication
  await requireAuth();

  console.log(chalk.cyan("\n═══════════════════════════════════"));
  console.log(chalk.bold.cyan("  💬 Apex Chat"));
  console.log(chalk.cyan("═══════════════════════════════════\n"));
  console.log(chalk.gray("Simple chat with AI. Type 'exit' to quit.\n"));

  // Initialize session in chat mode
  let session;
  try {
    session = new AgentSession(options.session, "chat");
  } catch (error) {
    console.error(chalk.red(`\n❌ Failed to initialize: ${error.message}\n`));
    return;
  }

  console.log(chalk.gray(`Session: ${session.getSessionInfo().sessionId}\n`));

  // Create readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let isProcessing = false;

  // Handle Ctrl+C
  process.on("SIGINT", () => {
    if (!isProcessing) {
      console.log(chalk.cyan("\n\n👋 Goodbye!\n"));
      process.exit(0);
    }
  });

  rl.on("close", () => {
    console.log(chalk.cyan("\n\n👋 Goodbye!\n"));
    process.exit(0);
  });

  // Question loop
  const askQuestion = () => {
    rl.question(chalk.green("You: "), async (input) => {
      const trimmed = input.trim();

      if (trimmed.toLowerCase() === "exit") {
        console.log(chalk.cyan("\n👋 Goodbye!\n"));
        rl.close();
        return;
      }

      if (!trimmed) {
        askQuestion();
        return;
      }

      isProcessing = true;
      console.log(chalk.gray("\nThinking..."));

      try {
        const result = await session.chat(trimmed);
        console.log(chalk.cyan("\nAI: ") + result.response + "\n");
      } catch (error) {
        console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
      }

      isProcessing = false;
      askQuestion();
    });
  };

  askQuestion();
}

export const chat = new Command("chat")
  .description("Chat with AI (simple mode, no planning)")
  .option("-s, --session <id>", "Resume a specific session")
  .action(chatAction);
