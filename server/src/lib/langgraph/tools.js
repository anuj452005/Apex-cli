/**
 * LangGraph Tools Definition (Production-Grade)
 *
 * Defines safe and dangerous tools for the agent.
 * Dangerous tools require human approval before execution.
 *
 * Tool Categories:
 * - Safe: calculator, get_weather, read_file, list_directory, web_search, get_current_time
 * - Dangerous: write_file, shell_command, delete_file, http_request
 */

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { config } from "../../config/google.config.js";

// ============================================================
// SAFE TOOLS (No approval needed)
// ============================================================

/**
 * Calculator tool - evaluates mathematical expressions
 */
export const calculatorTool = new DynamicStructuredTool({
  name: "calculator",
  description:
    "Perform mathematical calculations. Supports basic arithmetic (+, -, *, /), exponents (**), parentheses, and common math functions (Math.sqrt, Math.sin, Math.cos, Math.log, etc.). Examples: '25 * 4 + 10', 'Math.sqrt(144)', '(5 + 3) ** 2'.",
  schema: z.object({
    expression: z
      .string()
      .describe("Mathematical expression to evaluate (e.g., '25 * 4 + 10', 'Math.sqrt(144)')"),
  }),
  func: async ({ expression }) => {
    try {
      // Validate expression to prevent code injection
      const sanitized = expression.replace(/[^0-9+\-*/().Math\s,a-z]/gi, "");
      if (sanitized !== expression) {
        return "Error: Expression contains invalid characters. Only numbers, operators, parentheses, and Math functions are allowed.";
      }

      // Safe evaluation using Function constructor
      const calculate = new Function(`"use strict"; return (${expression})`);
      const result = calculate();

      if (typeof result !== "number" || !isFinite(result)) {
        return `Invalid result: ${result}`;
      }

      return `Result: ${result}`;
    } catch (error) {
      return `Calculation error: ${error.message}`;
    }
  },
});

/**
 * Weather tool - gets current weather for a location (simulated)
 */
export const weatherTool = new DynamicStructuredTool({
  name: "get_weather",
  description:
    "Get current weather for a location. Returns temperature, conditions, humidity, and wind. Note: This is simulated data for demonstration.",
  schema: z.object({
    location: z.string().describe("City name (e.g., 'Tokyo', 'New York', 'London')"),
  }),
  func: async ({ location }) => {
    // Simulated weather data - in production, use a weather API
    const conditions = ["Sunny", "Cloudy", "Rainy", "Partly Cloudy", "Overcast", "Foggy"];
    const temp = Math.floor(Math.random() * 30) + 5;
    const humidity = Math.floor(Math.random() * 50) + 30;
    const windSpeed = Math.floor(Math.random() * 30) + 5;
    const condition = conditions[Math.floor(Math.random() * conditions.length)];

    return `Weather in ${location}:
• Temperature: ${temp}°C (${Math.round(temp * 9 / 5 + 32)}°F)
• Conditions: ${condition}
• Humidity: ${humidity}%
• Wind: ${windSpeed} km/h

Note: This is simulated data for demonstration purposes.`;
  },
});

/**
 * Read file tool - reads file contents
 */
export const readFileTool = new DynamicStructuredTool({
  name: "read_file",
  description:
    "Read the contents of a file. Automatically truncates large files. Supports text files only.",
  schema: z.object({
    filePath: z.string().describe("Absolute or relative path to the file to read"),
  }),
  func: async ({ filePath }) => {
    try {
      const absolutePath = path.resolve(filePath);

      // Check file exists
      const stats = await fs.stat(absolutePath);
      if (!stats.isFile()) {
        return `Error: ${absolutePath} is not a file`;
      }

      // Read file content
      const content = await fs.readFile(absolutePath, "utf-8");

      // Truncate if too long
      const maxLength = 3000;
      const truncated =
        content.length > maxLength
          ? content.slice(0, maxLength) + `\n\n... [truncated, showing ${maxLength}/${content.length} characters]`
          : content;

      return `📄 File: ${absolutePath} (${stats.size} bytes)\n${"─".repeat(40)}\n${truncated}`;
    } catch (error) {
      if (error.code === "ENOENT") {
        return `Error: File not found: ${filePath}`;
      }
      return `Error reading file: ${error.message}`;
    }
  },
});

/**
 * List directory tool - lists files and folders
 */
