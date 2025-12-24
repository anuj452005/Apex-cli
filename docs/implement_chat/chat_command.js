/**
 * Chat CLI Command
 * 
 * Implements the 'apex chat' command using LangGraph.
 * Provides an interactive REPL interface for conversations.
 */

import { Command } from "commander";
import { intro, outro, text, isCancel, spinner } from "@clack/prompts";
import chalk from "chalk";
import boxen from "boxen";
import { ChatSession, quickChat } from "./graph.js"; // Update path when moving to actual location
import { requireAuth, getStoredToken } from "../commands/auth/login.js"; // Update path
import { CHAT_CONFIG } from "./config.js";
import prisma from "../../lib/db.js"; // Update path

/**
 * Format AI response for terminal display
 */
function formatResponse(content) {
  // Handle code blocks
  const formatted = content
    // Highlight code blocks
    .replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => {
      const language = lang || "code";
      return chalk.gray(`\n┌─ ${language} ─────────────────────\n`) +
             chalk.yellow(code.trim()) +
             chalk.gray("\n└─────────────────────────────────\n");
    })
    // Highlight inline code
    .replace(/`([^`]+)`/g, chalk.yellow("$1"))
    // Highlight bold text
    .replace(/\*\*([^*]+)\*\*/g, chalk.bold("$1"))
    // Highlight headers
    .replace(/^### (.+)$/gm, chalk.cyan.bold("   $1"))
    .replace(/^## (.+)$/gm, chalk.cyan.bold("  $1"))
    .replace(/^# (.+)$/gm, chalk.cyan.bold(" $1"));

  return formatted;
}

/**
 * Display welcome message
 */
function showWelcome(userName) {
  console.log(
    boxen(
      chalk.cyan.bold("🤖 Apex AI Chat\n\n") +
        chalk.gray(`Welcome, ${userName || "User"}!\n\n`) +
        chalk.white("Commands:\n") +
        chalk.yellow("  /clear") + chalk.gray(" - Clear conversation history\n") +
        chalk.yellow("  /history") + chalk.gray(" - Show conversation history\n") +
        chalk.yellow("  /exit") + chalk.gray(" - Exit chat\n"),
      {
        padding: 1,
        margin: 1,
        borderStyle: "round",
        borderColor: "cyan",
      }
    )
  );
}

/**
 * Interactive chat REPL
 */
async function chatREPL(user) {
  const session = new ChatSession(user);
  await session.init();

  showWelcome(user?.name);

  while (true) {
    // Get user input
    const input = await text({
      message: chalk.cyan(CHAT_CONFIG.ui.promptSymbol),
      placeholder: "Type your message...",
    });

    // Handle cancellation (Ctrl+C)
    if (isCancel(input)) {
      outro(chalk.gray("Goodbye! 👋"));
      break;
    }

    const message = input.trim();

    // Handle empty input
    if (!message) {
      continue;
    }

    // Handle commands
    if (message.startsWith("/")) {
      const command = message.toLowerCase();

      switch (command) {
        case "/exit":
        case "/quit":
          outro(chalk.gray("Goodbye! 👋"));
          return;

        case "/clear":
          await session.clearHistory();
          console.log(chalk.gray("✓ Conversation cleared.\n"));
          continue;

        case "/history":
          const history = session.getHistory();
          if (history.length === 0) {
            console.log(chalk.gray("No conversation history.\n"));
          } else {
            console.log(chalk.cyan.bold("\n📜 Conversation History:\n"));
            history.forEach((msg, i) => {
              const type = msg._getType?.() || msg.constructor.name;
              const prefix = type === "human" || type === "HumanMessage" 
                ? chalk.cyan("You: ") 
                : chalk.green("AI: ");
              console.log(prefix + chalk.gray(msg.content.slice(0, 100) + "..."));
            });
            console.log();
          }
          continue;

        case "/help":
          showWelcome(user?.name);
          continue;

        default:
          console.log(chalk.yellow(`Unknown command: ${command}\n`));
          continue;
      }
    }

    // Process message with spinner
    const s = spinner();
    s.start(chalk.gray(CHAT_CONFIG.ui.thinkingMessage));

    try {
      const response = await session.sendMessage(message);
      s.stop();

      if (response) {
        console.log();
        console.log(chalk.green("🤖 ") + formatResponse(response));
        console.log();
      }
    } catch (error) {
      s.stop();
      console.log(chalk.red(`\n❌ Error: ${error.message}\n`));
    }
  }
}

/**
 * Single message mode (non-interactive)
 */
async function singleMessage(message, user) {
  const s = spinner();
  s.start(chalk.gray(CHAT_CONFIG.ui.thinkingMessage));

  try {
    const response = await quickChat(message, user);
    s.stop();

    if (response) {
      console.log();
      console.log(formatResponse(response));
      console.log();
    }
  } catch (error) {
    s.stop();
    console.log(chalk.red(`\n❌ Error: ${error.message}\n`));
    process.exit(1);
  }
}

/**
 * Chat command action
 */
async function chatAction(options) {
  // Require authentication
  const token = await requireAuth();

  // Get user info
  let user = null;
  try {
    user = await prisma.user.findFirst({
      where: {
        sessions: {
          some: {
            token: token.access_token,
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });
  } catch {
    // Continue without user info
  }

  // Check for single message mode
  if (options.message) {
    await singleMessage(options.message, user);
    return;
  }

  // Start interactive REPL
  intro(chalk.bold("🤖 Starting Apex AI Chat..."));
  await chatREPL(user);
}

/**
 * Commander command definition
 */
export const chat = new Command("chat")
  .description("Start an AI chat session")
  .option("-m, --message <message>", "Send a single message (non-interactive)")
  .option("-s, --session <id>", "Resume a specific session")
  .action(chatAction);

export default chat;
