/**
 * Agent Command (Production-Grade)
 *
 * Full agent mode with tool calling and human-in-the-loop.
 * Uses the complete LangGraph agent with memory persistence.
 *
 * Features:
 * - Tool calling with safe/dangerous distinction
 * - Human-in-the-loop for dangerous operations
 * - Session persistence and management
 * - Verbose mode for debugging
 * - Progress visualization
 * - Graceful error handling
 *
 * Usage: apex agent [options]
 *
 * Options:
 *   -s, --session <id>   Resume a specific session
 *   -l, --list           List all saved sessions
 *   -d, --delete <id>    Delete a saved session
 *   -v, --verbose        Show detailed execution logs
 *   --no-tools           Run without tool access
 */

import { Command } from "commander";
import readline from "readline";
import chalk from "chalk";

import { AgentSession } from "../../lib/langgraph/session.js";
import { requireAuth } from "./auth/login.js";
import { allTools } from "../../lib/langgraph/tools.js";
import { config } from "../../config/google.config.js";

// ============================================================
// UTILITIES
// ============================================================

/**
 * Create a spinner animation
 */
function createSpinner(text) {
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let i = 0;
  let interval = null;

  return {
    start: (newText) => {
      const displayText = newText || text;
      interval = setInterval(() => {
        process.stdout.write(`\r${chalk.cyan(frames[i])} ${chalk.gray(displayText)}    `);
        i = (i + 1) % frames.length;
      }, 80);
    },
    update: (newText) => {
      text = newText;
    },
    stop: (finalText) => {
      if (interval) {
        clearInterval(interval);
        if (finalText) {
          process.stdout.write(`\r${finalText}                              \n`);
        } else {
          process.stdout.write(`\r                                           \r`);
        }
      }
    },
  };
}

/**
 * Format tool info for display
 */
function formatToolInfo(tool) {
  const isDangerous = config.dangerousTools.includes(tool.name);
  const icon = isDangerous ? "⚠️" : "🔧";
  const color = isDangerous ? chalk.yellow : chalk.green;
  return `${icon} ${color(tool.name)}`;
}

/**
 * Display a section header
 */
function sectionHeader(title, width = 50) {
  console.log("\n" + chalk.cyan("─".repeat(width)));
  console.log(chalk.bold.cyan(`  ${title}`));
  console.log(chalk.cyan("─".repeat(width)));
}

/**
 * Display key-value pair with consistent formatting
 */
function kvPair(key, value, indent = 0) {
  const padding = " ".repeat(indent);
  console.log(`${padding}${chalk.gray(key + ":")} ${chalk.white(value)}`);
}

// ============================================================
// AGENT ACTION
// ============================================================

