/**
 * ============================================================================
 * 📚 LANGGRAPH LEARNING PATH - FILE 2 OF 11
 * ============================================================================
 * 
 * 📖 WHAT IS THIS FILE?
 *    This is the CONFIG file - settings and prompts for the agent.
 *    It centralizes all configuration in one place.
 * 
 * 📝 PREREQUISITES: Read state.js (1/11) first
 * 
 * ➡️  NEXT FILE: After understanding this, read llm.js (3/11)
 * 
 * ============================================================================
 * 
 * 🧠 WHY SEPARATE CONFIGURATION?
 * 
 * Good practice is to keep config separate from logic because:
 *   1. Easy to change settings without touching code
 *   2. Can use environment variables for secrets (API keys)
 *   3. Clear place to find all prompts and settings
 * 
 * ============================================================================
 */

import dotenv from "dotenv";
import path from "path";
import os from "os";
import fs from "fs";

// ============================================================================
// LOADING CONFIGURATION
// ============================================================================
/**
 * Configuration comes from multiple sources (in priority order):
 *   1. User's config file (~/.apex-cli/config.json)
 *   2. Environment variables (.env file)
 *   3. Default values
 * 
 * This allows users to set their API key once and have it work everywhere.
 */

// Load .env file if it exists
dotenv.config();
dotenv.config({ path: path.join(process.cwd(), ".env") });

// Config file paths
const CONFIG_DIR = path.join(os.homedir(), ".apex-cli");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

/**
 * Load user's saved configuration from ~/.apex-cli/config.json
 */
function loadUserConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const content = fs.readFileSync(CONFIG_FILE, "utf-8");
      return JSON.parse(content);
    }
  } catch (error) {
    // Silently fail - will use environment variables instead
  }
  return {};
}

const userConfig = loadUserConfig();

/**
 * Get a config value, checking user config first, then env vars, then default
 */
function getConfigValue(key, defaultValue = "") {
  return userConfig[key] || process.env[key] || defaultValue;
}

// ============================================================================
// MAIN CONFIGURATION OBJECT
// ============================================================================
/**
 * This is the main config object used throughout the agent.
 * Import it like: import { config } from "./config.js";
 */
export const config = {
  // ─────────────────────────────────────────────────────────────────────────
  // API SETTINGS
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * OpenRouter API key (recommended - no rate limits like Gemini free tier)
   * Set it with: apex config set OPENROUTER_API_KEY your-key-here
   * Get your key at: https://openrouter.ai/keys
   */
  openRouterApiKey: getConfigValue("OPENROUTER_API_KEY"),
  
  /**
   * Google API key for Gemini (alternative, has rate limits on free tier)
   * Set it with: apex config set GOOGLE_API_KEY your-key-here
   */
  googleApiKey: getConfigValue("GOOGLE_API_KEY"),
  
  /**
   * Which model to use. Good options for OpenRouter:
   *   - deepseek/deepseek-chat (excellent, very cheap)
   *   - meta-llama/llama-3.1-70b-instruct (great, free tier available)
   *   - google/gemini-2.0-flash-thinking-exp:free (free)
   *   - anthropic/claude-3.5-sonnet (best but expensive)
   * 
   * For Google Gemini:
   *   - gemini-2.0-flash
   *   - gemini-1.5-pro
   */
  model: getConfigValue("ORBITAL_MODEL", "deepseek/deepseek-chat"),
  
  /**
   * LLM Provider: "openrouter" or "google"
   */
  llmProvider: getConfigValue("LLM_PROVIDER", "openrouter"),
  
  // ─────────────────────────────────────────────────────────────────────────
  // LLM PARAMETERS
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Temperature controls randomness in AI responses:
   *   - 0.0 = Very focused, deterministic
   *   - 0.7 = Balanced creativity (default)
   *   - 1.0 = Maximum creativity/randomness
   */
  temperature: 0.7,
  
  /**
   * Maximum tokens (words/pieces) the AI can output in one response.
   * 2048 is usually enough for most tasks.
   */
  maxOutputTokens: 2048,
  
  // ─────────────────────────────────────────────────────────────────────────
  // AGENT LIMITS
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Maximum iterations before forcing the agent to stop.
   * Prevents infinite loops if the agent gets stuck.
   */
  maxIterations: 15,
  
  /**
   * Maximum retries for a single step before giving up.
   */
  maxRetries: 3,
  
  // ─────────────────────────────────────────────────────────────────────────
  // TOOL CLASSIFICATION
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * DANGEROUS TOOLS require user approval before execution.
   * These can modify files, run commands, or access external services.
   * 
   * Why? AI can make mistakes, so we want a human check for risky actions.
   */
  dangerousTools: [
    "shell_command",   // Can run any terminal command
    "write_file",      // Can create/overwrite files
    "delete_file",     // Can delete files
    "http_request",    // Can make network requests
  ],
  
  // ─────────────────────────────────────────────────────────────────────────
  // PERSISTENCE
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Where to store session data for persistence.
   * This allows resuming conversations later.
   */
  sessionsDir: path.join(os.homedir(), ".apex-cli", "sessions"),
  
  // Export paths for reference
  configDir: CONFIG_DIR,
  configFile: CONFIG_FILE,
};

// ============================================================================
// AGENT PROMPTS
// ============================================================================
/**
 * Prompts tell the LLM how to behave. Each node has its own prompt.
 * Good prompts are crucial for agent quality!
 */

// ─────────────────────────────────────────────────────────────────────────
// MAIN SYSTEM PROMPT
// ─────────────────────────────────────────────────────────────────────────
/**
 * This is the base prompt used in simple chat mode.
 * It defines the AI's personality and capabilities.
 */
