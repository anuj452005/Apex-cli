import dotenv from "dotenv";
import path from "path";
import os from "os";
import fs from "fs";

// Try loading .env from multiple possible locations
dotenv.config(); // Current directory
dotenv.config({ path: path.join(process.cwd(), ".env") }); // Explicit current directory

// Config file path
const CONFIG_DIR = path.join(os.homedir(), ".apex-cli");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

/**
 * Load config from ~/.apex-cli/config.json
 */
function loadUserConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const content = fs.readFileSync(CONFIG_FILE, "utf-8");
      return JSON.parse(content);
    }
  } catch (error) {
    // Silently fail, will use environment variables
  }
  return {};
}

const userConfig = loadUserConfig();

/**
 * Get config value from user config first, then environment variables
 */
function getConfigValue(key, defaultValue = "") {
  return userConfig[key] || process.env[key] || defaultValue;
}

export const config = {
  googleApiKey: getConfigValue("GOOGLE_API_KEY"),
  model: getConfigValue("ORBITAL_MODEL", "gemini-2.0-flash"),
  
  // LangGraph settings
  temperature: 0.7,
  maxOutputTokens: 2048,
  maxIterations: 10,
  
  // Tools requiring user approval
  dangerousTools: ["shell_command", "write_file", "delete_file", "http_request"],
  
  // File-based persistence directory
  sessionsDir: path.join(os.homedir(), ".apex-cli", "sessions"),
  
  // Config paths (exported for reference)
  configDir: CONFIG_DIR,
  configFile: CONFIG_FILE,
};
