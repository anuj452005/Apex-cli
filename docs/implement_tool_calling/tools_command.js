/**
 * Tools CLI Command
 * 
 * Implements 'apex tools' command for tool-enabled conversations.
 */

import { Command } from "commander";
import { intro, outro, text, isCancel, spinner } from "@clack/prompts";
import chalk from "chalk";
import boxen from "boxen";
import { ToolAgentSession } from "./graph.js";
import { getToolDescriptions } from "./registry.js";
import { requireAuth } from "../commands/auth/login.js";
import { TOOLS_CONFIG } from "./config.js";

function formatResponse(content) {
  return content
    .replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => {
      return chalk.gray(`\n┌─ ${lang || "code"} ─────\n`) +
             chalk.yellow(code.trim()) +
             chalk.gray("\n└─────────────────\n");
    })
    .replace(/`([^`]+)`/g, chalk.yellow("$1"));
}

function showTools() {
  const tools = getToolDescriptions();
  console.log(
    boxen(
      chalk.cyan.bold("🔧 Available Tools\n\n") +
      tools.map(t =>
        chalk.yellow(`${t.name}`) + chalk.gray(` [${t.category}]\n`) +
        chalk.white(`  ${t.description}`)
      ).join("\n\n"),
      { padding: 1, margin: 1, borderStyle: "round", borderColor: "yellow" }
    )
  );
}

function showWelcome() {
  console.log(
    boxen(
      chalk.cyan.bold("🛠️  Apex AI with Tools\n\n") +
      chalk.white("I can execute real actions:\n") +
      chalk.yellow("  📁") + chalk.gray(" Read/write files\n") +
      chalk.yellow("  💻") + chalk.gray(" Execute code\n") +
      chalk.yellow("  🖥️ ") + chalk.gray(" Run shell commands\n\n") +
      chalk.white("Commands:\n") +
      chalk.yellow("  /tools") + chalk.gray(" - Show tools\n") +
      chalk.yellow("  /exit") + chalk.gray(" - Exit\n"),
      { padding: 1, margin: 1, borderStyle: "round", borderColor: "cyan" }
    )
  );
}

async function toolsREPL() {
  const session = new ToolAgentSession();
  showWelcome();

  while (true) {
    const input = await text({
      message: chalk.cyan("❯"),
      placeholder: "Ask me to do something...",
    });

    if (isCancel(input)) {
      outro(chalk.gray("Goodbye! 👋"));
      break;
    }

    const message = input.trim();
    if (!message) continue;

    if (message.startsWith("/")) {
      switch (message.toLowerCase()) {
        case "/exit": outro(chalk.gray("Goodbye! 👋")); return;
        case "/tools": showTools(); continue;
        case "/clear": session.clearHistory(); console.log(chalk.gray("✓ Cleared.\n")); continue;
        default: console.log(chalk.yellow(`Unknown: ${message}\n`)); continue;
      }
    }

    const s = spinner();
    s.start(chalk.gray("Thinking..."));

    try {
      const response = await session.sendMessage(message);
      s.stop();
      if (response) {
        console.log("\n" + chalk.green("🤖 ") + formatResponse(response) + "\n");
      }
    } catch (error) {
      s.stop();
      console.log(chalk.red(`\n❌ Error: ${error.message}\n`));
    }
  }
}

async function toolsAction(options) {
  await requireAuth();
  
  if (!TOOLS_CONFIG.llm.apiKey) {
    console.log(chalk.red("❌ Missing GOOGLE_API_KEY"));
    process.exit(1);
  }

  if (options.list) { showTools(); return; }

  intro(chalk.bold("🛠️  Starting Apex AI with Tools..."));
  await toolsREPL();
}

export const tools = new Command("tools")
  .alias("t")
  .description("Start AI with tool access")
  .option("-l, --list", "List available tools")
  .action(toolsAction);

export default tools;
