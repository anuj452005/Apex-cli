
import { Command } from "commander";
import readline from "readline";
import chalk from "chalk";

import { AgentSession } from "../../lib/langgraph/session.js";
import { requireAuth } from "./auth/login.js";
import { config } from "../../config/google.config.js";

async function chatAction(options) {

  await requireAuth();

  console.log(chalk.cyan("\n═══════════════════════════════════"));
  console.log(chalk.bold.cyan("  💬 Apex Chat"));
  console.log(chalk.cyan("═══════════════════════════════════\n"));
  console.log(chalk.gray("Simple chat with AI. Type 'exit' to quit.\n"));

  let session;
  try {
    session = new AgentSession(options.session, "chat");
  } catch (error) {
    console.error(chalk.red(`\n❌ Failed to initialize: ${error.message}\n`));
    return;
  }

  console.log(chalk.gray(`Session: ${session.getSessionInfo().sessionId}\n`));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let isProcessing = false;

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
