/**
 * ============================================================================
 * 📚 LANGGRAPH MODULE INDEX
 * ============================================================================
 * 
 * This is the main entry point for the LangGraph module.
 * It re-exports everything so other parts of the app can import from here.
 * 
 * Usage:
 *   import { AgentSession, allTools, buildFullAgentGraph } from "./lib/langgraph";
 * 
 * ============================================================================
 */

// State
export { AgentState, createInitialState, isAgentComplete } from "./state.js";

// Configuration (re-exported from config folder)
export { config, SYSTEM_PROMPT, PLANNER_PROMPT, EXECUTOR_PROMPT, REFLECTOR_PROMPT } from "../../config/google.config.js";

// LLM
export { createBaseLLM, createLLMWithTools, createPlannerLLM, createExecutorLLM, createReflectorLLM } from "./llm.js";

// Tools
export { 
  allTools, 
  safeTools, 
  dangerousTools, 
  isDangerousTool, 
  getToolByName,
  readFileTool,
  writeFileTool,
  shellCommandTool,
  listDirectoryTool,
  searchFilesTool,
  calculatorTool,
} from "./tools.js";

// Nodes
export {
  plannerNode,
  executorNode,
  executeDangerousToolNode,
  reflectorNode,
  simpleAgentNode,
  safeToolNode,
  humanApprovalNode,
  getCurrentStep,
  isAllStepsComplete,
  getProgressString,
} from "./nodes.js";

// Graph builders
export { 
  buildFullAgentGraph, 
  buildSimpleChatGraph, 
  createAgentGraph,
  buildFullAgent, // Legacy
} from "./graph.js";

// Session management
export { AgentSession, quickChat } from "./session.js";
