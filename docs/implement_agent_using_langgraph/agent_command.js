/**
 * Agent CLI Command
 * 
 * Implements 'apex agent' command for running autonomous AI agent.
 */

import { Command } from "commander";
import { intro, outro, text, isCancel, spinner, confirm } from "@clack/prompts";
import chalk from "chalk";
import boxen from "boxen";
import { AgentSession } from "./graph.js";
import { requireAuth } from "../commands/auth/login.js";
import { AGENT_CONFIG } from "./config.js";

function showPlan(plan) {
  console.log(
    boxen(
      chalk.cyan.bold("📋 Execution Plan\n\n") +
      plan.subtasks.map((st, i) =>
        `${chalk.yellow(`${i + 1}.`)} ${st.description}\n` +
        chalk.gray(`   Type: ${st.type}`)
      ).join("\n\n"),
      { padding: 1, borderStyle: "round", borderColor: "cyan" }
    )
  );
}

function showProgress(chunk) {
  if (chunk.plan && AGENT_CONFIG.ui.showPlan) {
    console.log(chalk.gray("\n📝 Created plan with " + 
      chunk.plan.plan?.subtasks?.length + " subtasks"));
  }
  if (chunk.execute) {
    console.log(chalk.green("✓ ") + chalk.gray("Executed subtask"));
  }
  if (chunk.reflect) {
    const r = chunk.reflect.reflections;
    if (r && Array.isArray(r) && r.length > 0) {
      const last = r[r.length - 1];
      if (last?.evaluation) {
        console.log(chalk.blue("💭 ") + chalk.gray(`Reflection: ${last.evaluation}`));
      }
    }
  }
}

function showResult(result) {
  if (!result) return;
  
  console.log(
    boxen(
      chalk.green.bold(`✅ ${result.status === "completed" ? "Task Completed" : "Task Partially Completed"}\n\n`) +
      chalk.white(result.summary) + "\n\n" +
      chalk.cyan("Subtasks:\n") +
      (result.subtasks || []).map(st =>
        `  ${st.status === "completed" ? "✓" : "✗"} ${st.description}`
      ).join("\n"),
      { padding: 1, margin: 1, borderStyle: "round", borderColor: "green" }
    )
  );
}

async function agentREPL() {
  console.log(
    boxen(
      chalk.cyan.bold("🤖 Apex Autonomous Agent\n\n") +
      chalk.white("I can execute complex multi-step tasks:\n") +
      chalk.gray("• Create projects from scratch\n") +
      chalk.gray("• Modify existing codebases\n") +
      chalk.gray("• Research and implement features\n\n") +
      chalk.yellow("Type your task or /exit to quit"),
      { padding: 1, margin: 1, borderStyle: "round", borderColor: "cyan" }
    )
  );

  while (true) {
    const input = await text({
      message: chalk.cyan("🤖"),
      placeholder: "Describe your task...",
    });

    if (isCancel(input) || input.toLowerCase() === "/exit") {
      outro(chalk.gray("Goodbye! 👋"));
      break;
    }

    const task = input.trim();
    if (!task) continue;

    // Confirm before starting
    const confirmed = await confirm({
      message: `Start agent for: "${task.slice(0, 50)}..."?`,
      initialValue: true,
    });

    if (!confirmed) continue;

    const s = spinner();
    s.start(chalk.gray("Agent is working..."));

    try {
      const session = new AgentSession();
      const result = await session.run(task, (chunk) => {
        s.message(chalk.gray("Processing..."));
      });

      s.stop();
      showResult(result?.result || result);
    } catch (error) {
      s.stop();
      console.log(chalk.red(`\n❌ Error: ${error.message}\n`));
    }
  }
}

async function agentAction(options) {
  await requireAuth();

  if (!AGENT_CONFIG.llm.apiKey) {
    console.log(chalk.red("❌ Missing GOOGLE_API_KEY"));
    process.exit(1);
  }

  // Single task mode
  if (options.task) {
    const s = spinner();
    s.start(chalk.gray("Agent is working..."));

    try {
      const session = new AgentSession();
      const result = await session.run(options.task);
      s.stop();
      showResult(result?.result || result);
    } catch (error) {
      s.stop();
      console.log(chalk.red(`\n❌ Error: ${error.message}\n`));
    }
    return;
  }

  intro(chalk.bold("🤖 Starting Autonomous Agent..."));
  await agentREPL();
}

export const agent = new Command("agent")
  .alias("a")
  .description("Run autonomous AI agent for complex tasks")
  .option("-t, --task <task>", "Execute a single task")
  .action(agentAction);

export default agent;
