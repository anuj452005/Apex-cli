/**
 * Tool Calling Configuration
 * 
 * Defines permissions, safety settings, and tool-specific configurations.
 */

import dotenv from "dotenv";
dotenv.config();

export const TOOLS_CONFIG = {
  // General tool settings
  general: {
    maxToolCalls: 10,           // Max tool calls per conversation turn
    timeoutMs: 30000,           // Tool execution timeout
    retryAttempts: 2,           // Retry failed tool calls
  },

  // File system tool settings
  fileSystem: {
    enabled: true,
    allowedPaths: [
      process.cwd(),            // Current working directory
    ],
    blockedPaths: [
      "/etc",
      "/sys",
      "/proc",
      "C:\\Windows",
      "C:\\Program Files",
    ],
    maxFileSize: 1024 * 1024,   // 1MB max file read
    allowedExtensions: [
      ".js", ".ts", ".jsx", ".tsx",
      ".json", ".md", ".txt", ".yaml", ".yml",
      ".html", ".css", ".py", ".go", ".rs",
    ],
  },

  // Code execution settings
  codeExecution: {
    enabled: true,
    allowedLanguages: ["javascript", "python"],
    timeoutMs: 10000,           // Code execution timeout
    maxOutputLength: 5000,      // Max output characters
  },

  // Shell command settings
  shell: {
    enabled: true,
    requireApproval: true,       // Require user approval for commands
    allowedCommands: [
      "ls", "dir", "cat", "type", "echo", "pwd", "cd",
      "npm", "node", "git", "which", "where",
    ],
    blockedCommands: [
      "rm", "del", "rmdir", "format", "shutdown",
      "reboot", "sudo", "su", "chmod", "chown",
    ],
  },

  // Web search settings
  webSearch: {
    enabled: true,
    provider: "serpapi",         // or "google", "bing", "tavily"
    apiKey: process.env.SERPAPI_KEY || process.env.SEARCH_API_KEY,
    maxResults: 5,
  },

  // Safety settings
  safety: {
    logAllToolCalls: true,
    confirmDestructive: true,    // Confirm destructive operations
    sandboxMode: false,          // Full sandbox mode (very restricted)
  },

  // LLM settings for tool calling
  llm: {
    model: "gemini-2.0-flash",
    temperature: 0.3,            // Lower for more predictable tool use
    apiKey: process.env.GOOGLE_API_KEY,
  },

  // System prompt for tool-using agent
  systemPrompt: `You are Apex AI, a powerful CLI assistant with access to tools.
You can read and write files, execute code, search the web, and run shell commands.

When using tools:
1. Think step-by-step about what tools you need
2. Use the most appropriate tool for each task
3. Handle errors gracefully
4. Report results clearly to the user

Available tool categories:
- File operations: read, write, list, search files
- Code execution: run JavaScript or Python code
- Shell commands: execute terminal commands (may require approval)
- Web search: search the internet for information

Always explain what you're doing before using a tool.`,
};

/**
 * Check if a path is allowed
 */
export function isPathAllowed(filePath) {
  const { allowedPaths, blockedPaths } = TOOLS_CONFIG.fileSystem;

  // Check blocked paths first
  for (const blocked of blockedPaths) {
    if (filePath.toLowerCase().startsWith(blocked.toLowerCase())) {
      return false;
    }
  }

  // Check if within allowed paths
  for (const allowed of allowedPaths) {
    if (filePath.startsWith(allowed)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a command is allowed
 */
export function isCommandAllowed(command) {
  const { allowedCommands, blockedCommands } = TOOLS_CONFIG.shell;
  const cmd = command.split(" ")[0].toLowerCase();

  if (blockedCommands.includes(cmd)) {
    return false;
  }

  return allowedCommands.includes(cmd);
}

export default TOOLS_CONFIG;
