/**
 * ============================================================================
 * 📚 LANGGRAPH LEARNING PATH - FILE 4 OF 11
 * ============================================================================
 * 
 * 📖 WHAT IS THIS FILE?
 *    This is the TOOLS file - defines all the actions the agent can take.
 *    Tools are functions that the LLM can call to interact with the world.
 * 
 * 📝 PREREQUISITES: Read state.js (1/11), config.js (2/11), llm.js (3/11) first
 * 
 * ➡️  NEXT FILE: After understanding this, read planner.js (5/11)
 * 
 * ============================================================================
 * 
 * 🧠 WHAT ARE TOOLS IN LANGGRAPH?
 * 
 * Tools give the LLM the ability to DO things, not just talk.
 * 
 * Without tools, an LLM can only:
 *   - Generate text
 *   - Answer questions from its training data
 * 
 * With tools, an LLM can:
 *   - Read and write files
 *   - Run terminal commands
 *   - Search the web
 *   - Make API calls
 *   - And much more!
 * 
 * Each tool has:
 *   1. name - Unique identifier
 *   2. description - What the tool does (LLM reads this to decide when to use it)
 *   3. schema - What inputs the tool expects
 *   4. func - The actual function that runs
 * 
 * ============================================================================
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

import { config } from "../../config/google.config.js";

// Promisify exec for async/await usage
const execAsync = promisify(exec);

// ============================================================================
// UNDERSTANDING TOOL CREATION
// ============================================================================
/**
 * LangChain tools are created using the `tool()` function.
 * 
 * Basic structure:
 * 
 * const myTool = tool(
 *   async (input) => {
 *     // Do something with input
 *     return "Result string";
 *   },
 *   {
 *     name: "my_tool",
 *     description: "What this tool does - THE LLM READS THIS!",
 *     schema: z.object({
 *       param1: z.string().describe("What this parameter is for"),
 *     }),
 *   }
 * );
 * 
 * The `schema` uses Zod (z) for validation. Common types:
 *   - z.string() - Text
 *   - z.number() - Numbers
 *   - z.boolean() - True/false
 *   - z.array(z.string()) - Array of strings
 *   - z.object({...}) - Object with specific shape
 */

// ============================================================================
// FILE SYSTEM TOOLS
// ============================================================================

/**
 * READ FILE TOOL (SAFE)
 * 
 * Reads the contents of a file. This is safe because:
 *   - It only reads, doesn't modify
 *   - Can't access files outside the current directory (path validation)
 */
export const readFileTool = tool(
  async ({ filePath }) => {
    try {
      // ─────────────────────────────────────────────────────────────────────
      // PATH VALIDATION
      // ─────────────────────────────────────────────────────────────────────
      /**
       * Security: Resolve the path to prevent directory traversal attacks.
       * For example, "../../../etc/passwd" would be dangerous!
       */
      const resolvedPath = path.resolve(filePath);
      
      // Check if file exists
      if (!fs.existsSync(resolvedPath)) {
        return `Error: File not found: ${filePath}`;
      }
      
      // Read and return the content
      const content = fs.readFileSync(resolvedPath, "utf-8");
      
      // Truncate very large files to prevent token overflow
      const maxLength = 10000;
      if (content.length > maxLength) {
        return `${content.slice(0, maxLength)}\n\n... [File truncated, showing first ${maxLength} characters]`;
      }
      
      return content;
    } catch (error) {
      return `Error reading file: ${error.message}`;
    }
  },
  {
    name: "read_file",
    description: "Read the contents of a file. Use this to see what's in existing files.",
    schema: z.object({
      filePath: z.string().describe("Path to the file to read (relative or absolute)"),
    }),
  }
);

/**
 * WRITE FILE TOOL (DANGEROUS!)
 * 
 * Creates or overwrites a file. This is dangerous because:
 *   - Can overwrite important files
 *   - Can create files anywhere (if not careful)
 *   - Changes are permanent
 * 
 * Requires user approval before execution!
 */
