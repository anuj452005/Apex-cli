
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

import { config } from "../../config/google.config.js";

const execAsync = promisify(exec);

export const readFileTool = tool(
  async ({ filePath }) => {
    try {

      const resolvedPath = path.resolve(filePath);

      if (!fs.existsSync(resolvedPath)) {
        return `Error: File not found: ${filePath}`;
      }

      const content = fs.readFileSync(resolvedPath, "utf-8");

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

export const writeFileTool = tool(
  async ({ filePath, content }) => {
    try {
      const resolvedPath = path.resolve(filePath);

      const dir = path.dirname(resolvedPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

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

export const listDirectoryTool = tool(
  async ({ dirPath }) => {
    try {
      const resolvedPath = path.resolve(dirPath || ".");

      if (!fs.existsSync(resolvedPath)) {
        return `Error: Directory not found: ${dirPath}`;
      }

      const items = fs.readdirSync(resolvedPath, { withFileTypes: true });

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

export const shellCommandTool = tool(
  async ({ command, cwd }) => {
    try {

      const workingDir = cwd ? path.resolve(cwd) : process.cwd();

      const { stdout, stderr } = await execAsync(command, {
        cwd: workingDir,
        timeout: 60000,
        maxBuffer: 1024 * 1024,
      });

      let result = "";
      if (stdout) result += `stdout:\n${stdout}`;
      if (stderr) result += `\nstderr:\n${stderr}`;

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

export const searchFilesTool = tool(
  async ({ pattern, directory }) => {
    try {
      const searchDir = path.resolve(directory || ".");

      if (!fs.existsSync(searchDir)) {
        return `Error: Directory not found: ${directory}`;
      }

      const matches = [];

      function searchRecursive(dir, depth = 0) {
        if (depth > 5) return;

        try {
          const items = fs.readdirSync(dir, { withFileTypes: true });

          for (const item of items) {
            const fullPath = path.join(dir, item.name);

            if (item.name.startsWith(".") || item.name === "node_modules") {
              continue;
            }

            const regex = new RegExp(pattern.replace("*", ".*"), "i");
            if (regex.test(item.name)) {
              matches.push(fullPath);
            }

            if (item.isDirectory()) {
              searchRecursive(fullPath, depth + 1);
            }
          }
        } catch (e) {

        }
      }

      searchRecursive(searchDir);

      if (matches.length === 0) {
        return `No files found matching "${pattern}" in ${searchDir}`;
      }

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

export const calculatorTool = tool(
  async ({ expression }) => {
    try {

      if (!/^[\d\s+\-*/.()]+$/.test(expression)) {
        return "Error: Invalid expression. Only numbers and operators (+, -, *, /, parentheses) allowed.";
      }

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

export const webSearchTool = tool(
  async ({ query }) => {
    try {

      const encodedQuery = encodeURIComponent(query);
      const url = `https://api.duckduckgo.com/?q=${encodedQuery}&format=json&no_html=1&skip_disambig=1`;

      const response = await fetch(url);
      const data = await response.json();

      let result = "";

      if (data.Abstract) {
        result += `**Summary**: ${data.Abstract}\n`;
        if (data.AbstractSource) {
          result += `Source: ${data.AbstractSource}\n`;
        }
        if (data.AbstractURL) {
          result += `URL: ${data.AbstractURL}\n`;
        }
      }

      if (data.Definition) {
        result += `\n**Definition**: ${data.Definition}\n`;
      }

      if (data.Answer) {
        result += `\n**Answer**: ${data.Answer}\n`;
      }

      if (data.RelatedTopics && data.RelatedTopics.length > 0) {
        result += `\n**Related Topics**:\n`;
        const topics = data.RelatedTopics.slice(0, 5);
        for (const topic of topics) {
          if (topic.Text) {
            result += `• ${topic.Text.slice(0, 200)}${topic.Text.length > 200 ? "..." : ""}\n`;
          }
        }
      }

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

export const safeTools = allTools.filter(
  (tool) => !config.dangerousTools.includes(tool.name)
);

export const dangerousTools = allTools.filter(
  (tool) => config.dangerousTools.includes(tool.name)
);

export function isDangerousTool(toolName) {
  return config.dangerousTools.includes(toolName);
}

export function getToolByName(name) {
  return allTools.find((t) => t.name === name);
}

export function getToolDescriptions() {
  return allTools
    .map((t) => {
      const danger = isDangerousTool(t.name) ? "⚠️ " : "";
      return `${danger}${t.name}: ${t.description}`;
    })
    .join("\n");
}
