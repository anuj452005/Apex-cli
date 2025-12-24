/**
 * Tool Registry
 * 
 * Central registry of all available tools.
 * Organizes tools by category and provides lookup functions.
 */

import { fileTools } from "./definitions/file_tools.js";
import { codeTools } from "./definitions/code_tools.js";
import { shellTools } from "./definitions/shell_tools.js";
import { TOOLS_CONFIG } from "./config.js";

/**
 * Tool Categories
 */
export const TOOL_CATEGORIES = {
  FILE: "file",
  CODE: "code",
  SHELL: "shell",
  SEARCH: "search",
};

/**
 * All registered tools organized by category
 */
export const toolRegistry = {
  [TOOL_CATEGORIES.FILE]: fileTools,
  [TOOL_CATEGORIES.CODE]: codeTools,
  [TOOL_CATEGORIES.SHELL]: shellTools,
};

/**
 * Get all tools as a flat array
 */
export function getAllTools() {
  const allTools = [];

  // Add file tools if enabled
  if (TOOLS_CONFIG.fileSystem.enabled) {
    allTools.push(...toolRegistry[TOOL_CATEGORIES.FILE]);
  }

  // Add code tools if enabled
  if (TOOLS_CONFIG.codeExecution.enabled) {
    allTools.push(...toolRegistry[TOOL_CATEGORIES.CODE]);
  }

  // Add shell tools if enabled
  if (TOOLS_CONFIG.shell.enabled) {
    allTools.push(...toolRegistry[TOOL_CATEGORIES.SHELL]);
  }

  return allTools;
}

/**
 * Get tools by category
 */
export function getToolsByCategory(category) {
  return toolRegistry[category] || [];
}

/**
 * Get a specific tool by name
 */
export function getToolByName(name) {
  const allTools = getAllTools();
  return allTools.find(tool => tool.name === name);
}

/**
 * Get tool names only
 */
export function getToolNames() {
  return getAllTools().map(tool => tool.name);
}

/**
 * Get tool descriptions for display
 */
export function getToolDescriptions() {
  return getAllTools().map(tool => ({
    name: tool.name,
    description: tool.description,
    category: Object.entries(toolRegistry).find(
      ([_, tools]) => tools.includes(tool)
    )?.[0] || "unknown",
  }));
}

/**
 * Create a filtered tool set based on permissions
 */
export function createToolSet(options = {}) {
  const {
    includeFile = true,
    includeCode = true,
    includeShell = true,
    customTools = [],
  } = options;

  const tools = [];

  if (includeFile && TOOLS_CONFIG.fileSystem.enabled) {
    tools.push(...toolRegistry[TOOL_CATEGORIES.FILE]);
  }

  if (includeCode && TOOLS_CONFIG.codeExecution.enabled) {
    tools.push(...toolRegistry[TOOL_CATEGORIES.CODE]);
  }

  if (includeShell && TOOLS_CONFIG.shell.enabled) {
    tools.push(...toolRegistry[TOOL_CATEGORIES.SHELL]);
  }

  // Add any custom tools
  tools.push(...customTools);

  return tools;
}

/**
 * Tool usage statistics tracker
 */
export class ToolUsageTracker {
  constructor() {
    this.usage = new Map();
    this.history = [];
  }

  recordUsage(toolName, success, duration) {
    const current = this.usage.get(toolName) || { calls: 0, successes: 0, totalDuration: 0 };

    current.calls++;
    if (success) current.successes++;
    current.totalDuration += duration;

    this.usage.set(toolName, current);

    this.history.push({
      tool: toolName,
      success,
      duration,
      timestamp: new Date().toISOString(),
    });
  }

  getStats() {
    const stats = {};

    for (const [name, data] of this.usage) {
      stats[name] = {
        ...data,
        avgDuration: data.calls > 0 ? data.totalDuration / data.calls : 0,
        successRate: data.calls > 0 ? (data.successes / data.calls) * 100 : 0,
      };
    }

    return stats;
  }

  getHistory(limit = 10) {
    return this.history.slice(-limit);
  }
}

// Singleton tracker instance
export const toolUsageTracker = new ToolUsageTracker();

export default getAllTools;