export const listDirTool = new DynamicStructuredTool({
  name: "list_directory",
  description: "List all files and folders in a directory with their sizes and types.",
  schema: z.object({
    dirPath: z.string().describe("Path to the directory to list"),
    showHidden: z.boolean().optional().describe("Include hidden files (starting with .)"),
  }),
  func: async ({ dirPath, showHidden = false }) => {
    try {
      const absolutePath = path.resolve(dirPath);
      const entries = await fs.readdir(absolutePath, { withFileTypes: true });

      // Filter hidden files if needed
      const filtered = showHidden ? entries : entries.filter((e) => !e.name.startsWith("."));

      // Sort: directories first, then files
      filtered.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });

      // Format entries
      const formatted = await Promise.all(
        filtered.map(async (entry) => {
          const entryPath = path.join(absolutePath, entry.name);
          const icon = entry.isDirectory() ? "📁" : "📄";

          let size = "";
          if (entry.isFile()) {
            try {
              const stats = await fs.stat(entryPath);
              size = formatSize(stats.size);
            } catch {
              size = "?";
            }
          }

          return `${icon} ${entry.name}${size ? ` (${size})` : ""}`;
        })
      );

      const header = `📂 ${absolutePath}`;
      const count = `${filtered.length} items (${filtered.filter((e) => e.isDirectory()).length} folders, ${filtered.filter((e) => e.isFile()).length} files)`;

      return `${header}\n${"─".repeat(40)}\n${formatted.join("\n")}\n\n${count}`;
    } catch (error) {
      if (error.code === "ENOENT") {
        return `Error: Directory not found: ${dirPath}`;
      }
      return `Error listing directory: ${error.message}`;
    }
  },
});

/**
 * Get current time tool - returns current date and time
 */
export const getCurrentTimeTool = new DynamicStructuredTool({
  name: "get_current_time",
  description:
    "Get the current date and time. Optionally specify a timezone. Returns formatted date, time, and timezone info.",
  schema: z.object({
    timezone: z
      .string()
      .optional()
      .describe("Timezone (e.g., 'America/New_York', 'Asia/Tokyo', 'UTC'). Defaults to local timezone."),
  }),
  func: async ({ timezone }) => {
    try {
      const now = new Date();
      const options = {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
        timeZoneName: "short",
      };

      if (timezone) {
        options.timeZone = timezone;
      }

      const formatted = now.toLocaleString("en-US", options);
      const isoString = now.toISOString();

      return `🕐 Current Time:
• Formatted: ${formatted}
• ISO 8601: ${isoString}
• Unix timestamp: ${Math.floor(now.getTime() / 1000)}`;
    } catch (error) {
      return `Error getting time: ${error.message}`;
    }
  },
});

/**
 * Web search tool - simulated web search
 */
export const webSearchTool = new DynamicStructuredTool({
  name: "web_search",
  description:
    "Search the web for information. Returns relevant search results with titles and snippets. Note: This is simulated for demonstration - in production, integrate with a search API.",
  schema: z.object({
    query: z.string().describe("Search query"),
    numResults: z.number().optional().describe("Number of results to return (default: 3, max: 5)"),
  }),
  func: async ({ query, numResults = 3 }) => {
    // Simulated search results - in production, use SerpAPI, Brave Search API, etc.
    const mockResults = [
      {
        title: `${query} - Wikipedia`,
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(query)}`,
        snippet: `Comprehensive information about ${query}. This article provides an overview of the topic including history, applications, and related concepts.`,
      },
      {
        title: `Understanding ${query} - Expert Guide`,
        url: `https://example.com/guide/${encodeURIComponent(query)}`,
        snippet: `An in-depth guide to ${query} for beginners and experts alike. Learn the fundamentals and advanced techniques.`,
      },
      {
        title: `${query} - Latest News and Updates`,
        url: `https://news.example.com/${encodeURIComponent(query)}`,
        snippet: `Stay updated with the latest news about ${query}. Breaking developments and expert analysis.`,
      },
      {
        title: `How to Use ${query} - Tutorial`,
        url: `https://tutorials.example.com/${encodeURIComponent(query)}`,
        snippet: `Step-by-step tutorial on ${query}. Practical examples and real-world applications.`,
      },
      {
        title: `${query} Best Practices`,
        url: `https://bestpractices.example.com/${encodeURIComponent(query)}`,
        snippet: `Industry best practices for ${query}. Tips from professionals and common pitfalls to avoid.`,
      },
    ];

    const results = mockResults.slice(0, Math.min(numResults, 5));

    const formatted = results
      .map(
        (r, i) => `${i + 1}. ${r.title}
   ${r.url}
   ${r.snippet}`
      )
      .join("\n\n");

    return `🔍 Search results for "${query}":\n\n${formatted}\n\nNote: These are simulated results for demonstration.`;
  },
});

// ============================================================
// DANGEROUS TOOLS (Require approval)
// ============================================================

/**
 * Write file tool - DANGEROUS
 */
export const writeFileTool = new DynamicStructuredTool({
  name: "write_file",
  description:
    "Write content to a file (REQUIRES APPROVAL). Creates the file if it doesn't exist. Creates parent directories if needed. WARNING: This will overwrite existing files.",
  schema: z.object({
    filePath: z.string().describe("Path to the file to write"),
    content: z.string().describe("Content to write to the file"),
    append: z.boolean().optional().describe("If true, append to file instead of overwriting"),
  }),
  func: async ({ filePath, content, append = false }) => {
    try {
      const absolutePath = path.resolve(filePath);

      // Ensure directory exists
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });

      // Write or append
      if (append) {
        await fs.appendFile(absolutePath, content, "utf-8");
        return `✅ Appended ${content.length} characters to ${absolutePath}`;
      } else {
        await fs.writeFile(absolutePath, content, "utf-8");
        return `✅ Wrote ${content.length} characters to ${absolutePath}`;
      }
    } catch (error) {
      return `Error writing file: ${error.message}`;
    }
  },
});