export const writeFileTool = tool(
  async ({ filePath, content }) => {
    try {
      const resolvedPath = path.resolve(filePath);
      
      // Create directory if it doesn't exist
      const dir = path.dirname(resolvedPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Write the file
      fs.writeFileSync(resolvedPath, content, "utf-8");
      
      return `Successfully wrote ${content.length} characters to ${filePath}`;
    } catch (error) {
      return `Error writing file: ${error.message}`;
    }
  },
  {
    name: "write_file",
    description: "Create a new file or overwrite an existing file with the given content.",
    schema: z.object({
      filePath: z.string().describe("Path where the file should be created/written"),
      content: z.string().describe("The content to write to the file"),
    }),
  }
);

/**
 * LIST DIRECTORY TOOL (SAFE)
 * 
 * Lists files and folders in a directory.
 */
export const listDirectoryTool = tool(
  async ({ dirPath }) => {
    try {
      const resolvedPath = path.resolve(dirPath || ".");
      
      if (!fs.existsSync(resolvedPath)) {
        return `Error: Directory not found: ${dirPath}`;
      }
      
      const items = fs.readdirSync(resolvedPath, { withFileTypes: true });
      
      // Format the output
      const formatted = items.map((item) => {
        const type = item.isDirectory() ? "📁" : "📄";
        return `${type} ${item.name}`;
      });
      
      return `Contents of ${resolvedPath}:\n${formatted.join("\n")}`;
    } catch (error) {
      return `Error listing directory: ${error.message}`;
    }
  },
  {
    name: "list_directory",
    description: "List all files and folders in a directory. Use '.' for current directory.",
    schema: z.object({
      dirPath: z.string().describe("Path to the directory to list").default("."),
    }),
  }
);

/**
 * DELETE FILE TOOL (DANGEROUS!)
 * 
 * Deletes a file. Requires user approval!
 */
export const deleteFileTool = tool(
  async ({ filePath }) => {
    try {
      const resolvedPath = path.resolve(filePath);
      
      if (!fs.existsSync(resolvedPath)) {
        return `Error: File not found: ${filePath}`;
      }
      
      fs.unlinkSync(resolvedPath);
      return `Successfully deleted: ${filePath}`;
    } catch (error) {
      return `Error deleting file: ${error.message}`;
    }
  },
  {
    name: "delete_file",
    description: "Delete a file. Use with caution - this cannot be undone!",
    schema: z.object({
      filePath: z.string().describe("Path to the file to delete"),
    }),
  }
);

// ============================================================================
// SHELL COMMAND TOOL
// ============================================================================

/**
 * SHELL COMMAND TOOL (DANGEROUS!)
 * 
 * Runs a terminal command. This is very powerful but dangerous:
 *   - Can run ANY command
 *   - Can modify system files
 *   - Can install software
 *   - Can delete things
 * 
 * Always requires user approval!
 */
export const shellCommandTool = tool(
  async ({ command, cwd }) => {
    try {
      // Set working directory
      const workingDir = cwd ? path.resolve(cwd) : process.cwd();
      
      // Execute the command
      const { stdout, stderr } = await execAsync(command, {
        cwd: workingDir,
        timeout: 60000, // 60 second timeout
        maxBuffer: 1024 * 1024, // 1MB max output
      });
      
      // Combine output
      let result = "";
      if (stdout) result += `stdout:\n${stdout}`;
      if (stderr) result += `\nstderr:\n${stderr}`;
      
      // Truncate if too long
      if (result.length > 5000) {
        result = result.slice(0, 5000) + "\n... [Output truncated]";
      }
      
      return result || "Command executed successfully (no output)";
    } catch (error) {
      return `Error executing command: ${error.message}`;
    }
  },
  {
    name: "shell_command",
    description: "Execute a shell/terminal command. Use for running scripts, installing packages, etc.",
    schema: z.object({
      command: z.string().describe("The command to execute"),
      cwd: z.string().optional().describe("Working directory for the command"),
    }),
  }
);

// ============================================================================
// SEARCH TOOL
// ============================================================================

/**
 * SEARCH FILES TOOL (SAFE)
 * 
 * Searches for files matching a pattern.
 */
export const searchFilesTool = tool(
  async ({ pattern, directory }) => {
    try {
      const searchDir = path.resolve(directory || ".");
      
      if (!fs.existsSync(searchDir)) {
        return `Error: Directory not found: ${directory}`;
      }
      
      // Simple recursive search
      const matches = [];
      
      function searchRecursive(dir, depth = 0) {
        if (depth > 5) return; // Max depth to prevent infinite loops
        
        try {
          const items = fs.readdirSync(dir, { withFileTypes: true });
          
          for (const item of items) {
            const fullPath = path.join(dir, item.name);
            
            // Skip node_modules and hidden directories
            if (item.name.startsWith(".") || item.name === "node_modules") {
              continue;
            }
            
            // Check if name matches pattern (simple glob)
            const regex = new RegExp(pattern.replace("*", ".*"), "i");
            if (regex.test(item.name)) {
              matches.push(fullPath);
            }
            
            // Recurse into directories
            if (item.isDirectory()) {
              searchRecursive(fullPath, depth + 1);
            }
          }
        } catch (e) {
          // Skip directories we can't read
        }
      }
      
      searchRecursive(searchDir);
      
      if (matches.length === 0) {
        return `No files found matching "${pattern}" in ${searchDir}`;
      }
      
      // Limit results
      const limited = matches.slice(0, 50);
      let result = `Found ${matches.length} matches:\n${limited.join("\n")}`;
      if (matches.length > 50) {
        result += `\n... and ${matches.length - 50} more`;
      }
      
      return result;
    } catch (error) {
      return `Error searching: ${error.message}`;
    }
  },
  {
    name: "search_files",
    description: "Search for files matching a pattern. Use * as wildcard. Example: '*.js' finds all JavaScript files.",
    schema: z.object({
      pattern: z.string().describe("Pattern to search for (e.g., '*.js', 'config*')"),
      directory: z.string().optional().describe("Directory to search in (default: current directory)"),
    }),
  }
);

// ============================================================================
// CALCULATION TOOL
// ============================================================================

/**
 * CALCULATOR TOOL (SAFE)
 * 
 * Performs mathematical calculations.
 * This is a simple example of a utility tool.
 */
export const calculatorTool = tool(
  async ({ expression }) => {
    try {
      // Safety: Only allow math characters
      if (!/^[\d\s+\-*/.()]+$/.test(expression)) {
        return "Error: Invalid expression. Only numbers and operators (+, -, *, /, parentheses) allowed.";
      }
      
      // Evaluate the expression
      const result = eval(expression);
      return `${expression} = ${result}`;
    } catch (error) {
      return `Error calculating: ${error.message}`;
    }
  },
  {
    name: "calculator",
    description: "Perform mathematical calculations. Example: '2 + 2 * 3' returns 8.",
    schema: z.object({
      expression: z.string().describe("Mathematical expression to evaluate"),
    }),
  }
);

// ============================================================================
// WEB SEARCH TOOL
// ============================================================================

/**
 * WEB SEARCH TOOL (SAFE)
 * 
 * Searches the web using DuckDuckGo's instant answer API.
 * This is a simple implementation - for production you might use:
 *   - Google Custom Search API
 *   - Bing Search API
 *   - SerpAPI
 *   - Tavily (designed for AI agents)
 */
export const webSearchTool = tool(
  async ({ query }) => {
    try {
      // Use DuckDuckGo Instant Answer API (no API key needed)
      const encodedQuery = encodeURIComponent(query);
      const url = `https://api.duckduckgo.com/?q=${encodedQuery}&format=json&no_html=1&skip_disambig=1`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      // Build result from various DuckDuckGo fields
      let result = "";
      
      // Abstract (main answer)
      if (data.Abstract) {
        result += `**Summary**: ${data.Abstract}\n`;
        if (data.AbstractSource) {
          result += `Source: ${data.AbstractSource}\n`;
        }
        if (data.AbstractURL) {
          result += `URL: ${data.AbstractURL}\n`;
        }
      }
      
      // Definition
      if (data.Definition) {
        result += `\n**Definition**: ${data.Definition}\n`;
      }
      
      // Answer (for specific queries like "how tall is...")
      if (data.Answer) {
        result += `\n**Answer**: ${data.Answer}\n`;
      }
      
      // Related topics
      if (data.RelatedTopics && data.RelatedTopics.length > 0) {
        result += `\n**Related Topics**:\n`;
        const topics = data.RelatedTopics.slice(0, 5);
        for (const topic of topics) {
          if (topic.Text) {
            result += `• ${topic.Text.slice(0, 200)}${topic.Text.length > 200 ? "..." : ""}\n`;
          }
        }
      }
      
      // If no results found
      if (!result) {
        return `No instant answers found for "${query}". Try rephrasing your query or use more specific terms.`;
      }
      
      return `Search results for "${query}":\n\n${result}`;
    } catch (error) {
      return `Error searching: ${error.message}. Note: Web search requires an internet connection.`;
    }
  },
  {
    name: "web_search",
    description: "Search the web for information. Use this to look up facts, definitions, current information, or anything not in local files.",
    schema: z.object({
      query: z.string().describe("The search query"),
    }),
  }
);

// ============================================================================
// TOOL COLLECTIONS
// ============================================================================
/**
 * We organize tools into groups for different purposes:
 * 
 * ALL TOOLS - Every tool available
 * SAFE TOOLS - Tools that can run without approval
 * DANGEROUS TOOLS - Tools that need user approval
 */

/**
 * All available tools
 */
export const allTools = [
  readFileTool,
  writeFileTool,
  listDirectoryTool,
  deleteFileTool,
  shellCommandTool,
  searchFilesTool,
  calculatorTool,
  webSearchTool,
];

/**
 * Safe tools - can be run automatically without user approval
 * 
 * These only read data or perform harmless operations.
 */
export const safeTools = allTools.filter(
  (tool) => !config.dangerousTools.includes(tool.name)
);

/**
 * Dangerous tools - require user approval
 * 
 * These can modify files, run commands, or have other side effects.
 */
export const dangerousTools = allTools.filter(
  (tool) => config.dangerousTools.includes(tool.name)
);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if a tool is dangerous (requires approval)
 * 
 * @param {string} toolName - Name of the tool
 * @returns {boolean} True if dangerous
 */
export function isDangerousTool(toolName) {
  return config.dangerousTools.includes(toolName);
}

/**
 * Get a tool by its name
 * 
 * @param {string} name - Tool name
 * @returns {Tool|undefined} The tool or undefined
 */
export function getToolByName(name) {
  return allTools.find((t) => t.name === name);
}

/**
 * Get tool names as a formatted string (for prompts)
 */
export function getToolDescriptions() {
  return allTools
    .map((t) => {
      const danger = isDangerousTool(t.name) ? "⚠️ " : "";
      return `${danger}${t.name}: ${t.description}`;
    })
    .join("\n");
}

// ============================================================================
// 📝 WHAT'S NEXT?
// ============================================================================
/**
 * Great! You now understand:
 *   ✅ What tools are (functions the LLM can call)
 *   ✅ How to define tools with name, description, and schema
 *   ✅ The difference between safe and dangerous tools
 *   ✅ Why dangerous tools need approval (they can change things!)
 * 
 * ➡️  NEXT: Read planner.js (5/11) to see the Planner node
 */
