/**
 * Shell Command Tools
 * 
 * Tools for executing shell commands with user approval.
 * Implements safety checks and command filtering.
 */

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { spawn, exec } from "child_process";
import { confirm, isCancel } from "@clack/prompts";
import chalk from "chalk";
import { TOOLS_CONFIG, isCommandAllowed } from "../config.js";

/**
 * Request user approval for a command
 */
async function requestApproval(command, reason) {
  console.log();
  console.log(chalk.yellow("⚠️  Shell Command Approval Required"));
  console.log(chalk.gray(`Command: ${chalk.white(command)}`));
  console.log(chalk.gray(`Reason: ${reason}`));
  console.log();

  const approved = await confirm({
    message: "Allow this command to run?",
    initialValue: false,
  });

  if (isCancel(approved)) {
    return false;
  }

  return approved;
}

/**
 * Execute a shell command
 */
function executeShellCommand(command, cwd, timeout) {
  return new Promise((resolve) => {
    const options = {
      cwd: cwd || process.cwd(),
      timeout,
      shell: true,
      maxBuffer: 1024 * 1024, // 1MB buffer
    };

    exec(command, options, (error, stdout, stderr) => {
      if (error) {
        resolve({
          success: false,
          output: stderr || error.message,
          exitCode: error.code,
        });
      } else {
        resolve({
          success: true,
          output: stdout || "(no output)",
          exitCode: 0,
        });
      }
    });
  });
}

/**
 * SHELL COMMAND TOOL
 * Executes shell commands with approval
 */
export const shellCommandTool = new DynamicStructuredTool({
  name: "shell_command",
  description: "Execute a shell command in the terminal. May require user approval for safety.",
  schema: z.object({
    command: z.string().describe("The shell command to execute"),
    reason: z.string().describe("Brief explanation of why this command is needed"),
    workingDirectory: z.string().optional().describe("Directory to run the command in"),
  }),
  func: async ({ command, reason, workingDirectory }) => {
    // Check if shell commands are enabled
    if (!TOOLS_CONFIG.shell.enabled) {
      return "Error: Shell commands are disabled in configuration.";
    }

    // Check if command is in blocked list
    const cmd = command.split(" ")[0].toLowerCase();
    if (TOOLS_CONFIG.shell.blockedCommands.some(blocked => 
      cmd === blocked || cmd.endsWith(`/${blocked}`) || cmd.endsWith(`\\${blocked}`)
    )) {
      return `Error: Command "${cmd}" is blocked for safety reasons.`;
    }

    // Request approval if required
    if (TOOLS_CONFIG.shell.requireApproval) {
      const approved = await requestApproval(command, reason);

      if (!approved) {
        return "Command was rejected by the user.";
      }
    }

    // Execute the command
    console.log(chalk.gray(`\nExecuting: ${command}\n`));

    const result = await executeShellCommand(
      command,
      workingDirectory,
      TOOLS_CONFIG.general.timeoutMs
    );

    // Format output
    let output = result.output;
    if (output.length > 5000) {
      output = output.slice(0, 5000) + "\n... (output truncated)";
    }

    return `${result.success ? "✓ Command succeeded" : "✗ Command failed"} (exit code: ${result.exitCode})\n\nOutput:\n${output}`;
  },
});

/**
 * GET CURRENT DIRECTORY TOOL
 * Returns the current working directory
 */
export const getCurrentDirectoryTool = new DynamicStructuredTool({
  name: "get_current_directory",
  description: "Get the current working directory path.",
  schema: z.object({}),
  func: async () => {
    return `Current directory: ${process.cwd()}`;
  },
});

/**
 * GET ENVIRONMENT VARIABLE TOOL
 * Safely gets environment variables (filtered)
 */
export const getEnvVariableTool = new DynamicStructuredTool({
  name: "get_environment_variable",
  description: "Get the value of an environment variable. Sensitive values are filtered.",
  schema: z.object({
    name: z.string().describe("Name of the environment variable"),
  }),
  func: async ({ name }) => {
    // List of sensitive variable patterns to filter
    const sensitivePatterns = [
      /key/i, /secret/i, /password/i, /token/i, /auth/i,
      /credential/i, /private/i, /api_key/i,
    ];

    // Check if variable name is sensitive
    if (sensitivePatterns.some(pattern => pattern.test(name))) {
      return `Environment variable "${name}" contains sensitive data and cannot be displayed.`;
    }

    const value = process.env[name];

    if (value === undefined) {
      return `Environment variable "${name}" is not set.`;
    }

    return `${name}=${value}`;
  },
});

/**
 * WHICH/WHERE TOOL
 * Find the path of an executable
 */
export const findExecutableTool = new DynamicStructuredTool({
  name: "find_executable",
  description: "Find the path of an executable command (like 'which' on Unix or 'where' on Windows).",
  schema: z.object({
    command: z.string().describe("Name of the command to find"),
  }),
  func: async ({ command }) => {
    const isWindows = process.platform === "win32";
    const whichCommand = isWindows ? `where ${command}` : `which ${command}`;

    const result = await executeShellCommand(whichCommand, null, 5000);

    if (result.success) {
      return `Found "${command}" at:\n${result.output}`;
    } else {
      return `Command "${command}" not found in PATH.`;
    }
  },
});

// Export all shell tools
export const shellTools = [
  shellCommandTool,
  getCurrentDirectoryTool,
  getEnvVariableTool,
  findExecutableTool,
];

export default shellTools;
