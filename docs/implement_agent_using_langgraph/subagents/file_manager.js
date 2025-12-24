/**
 * File Manager Subagent
 * 
 * Specialized agent for file and directory operations.
 */

import fs from "fs/promises";
import path from "path";
import { AGENT_CONFIG } from "../config.js";

/**
 * Create a file with content
 */
export async function createFile(filePath, content, options = {}) {
  const { createDirs = true } = options;
  const absolutePath = path.resolve(filePath);

  if (createDirs) {
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  }

  await fs.writeFile(absolutePath, content, "utf-8");
  
  return {
    success: true,
    path: absolutePath,
    size: content.length,
  };
}

/**
 * Create a directory structure
 */
export async function createDirectory(dirPath, structure = {}) {
  const absolutePath = path.resolve(dirPath);
  await fs.mkdir(absolutePath, { recursive: true });

  // Create nested structure if provided
  for (const [name, value] of Object.entries(structure)) {
    const itemPath = path.join(absolutePath, name);
    
    if (typeof value === "object" && value !== null) {
      await createDirectory(itemPath, value);
    } else {
      await fs.writeFile(itemPath, value || "", "utf-8");
    }
  }

  return { success: true, path: absolutePath };
}

/**
 * Read file content
 */
export async function readFile(filePath) {
  const absolutePath = path.resolve(filePath);
  const content = await fs.readFile(absolutePath, "utf-8");
  return { content, path: absolutePath };
}

/**
 * List directory contents
 */
export async function listDirectory(dirPath, options = {}) {
  const { recursive = false, maxDepth = 3 } = options;
  const absolutePath = path.resolve(dirPath);
  
  const entries = await fs.readdir(absolutePath, { withFileTypes: true });
  
  const items = await Promise.all(
    entries.map(async (entry) => {
      const itemPath = path.join(absolutePath, entry.name);
      const stats = await fs.stat(itemPath);
      
      return {
        name: entry.name,
        type: entry.isDirectory() ? "directory" : "file",
        size: stats.size,
        modified: stats.mtime,
      };
    })
  );

  return { items, path: absolutePath };
}

export const fileManagerSubagent = {
  name: "FILE_MANAGER",
  createFile,
  createDirectory,
  readFile,
  listDirectory,
};

export default fileManagerSubagent;
