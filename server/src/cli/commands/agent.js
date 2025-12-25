/**
 * ============================================================================
 * 📚 LANGGRAPH LEARNING PATH - FILE 11 OF 11 (FINAL!)
 * ============================================================================
 * 
 * 📖 WHAT IS THIS FILE?
 *    This is the CLI COMMAND file - it's the user interface that connects
 *    the user to the entire LangGraph agent system you've built!
 * 
 * 📝 PREREQUISITES: Read ALL previous files (1-10) first
 * 
 * 🎉 CONGRATULATIONS! This is the final file in the learning path!
 * 
 * ============================================================================
 * 
 * 🧠 HOW IT ALL COMES TOGETHER
 * 
 * When a user types: apex agent
 * 
 *   1. This CLI file starts
 *   2. It creates an AgentSession (session.js)
 *   3. AgentSession creates the graph (graph.js)
 *   4. Graph connects all nodes (planner, executor, reflector)
 *   5. User types a message
 *   6. session.chat() invokes the graph
 *   7. Graph runs through Plan → Execute → Reflect
 *   8. Response is shown to user
 *   9. Loop back to step 5!
 * 
 * ============================================================================
 */

import { Command } from "commander";
import readline from "readline";
import chalk from "chalk";

import { AgentSession } from "../../lib/langgraph/session.js";
import { requireAuth } from "./auth/login.js";
import { allTools } from "../../lib/langgraph/tools.js";
import { config } from "../../config/google.config.js";

// ============================================================================
// CLI UTILITIES
// ============================================================================
/**
 * These are helper functions for the CLI user experience.
 * They make the output look nice and professional!
 */

/**
 * Create a spinner animation for loading states.
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
 * Display a section header.
 */
function sectionHeader(title, width = 50) {
  console.log("\n" + chalk.cyan("─".repeat(width)));
  console.log(chalk.bold.cyan(`  ${title}`));
  console.log(chalk.cyan("─".repeat(width)));
}

/**
 * Display key-value pair.
 */
function kvPair(key, value, indent = 0) {
  const padding = " ".repeat(indent);
  console.log(`${padding}${chalk.gray(key + ":")} ${chalk.white(value)}`);
}

/**
 * Format agent response with styling.
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
 * Handle errors with helpful messages.
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

// ============================================================================
// MAIN AGENT ACTION
// ============================================================================
/**
 * The main function that runs when user types: apex agent
 * 
 * This function:
 *   1. Parses command-line options
 *   2. Handles special commands (list, delete sessions)
 *   3. Starts the interactive agent loop
 *   4. Processes user input and shows responses
 */
async function agentAction(options) {
  // ─────────────────────────────────────────────────────────────────────────
  // REQUIRE AUTHENTICATION
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Ensure the user is logged in before using the agent.
   * This is optional but good for tracking usage.
   */
  await requireAuth();

  const verbose = options.verbose || false;
  const mode = options.simple ? "chat" : "agent";

  // ─────────────────────────────────────────────────────────────────────────
  // HANDLE LIST SESSIONS
  // ─────────────────────────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────────────────
  // HANDLE DELETE SESSION
  // ─────────────────────────────────────────────────────────────────────────
  if (options.delete) {
    const deleted = await AgentSession.deleteSession(options.delete);
    if (deleted) {
      console.log(chalk.green(`\n✅ Deleted session: ${options.delete}\n`));
    } else {
      console.log(chalk.red(`\n❌ Could not delete session: ${options.delete}\n`));
    }
    return;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // START INTERACTIVE AGENT
  // ─────────────────────────────────────────────────────────────────────────
  const modeLabel = mode === "agent" ? "Full Agent (Plan→Execute→Reflect)" : "Simple Chat";
  sectionHeader(`🤖 Apex Agent - ${modeLabel}`);

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

  // ─────────────────────────────────────────────────────────────────────────
  // INITIALIZE SESSION
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Create a new session or resume an existing one.
   * The session handles all LangGraph complexity!
   */
  let session;
  try {
    session = new AgentSession(options.session, mode);
  } catch (error) {
    console.error(chalk.red(`\n❌ Failed to initialize session: ${error.message}\n`));
    return;
  }

  const sessionInfo = session.getSessionInfo();
  kvPair("Session", sessionInfo.sessionId);
  kvPair("Mode", sessionInfo.mode);
  kvPair("Storage", sessionInfo.sessionsDir);
  if (verbose) {
    kvPair("Max iterations", config.maxIterations.toString());
  }
  console.log();

  // ─────────────────────────────────────────────────────────────────────────
  // CREATE READLINE INTERFACE
  // ─────────────────────────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────────────────
  // MAIN QUESTION LOOP
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * This is the main interactive loop:
   *   1. Show prompt
   *   2. Get user input
   *   3. Handle commands OR send to agent
   *   4. Show response
   *   5. Repeat
   */
  const askQuestion = () => {
    rl.question(chalk.green("\n👤 You: "), async (input) => {
      const trimmed = input.trim();

      // Handle built-in commands
      if (trimmed.toLowerCase() === "exit") {
        console.log(chalk.cyan("\n👋 Goodbye! Session saved.\n"));
        rl.close();
        return;
      }

      if (trimmed.toLowerCase() === "clear") {
        try {
          session = new AgentSession(null, mode);
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
        kvPair("  Mode", info.mode, 0);
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

      // ─────────────────────────────────────────────────────────────────────
      // PROCESS USER MESSAGE
      // ─────────────────────────────────────────────────────────────────────
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
          if (result.plan) {
            console.log(chalk.gray(`   📋 Plan: ${result.plan.steps?.length || 0} steps`));
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

  // Start the loop!
  askQuestion();
}

// ============================================================================
// COMMANDER SETUP
// ============================================================================
/**
 * Commander.js is used to define CLI commands and options.
 * This exports the 'agent' command that gets added to the main CLI.
 */
export const agent = new Command("agent")
  .description("Full AI agent with tools, memory, and human-in-the-loop")
  .option("-s, --session <id>", "Resume a specific session")
  .option("-l, --list", "List all saved sessions")
  .option("-d, --delete <id>", "Delete a saved session")
  .option("-v, --verbose", "Show detailed execution logs")
  .option("--simple", "Use simple chat mode instead of full agent")
  .action(agentAction);

// ============================================================================
// 🎉 CONGRATULATIONS!
// ============================================================================
/**
 * You've completed the entire LangGraph learning path!
 * 
 * Here's what you've learned:
 * 
 *   1.  state.js      - How to define state with annotations
 *   2.  config.js     - How to configure the agent and prompts
 *   3.  llm.js        - How to set up LLMs with tools
 *   4.  tools.js      - How to define tools the agent can use
 *   5.  planner.js    - How the Planner breaks tasks into steps
 *   6.  executor.js   - How the Executor runs each step
 *   7.  reflector.js  - How the Reflector evaluates and decides
 *   8.  nodes.js      - How all nodes work together
 *   9.  graph.js      - How to build and compile graphs
 *   10. session.js    - How to manage sessions and persistence
 *   11. agent.js      - How to create the CLI interface (THIS FILE!)
 * 
 * To use your agent:
 *   apex agent              # Full agent with planning
 *   apex agent --simple     # Simple chat mode
 *   apex agent --list       # List sessions
 *   apex agent -v           # Verbose mode
 * 
 * Happy coding! 🚀
 */
