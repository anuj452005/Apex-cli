/**
 * Agent Configuration
 * 
 * Configuration for the autonomous agent including prompts,
 * behavior settings, and subagent definitions.
 */

import dotenv from "dotenv";
dotenv.config();

export const AGENT_CONFIG = {
  // LLM settings for agent
  llm: {
    model: "gemini-2.0-flash",
    temperature: 0.4,
    apiKey: process.env.GOOGLE_API_KEY,
  },

  // Agent behavior
  behavior: {
    maxIterations: 20,          // Max planning/execution cycles
    maxSubtasks: 10,            // Max subtasks per plan
    requireApprovalFor: [
      "file_write",
      "shell_command",
      "delete",
    ],
    autoRetryOnError: true,
    maxRetries: 3,
  },

  // Prompts
  prompts: {
    supervisor: `You are an AI Agent Supervisor. Your job is to:
1. Understand the user's high-level task
2. Create a detailed plan with clear steps
3. Delegate work to specialized subagents
4. Monitor progress and handle errors
5. Provide updates to the user

Available subagents:
- CODER: Writes and modifies code
- FILE_MANAGER: Creates files and directories
- RESEARCHER: Searches for information

Always think step-by-step and explain your reasoning.`,

    planner: `You are a Task Planner. Given a task, break it down into:
1. Clear, actionable subtasks
2. Dependencies between tasks
3. Required resources/tools
4. Estimated complexity

Output a structured plan that can be executed step by step.`,

    executor: `You are a Task Executor. Given a subtask:
1. Determine the best approach
2. Select appropriate tools
3. Execute the action
4. Report the result

Be thorough but efficient. Report any issues immediately.`,

    reflector: `You are a Reflector. After each action:
1. Evaluate if the action was successful
2. Check if the result matches expectations
3. Identify any issues or errors
4. Suggest corrections if needed
5. Decide if the task is complete

Be critical but constructive.`,
  },

  // Subagent configs
  subagents: {
    coder: {
      name: "CODER",
      description: "Writes, reviews, and modifies code",
      skills: ["javascript", "typescript", "python", "react", "node"],
    },
    fileManager: {
      name: "FILE_MANAGER", 
      description: "Creates and manages files/directories",
      skills: ["create", "read", "write", "delete", "organize"],
    },
    researcher: {
      name: "RESEARCHER",
      description: "Searches and gathers information",
      skills: ["web_search", "documentation", "examples"],
    },
  },

  // UI settings
  ui: {
    showPlan: true,
    showProgress: true,
    showReflection: false,
    progressInterval: 1000,
  },
};

export default AGENT_CONFIG;