async function agentAction(options) {
  // Require authentication
  await requireAuth();

  const verbose = options.verbose || false;

  // Handle list sessions
  if (options.list) {
    const sessions = await AgentSession.listSessions();
    if (sessions.length === 0) {
      console.log(chalk.yellow("\nNo saved sessions found.\n"));
    } else {
      sectionHeader("📁 Saved Sessions");
      sessions.forEach((s, idx) => {
        console.log(chalk.gray(`  ${idx + 1}. `) + chalk.white(s));
      });
      console.log();
    }
    return;
  }

  // Handle delete session
  if (options.delete) {
    const deleted = await AgentSession.deleteSession(options.delete);
    if (deleted) {
      console.log(chalk.green(`\n✅ Deleted session: ${options.delete}\n`));
    } else {
      console.log(chalk.red(`\n❌ Could not delete session: ${options.delete}\n`));
    }
    return;
  }

  // ==== Start Interactive Agent ====
  sectionHeader("🤖 Apex Agent");

  console.log(chalk.gray("\nAn AI agent with tool access and human-in-the-loop.\n"));

  // Display available tools
  const safeToolNames = allTools
    .filter((t) => !config.dangerousTools.includes(t.name))
    .map((t) => t.name);
  const dangerousToolNames = allTools
    .filter((t) => config.dangerousTools.includes(t.name))
    .map((t) => t.name);

  console.log(chalk.green("✓ Safe tools:"));
  console.log(chalk.gray(`  ${safeToolNames.join(", ")}`));
  console.log();
  console.log(chalk.yellow("⚠ Dangerous tools (need approval):"));
  console.log(chalk.gray(`  ${dangerousToolNames.join(", ")}`));
  console.log();
  console.log(chalk.gray("Commands:"));
  console.log(chalk.gray("  • 'exit'   - Quit the agent"));
  console.log(chalk.gray("  • 'clear'  - Reset session"));
  console.log(chalk.gray("  • 'help'   - Show help"));
  console.log(chalk.gray("  • 'status' - Show session info"));
  console.log();

  // Initialize session
  let session;
  try {
    session = new AgentSession(options.session);
  } catch (error) {
    console.error(chalk.red(`\n❌ Failed to initialize session: ${error.message}\n`));
    return;
  }

  const sessionInfo = session.getSessionInfo();
  kvPair("Session", sessionInfo.sessionId);
  kvPair("Storage", sessionInfo.sessionsDir);
  if (verbose) {
    kvPair("Mode", "verbose");
    kvPair("Max iterations", config.maxIterations);
  }
  console.log();

  // Create readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let isProcessing = false;
  let shouldCancel = false;

  // Handle Ctrl+C gracefully
  process.on("SIGINT", () => {
    if (isProcessing) {
      shouldCancel = true;
      console.log(chalk.yellow("\n\n⚠️ Cancelling current request..."));
    } else {
      console.log(chalk.cyan("\n\n👋 Goodbye! Session saved.\n"));
      process.exit(0);
    }
  });

  rl.on("close", () => {
    console.log(chalk.cyan("\n\n👋 Goodbye! Session saved.\n"));
    process.exit(0);
  });

  /**
   * Main question loop
   */
  const askQuestion = () => {
    rl.question(chalk.green("\n👤 You: "), async (input) => {
      const trimmed = input.trim();

      // Handle commands
      if (trimmed.toLowerCase() === "exit") {
        console.log(chalk.cyan("\n👋 Goodbye! Session saved.\n"));
        rl.close();
        return;
      }

      if (trimmed.toLowerCase() === "clear") {
        try {
          session = new AgentSession();
          console.log(chalk.yellow("\n🔄 Session cleared. Starting fresh."));
          console.log(chalk.gray(`   New session: ${session.getSessionInfo().sessionId}`));
        } catch (error) {
          console.log(chalk.red(`\n❌ Failed to create new session: ${error.message}`));
        }
        askQuestion();
        return;
      }

      if (trimmed.toLowerCase() === "help") {
        console.log(chalk.cyan("\n📖 Available Commands:"));
        console.log(chalk.gray("   • exit     - End the session"));
        console.log(chalk.gray("   • clear    - Reset and start new session"));
        console.log(chalk.gray("   • status   - Show session info"));
        console.log(chalk.gray("   • help     - Show this help"));
        console.log();
        console.log(chalk.cyan("🔧 Available Tools:"));
        allTools.forEach((tool) => {
          const icon = config.dangerousTools.includes(tool.name) ? "⚠️" : "✓";
          const color = config.dangerousTools.includes(tool.name) ? chalk.yellow : chalk.green;
          console.log(`   ${icon} ${color(tool.name)} - ${chalk.gray(tool.description)}`);
        });
        askQuestion();
        return;
      }

      if (trimmed.toLowerCase() === "status") {
        const info = session.getSessionInfo();
        console.log(chalk.cyan("\n📊 Session Status:"));
        kvPair("  Session ID", info.sessionId, 0);
        kvPair("  Storage", info.sessionsDir, 0);
        kvPair("  Model", config.model, 0);
        kvPair("  Max iterations", config.maxIterations.toString(), 0);
        askQuestion();
        return;
      }

      if (!trimmed) {
        askQuestion();
        return;
      }

      // Process user message
      isProcessing = true;
      shouldCancel = false;

      const spinner = createSpinner("Thinking...");
      spinner.start();

      try {
        // Invoke the agent
        const startTime = Date.now();
        const result = await session.chat(trimmed);
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);

        spinner.stop();

        // Display response
        console.log(chalk.cyan("\n🤖 Agent:"));
        console.log(formatAgentResponse(result.response));

        // Show metadata in verbose mode or if there were multiple iterations
        if (verbose || result.iterations > 1) {
          console.log();
          if (result.iterations) {
            console.log(chalk.gray(`   📊 Iterations: ${result.iterations}`));
          }
          console.log(chalk.gray(`   ⏱️  Duration: ${duration}s`));
        }

        if (result.error) {
          console.log(chalk.yellow(`\n   ⚠️ Note: ${result.error}`));
        }

      } catch (error) {
        spinner.stop();
        handleError(error, verbose);
      }

      isProcessing = false;
      askQuestion();
    });
  };

  askQuestion();
}

/**
 * Format agent response with styling
 */
function formatAgentResponse(content) {
  if (!content) return chalk.gray("(No response)");

  let formatted = content;

  // Style inline code
  formatted = formatted.replace(/`([^`]+)`/g, (_, code) => chalk.yellow(code));

  // Style bold
  formatted = formatted.replace(/\*\*([^*]+)\*\*/g, (_, text) => chalk.bold(text));

  // Indent each line
  return formatted
    .split("\n")
    .map((line) => "  " + line)
    .join("\n");
}

/**
 * Handle errors with helpful messages
 */
function handleError(error, verbose) {
  console.error(chalk.red(`\n❌ Error: ${error.message}`));

  if (verbose) {
    console.error(chalk.gray(`   Stack: ${error.stack?.split("\n")[1] || "N/A"}`));
  }

  // Provide helpful suggestions based on error type
  if (error.message.includes("API") || error.message.includes("key")) {
    console.log(chalk.gray("\n   💡 Fix: Run 'apex config set GOOGLE_API_KEY <your-key>'"));
  } else if (error.message.includes("rate") || error.message.includes("429")) {
    console.log(chalk.yellow("\n   💡 Rate limited. Wait a moment and try again."));
  } else if (error.message.includes("network") || error.message.includes("ECONNREFUSED")) {
    console.log(chalk.yellow("\n   💡 Network error. Check your internet connection."));
  } else if (error.message.includes("timeout")) {
    console.log(chalk.yellow("\n   💡 Request timed out. Try a simpler query."));
  }
}

// ============================================================
// COMMANDER SETUP
// ============================================================

export const agent = new Command("agent")
  .description("Full AI agent with tools, memory, and human-in-the-loop")
  .option("-s, --session <id>", "Resume a specific session")
  .option("-l, --list", "List all saved sessions")
  .option("-d, --delete <id>", "Delete a saved session")
  .option("-v, --verbose", "Show detailed execution logs")
  .action(agentAction);