/**
 * Shell command tool - DANGEROUS
 */
export const shellTool = new DynamicStructuredTool({
  name: "shell_command",
  description:
    "Execute a shell command (REQUIRES APPROVAL). Use carefully - commands run with your user permissions. Timeout: 30 seconds.",
  schema: z.object({
    command: z.string().describe("Shell command to execute"),
    cwd: z.string().optional().describe("Working directory for the command"),
  }),
  func: async ({ command, cwd }) => {
    const { exec } = await import("child_process");
    return new Promise((resolve) => {
      const options = {
        timeout: 30000,
        maxBuffer: 1024 * 1024,
      };
      if (cwd) {
        options.cwd = path.resolve(cwd);
      }

      exec(command, options, (error, stdout, stderr) => {
        if (error) {
          if (error.killed) {
            resolve(`⏱️ Command timed out after 30 seconds`);
          } else {
            resolve(`❌ Error: ${error.message}\n${stderr || ""}`);
          }
        } else {
          const output = stdout || stderr || "(no output)";
          // Truncate long output
          const truncated =
            output.length > 2000
              ? output.slice(0, 2000) + `\n... [truncated, ${output.length} total characters]`
              : output;
          resolve(`✅ Command executed:\n${truncated}`);
        }
      });
    });
  },
});

/**
 * Delete file tool - DANGEROUS
 */
export const deleteFileTool = new DynamicStructuredTool({
  name: "delete_file",
  description:
    "Delete a file or directory (REQUIRES APPROVAL). Use with extreme caution. For directories, use recursive option.",
  schema: z.object({
    filePath: z.string().describe("Path to the file or directory to delete"),
    recursive: z.boolean().optional().describe("If true and target is directory, delete recursively"),
  }),
  func: async ({ filePath, recursive = false }) => {
    try {
      const absolutePath = path.resolve(filePath);

      const stats = await fs.stat(absolutePath);

      if (stats.isDirectory()) {
        if (!recursive) {
          return `Error: ${absolutePath} is a directory. Use recursive: true to delete directories.`;
        }
        await fs.rm(absolutePath, { recursive: true });
        return `✅ Deleted directory: ${absolutePath}`;
      } else {
        await fs.unlink(absolutePath);
        return `✅ Deleted file: ${absolutePath}`;
      }
    } catch (error) {
      if (error.code === "ENOENT") {
        return `Error: File not found: ${filePath}`;
      }
      return `Error deleting: ${error.message}`;
    }
  },
});

/**
 * HTTP request tool - DANGEROUS
 */
export const httpRequestTool = new DynamicStructuredTool({
  name: "http_request",
  description:
    "Make an HTTP request (REQUIRES APPROVAL). Supports GET and POST methods. Useful for calling APIs or fetching web content.",
  schema: z.object({
    url: z.string().describe("URL to request"),
    method: z.enum(["GET", "POST"]).optional().describe("HTTP method (default: GET)"),
    body: z.string().optional().describe("Request body for POST requests (JSON string)"),
    headers: z.record(z.string()).optional().describe("Additional headers as key-value pairs"),
  }),
  func: async ({ url, method = "GET", body, headers = {} }) => {
    try {
      const options = {
        method,
        headers: {
          "User-Agent": "Apex-CLI-Agent/1.0",
          ...headers,
        },
      };

      if (body && method === "POST") {
        options.body = body;
        if (!headers["Content-Type"]) {
          options.headers["Content-Type"] = "application/json";
        }
      }

      const response = await fetch(url, options);
      const text = await response.text();

      // Truncate long responses
      const truncated =
        text.length > 2000
          ? text.slice(0, 2000) + `\n... [truncated, ${text.length} total characters]`
          : text;

      return `${response.ok ? "✅" : "⚠️"} HTTP ${response.status} ${response.statusText}

Response:
${truncated}`;
    } catch (error) {
      return `❌ HTTP Error: ${error.message}`;
    }
  },
});

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Format file size in human-readable format
 */
function formatSize(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

// ============================================================
// TOOL COLLECTIONS
// ============================================================

export const safeTools = [
  calculatorTool,
  weatherTool,
  readFileTool,
  listDirTool,
  getCurrentTimeTool,
  webSearchTool,
];

export const dangerousTools = [
  writeFileTool,
  shellTool,
  deleteFileTool,
  httpRequestTool,
];

export const allTools = [...safeTools, ...dangerousTools];

/**
 * Get a tool by name
 * @param {string} name - Tool name
 */
export function getToolByName(name) {
  return allTools.find((t) => t.name === name);
}

/**
 * Check if a tool is dangerous
 * @param {string} name - Tool name
 */
export function isDangerousTool(name) {
  return config.dangerousTools.includes(name);
}
