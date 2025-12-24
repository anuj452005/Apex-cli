/**
 * File System Tools
 * 
 * Tools for reading, writing, and listing files.
 * Uses LangChain's DynamicStructuredTool for type-safe tool definitions.
 */

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { TOOLS_CONFIG, isPathAllowed } from "../config.js";

/**
 * READ FILE TOOL
 * Reads the contents of a file
 */
export const readFileTool = new DynamicStructuredTool({
  name: "read_file",
  description: "Read the contents of a file at the specified path. Returns the file content as a string.",
  schema: z.object({
    filePath: z.string().describe("The absolute or relative path to the file to read"),
  }),
  func: async ({ filePath }) => {
    try {
      // Resolve to absolute path
      const absolutePath = path.resolve(filePath);

      // Security check
      if (!isPathAllowed(absolutePath)) {
        return `Error: Access denied. Path "${absolutePath}" is not within allowed directories.`;
      }

      // Check file exists
      const stats = await fs.stat(absolutePath);

      // Check file size
      if (stats.size > TOOLS_CONFIG.fileSystem.maxFileSize) {
        return `Error: File is too large (${(stats.size / 1024).toFixed(2)}KB). Maximum allowed: ${TOOLS_CONFIG.fileSystem.maxFileSize / 1024}KB`;
      }

      // Read file
      const content = await fs.readFile(absolutePath, "utf-8");

      return `File: ${absolutePath}\n\n${content}`;
    } catch (error) {
      if (error.code === "ENOENT") {
        return `Error: File not found at "${filePath}"`;
      }
      return `Error reading file: ${error.message}`;
    }
  },
});

/**
 * WRITE FILE TOOL
 * Creates or overwrites a file with new content
 */
export const writeFileTool = new DynamicStructuredTool({
  name: "write_file",
  description: "Write content to a file. Creates the file if it doesn't exist, or overwrites if it does.",
  schema: z.object({
    filePath: z.string().describe("The path where the file should be written"),
    content: z.string().describe("The content to write to the file"),
    createDirs: z.boolean().optional().default(true).describe("Create parent directories if they don't exist"),
  }),
  func: async ({ filePath, content, createDirs }) => {
    try {
      const absolutePath = path.resolve(filePath);

      // Security check
      if (!isPathAllowed(absolutePath)) {
        return `Error: Access denied. Cannot write to "${absolutePath}"`;
      }

      // Check extension
      const ext = path.extname(absolutePath).toLowerCase();
      if (ext && !TOOLS_CONFIG.fileSystem.allowedExtensions.includes(ext)) {
        return `Error: File extension "${ext}" is not allowed.`;
      }

      // Create directories if needed
      if (createDirs) {
        await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      }

      // Write file
      await fs.writeFile(absolutePath, content, "utf-8");

      return `Successfully wrote ${content.length} characters to "${absolutePath}"`;
    } catch (error) {
      return `Error writing file: ${error.message}`;
    }
  },
});

/**
 * LIST DIRECTORY TOOL
 * Lists contents of a directory
 */
export const listDirectoryTool = new DynamicStructuredTool({
  name: "list_directory",
  description: "List all files and subdirectories in a directory. Returns names with type indicators.",
  schema: z.object({
    dirPath: z.string().describe("The path to the directory to list"),
    recursive: z.boolean().optional().default(false).describe("Whether to list recursively"),
    maxDepth: z.number().optional().default(2).describe("Maximum depth for recursive listing"),
  }),
  func: async ({ dirPath, recursive, maxDepth }) => {
    try {
      const absolutePath = path.resolve(dirPath);

      if (!isPathAllowed(absolutePath)) {
        return `Error: Access denied. Cannot list "${absolutePath}"`;
      }

      const entries = await fs.readdir(absolutePath, { withFileTypes: true });

      const formatEntry = (entry, prefix = "") => {
        const icon = entry.isDirectory() ? "📁" : "📄";
        return `${prefix}${icon} ${entry.name}`;
      };

      let result = `Contents of ${absolutePath}:\n\n`;

      if (recursive) {
        // Recursive listing
        const listRecursive = async (dir, depth = 0, indent = "") => {
          if (depth > maxDepth) return [];

          const items = await fs.readdir(dir, { withFileTypes: true });
          const lines = [];

          for (const item of items) {
            // Skip node_modules and hidden files
            if (item.name.startsWith(".") || item.name === "node_modules") continue;

            lines.push(formatEntry(item, indent));

            if (item.isDirectory() && depth < maxDepth) {
              const subPath = path.join(dir, item.name);
              const subLines = await listRecursive(subPath, depth + 1, indent + "  ");
              lines.push(...subLines);
            }
          }

          return lines;
        };

        const lines = await listRecursive(absolutePath);
        result += lines.join("\n");
      } else {
        result += entries.map(e => formatEntry(e)).join("\n");
      }

      return result;
    } catch (error) {
      if (error.code === "ENOENT") {
        return `Error: Directory not found at "${dirPath}"`;
      }
      return `Error listing directory: ${error.message}`;
    }
  },
});

/**
 * SEARCH FILES TOOL
 * Searches for files matching a pattern
 */
export const searchFilesTool = new DynamicStructuredTool({
  name: "search_files",
  description: "Search for files by name pattern or content. Returns matching file paths.",
  schema: z.object({
    directory: z.string().describe("Directory to search in"),
    pattern: z.string().describe("Glob pattern or text to search for (e.g., '*.js' or 'function')"),
    searchContent: z.boolean().optional().default(false).describe("Search within file contents"),
    maxResults: z.number().optional().default(20).describe("Maximum number of results"),
  }),
  func: async ({ directory, pattern, searchContent, maxResults }) => {
    try {
      const absolutePath = path.resolve(directory);

      if (!isPathAllowed(absolutePath)) {
        return `Error: Access denied. Cannot search in "${absolutePath}"`;
      }

      const results = [];

      const searchDir = async (dir) => {
        if (results.length >= maxResults) return;

        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          if (results.length >= maxResults) break;
          if (entry.name.startsWith(".") || entry.name === "node_modules") continue;

          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            await searchDir(fullPath);
          } else {
            // Check if filename matches pattern
            const matchesName = entry.name.includes(pattern) || 
                               pattern.includes("*") && new RegExp(pattern.replace(/\*/g, ".*")).test(entry.name);

            if (matchesName) {
              results.push(fullPath);
            } else if (searchContent) {
              // Search in file content
              try {
                const content = await fs.readFile(fullPath, "utf-8");
                if (content.includes(pattern)) {
                  results.push(fullPath);
                }
              } catch {
                // Skip binary files
              }
            }
          }
        }
      };

      await searchDir(absolutePath);

      if (results.length === 0) {
        return `No files found matching "${pattern}" in "${directory}"`;
      }

      return `Found ${results.length} file(s):\n\n${results.join("\n")}`;
    } catch (error) {
      return `Error searching files: ${error.message}`;
    }
  },
});

// Export all file tools
export const fileTools = [
  readFileTool,
  writeFileTool,
  listDirectoryTool,
  searchFilesTool,
];

export default fileTools;