export const SYSTEM_PROMPT = `You are Apex, an AI coding assistant.

You help users with programming tasks by:
- Writing and explaining code
- Debugging issues
- Creating files and projects
- Running commands when needed

You have access to tools. Use them when appropriate to help the user.
Always explain what you're doing and why.

Be concise but thorough. If unsure, ask for clarification.`;

// ─────────────────────────────────────────────────────────────────────────
// PLANNER PROMPT
// ─────────────────────────────────────────────────────────────────────────
/**
 * The Planner analyzes the user's task and creates a step-by-step plan.
 * This runs ONCE at the start of an agent task.
 */
export const PLANNER_PROMPT = `You are a Task Planner. Your job is to analyze the user's request and create an appropriate plan.

## CRITICAL: Query Type Detection

FIRST, determine if this is a SIMPLE query or a COMPLEX task:

### SIMPLE QUERIES (respond directly with 1 step):
- Greetings: "hello", "hi", "hey", "helo", "good morning", etc.
- Identity questions: "who are you", "what are you", "what can you do"
- Small talk: casual conversation, compliments, thanks
- Simple questions: "how are you", "what's up"
- Acknowledgments: "ok", "thanks", "got it"

For SIMPLE queries, return:
{
  "goal": "Respond to user's message",
  "query_type": "simple",
  "steps": [
    { "id": 1, "description": "Respond directly to the user", "tools_needed": [] }
  ],
  "estimated_complexity": "simple"
}

### COMPLEX TASKS (create multi-step plan):
- File operations: create, read, write, delete, analyze files
- Code tasks: write code, debug, explain code files
- Directory operations: list, search, navigate
- Shell commands: run commands, install packages
- Research tasks: search web, analyze content
- Any task explicitly requiring tools

For COMPLEX tasks, create a thorough plan with multiple steps.

## Output Format:
Return a JSON object with this structure:
{
  "goal": "Brief description of what user wants",
  "query_type": "simple" | "complex",
  "steps": [
    { "id": 1, "description": "First step to take", "tools_needed": ["tool_name"] }
  ],
  "estimated_complexity": "simple" | "medium" | "complex"
}

## Examples:

### User says: "hello" or "hi there" or "hey"
{
  "goal": "Respond to greeting",
  "query_type": "simple",
  "steps": [{ "id": 1, "description": "Respond with a friendly greeting", "tools_needed": [] }],
  "estimated_complexity": "simple"
}

### User says: "read package.json"
{
  "goal": "Read and display package.json content",
  "query_type": "complex",
  "steps": [
    { "id": 1, "description": "Read the package.json file", "tools_needed": ["read_file"] },
    { "id": 2, "description": "Present the contents to the user", "tools_needed": [] }
  ],
  "estimated_complexity": "simple"
}

## Guidelines for COMPLEX tasks:
- Break into small, specific, actionable steps
- Order logically (dependencies first)
- Maximum 10 steps
- For analysis: READ files, don't just LIST them
- End with a step to present/explain findings

Now analyze this task and create the appropriate plan:`;

// ─────────────────────────────────────────────────────────────────────────
// EXECUTOR PROMPT
// ─────────────────────────────────────────────────────────────────────────
/**
 * The Executor takes one step at a time and executes it using tools.
 * It focuses on the current step only.
 */
export const EXECUTOR_PROMPT = `You are a Task Executor. Your job is to complete ONE specific step from a plan.

## Your Responsibilities:
1. Focus ONLY on the current step
2. Use the appropriate tools to complete it
3. Report what you did and the result
4. Handle errors gracefully

## Context Given:
- The overall goal
- The current step to execute
- Previous step results (for context)

## Guidelines:
- Use tools to actually DO the work, don't just describe it
- If a step fails, explain what went wrong
- Be specific about what you created/modified
- If you need information you don't have, say so

You have these tools available. Use them to complete the step:`;

// ─────────────────────────────────────────────────────────────────────────
// REFLECTOR PROMPT
// ─────────────────────────────────────────────────────────────────────────
/**
 * The Reflector evaluates what the Executor did and decides next action.
 * This is the "thinking" step that makes the agent smarter.
 */
export const REFLECTOR_PROMPT = `You are a Task Reflector. Your job is to evaluate the latest step and decide what to do next.

## Your Responsibilities:
1. Assess if the current step was completed successfully
2. Decide the next action: continue, retry, or finish
3. Explain your reasoning

## Output Format:
Return a JSON object with this structure:
{
  "assessment": "Brief summary of what happened",
  "success": true | false,
  "decision": "continue" | "retry" | "finish" | "error",
  "reasoning": "Why you made this decision",
  "modification": null | "Optional: how to modify the next attempt"
}

## Decision Guidelines:
- "continue": Step succeeded, move to next step
- "retry": Step failed but is recoverable, try again (max 3 retries)
- "finish": All steps complete OR task achieved early
- "error": Unrecoverable error, stop and report to user

## Consider:
- Did the tool calls succeed?
- Does the result match what the step intended?
- Are there remaining steps?
- Has the overall goal been achieved?

Now evaluate the latest execution:`;

// ============================================================================
// 📝 WHAT'S NEXT?
// ============================================================================
/**
 * Great! You now understand:
 *   ✅ How configuration is loaded (user config → env vars → defaults)
 *   ✅ The main config options (API, model, dangerous tools, etc.)
 *   ✅ The prompts for each agent role (Planner, Executor, Reflector)
 * 
 * ➡️  NEXT: Read llm.js (3/11) to see how we set up the LLM with tools
 */
