/**
 * ============================================================================
 * 📚 LANGGRAPH LEARNING PATH - FILE 3 OF 11
 * ============================================================================
 * 
 * 📖 WHAT IS THIS FILE?
 *    This is the LLM file - sets up the AI model that powers the agent.
 *    It connects to Google's Gemini API and binds tools to the model.
 * 
 * 📝 PREREQUISITES: Read state.js (1/11) and config.js (2/11) first
 * 
 * ➡️  NEXT FILE: After understanding this, read tools.js (4/11)
 * 
 * ============================================================================
 * 
 * 🧠 WHAT IS AN LLM IN LANGGRAPH?
 * 
 * The LLM (Large Language Model) is the "brain" of your agent.
 * In LangGraph, you:
 *   1. Create an LLM client (connects to the API)
 *   2. Optionally bind tools to it (so it can call functions)
 *   3. Use it in nodes to generate responses
 * 
 * "Binding tools" means telling the LLM what tools exist so it can
 * choose to call them when appropriate.
 * 
 * ============================================================================
 */

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { config, SYSTEM_PROMPT } from "../../config/google.config.js";

// ============================================================================
// UNDERSTANDING LLM CREATION
// ============================================================================
/**
 * Creating an LLM in LangChain/LangGraph involves:
 * 
 * 1. Choosing a provider (Google, OpenAI, Anthropic, etc.)
 * 2. Setting configuration (model name, temperature, etc.)
 * 3. Providing authentication (API key)
 * 
 * The LLM object can then be used to:
 *   - Generate text: llm.invoke("Hello!")
 *   - Have conversations: llm.invoke([messages])
 *   - Call tools: llm.invoke(messages) → returns tool_calls
 */

// ============================================================================
// BASE LLM (Without Tools)
// ============================================================================
/**
 * Creates a base LLM without any tools bound.
 * 
 * Use this for simple chat or when tools aren't needed.
 * 
 * @returns {ChatGoogleGenerativeAI} The configured LLM
 * 
 * @example
 * const llm = createBaseLLM();
 * const response = await llm.invoke("What is 2+2?");
 * console.log(response.content); // "2 + 2 = 4"
 */
export function createBaseLLM() {
  // ─────────────────────────────────────────────────────────────────────────
  // API KEY CHECK
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * The API key is required to connect to Google's API.
   * Without it, all requests will fail.
   * 
   * Users set it with: apex config set GOOGLE_API_KEY your-key-here
   */
  if (!config.googleApiKey) {
    throw new Error(
      "Google API key not configured. Run: apex config set GOOGLE_API_KEY <your-key>"
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CREATE THE LLM
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * ChatGoogleGenerativeAI is LangChain's client for Google's Gemini models.
   * 
   * Key options:
   *   - model: Which Gemini model to use
   *   - apiKey: Your Google API key
   *   - temperature: Randomness (0 = focused, 1 = creative)
   *   - maxOutputTokens: Maximum response length
   */
  return new ChatGoogleGenerativeAI({
    model: config.model,
    apiKey: config.googleApiKey,
    temperature: config.temperature,
    maxOutputTokens: config.maxOutputTokens,
  });
}

// ============================================================================
// LLM WITH TOOLS
// ============================================================================
/**
 * Creates an LLM with tools bound to it.
 * 
 * When you bind tools to an LLM:
 *   1. The LLM knows what tools are available
 *   2. It can choose to call them in its response
 *   3. The response includes "tool_calls" with function name and arguments
 * 
 * @param {Array} tools - Array of tool definitions
 * @returns {ChatGoogleGenerativeAI} LLM with tools bound
 * 
 * @example
 * const tools = [readFileTool, writeFileTool];
 * const llm = createLLMWithTools(tools);
 * 
 * const response = await llm.invoke("Read the file README.md");
 * // response.tool_calls = [{ name: "read_file", args: { path: "README.md" }}]
 */
export function createLLMWithTools(tools) {
  const baseLLM = createBaseLLM();
  
  // ─────────────────────────────────────────────────────────────────────────
  // BINDING TOOLS
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * .bindTools() tells the LLM about available tools.
   * 
   * Behind the scenes, this:
   *   1. Converts tool schemas to the format the API expects
   *   2. Includes tool descriptions in every request
   *   3. Enables the model to return tool_calls in responses
   * 
   * The LLM will decide when to use tools based on the user's request.
   */
  return baseLLM.bindTools(tools);
}

// ============================================================================
// SPECIALIZED LLMs FOR EACH AGENT ROLE
// ============================================================================
/**
 * In our Planner/Executor/Reflector architecture, each role has a 
 * specialized job. We can create optimized LLMs for each.
 */

/**
 * Create an LLM optimized for the Planner role.
 * 
 * The Planner needs to:
 *   - Analyze tasks carefully
 *   - Output structured JSON plans
 *   - Be more deterministic (lower temperature)
 * 
 * @returns {ChatGoogleGenerativeAI} Planner-optimized LLM
 */
export function createPlannerLLM() {
  if (!config.googleApiKey) {
    throw new Error("Google API key not configured.");
  }

  return new ChatGoogleGenerativeAI({
    model: config.model,
    apiKey: config.googleApiKey,
    temperature: 0.3, // Lower temperature for more structured output
    maxOutputTokens: config.maxOutputTokens,
  });
}

/**
 * Create an LLM optimized for the Executor role.
 * 
 * The Executor needs to:
 *   - Use tools effectively
 *   - Focus on completing specific tasks
 *   - Balance creativity and reliability
 * 
 * @param {Array} tools - Available tools
 * @returns {ChatGoogleGenerativeAI} Executor-optimized LLM with tools
 */
export function createExecutorLLM(tools) {
  if (!config.googleApiKey) {
    throw new Error("Google API key not configured.");
  }

  const llm = new ChatGoogleGenerativeAI({
    model: config.model,
    apiKey: config.googleApiKey,
    temperature: 0.5, // Balanced for task execution
    maxOutputTokens: config.maxOutputTokens,
  });

  return llm.bindTools(tools);
}

/**
 * Create an LLM optimized for the Reflector role.
 * 
 * The Reflector needs to:
 *   - Evaluate results critically
 *   - Make consistent decisions
 *   - Output structured JSON assessments
 * 
 * @returns {ChatGoogleGenerativeAI} Reflector-optimized LLM
 */
export function createReflectorLLM() {
  if (!config.googleApiKey) {
    throw new Error("Google API key not configured.");
  }

  return new ChatGoogleGenerativeAI({
    model: config.model,
    apiKey: config.googleApiKey,
    temperature: 0.2, // Very low for consistent evaluations
    maxOutputTokens: 1024, // Reflections are usually shorter
  });
}

// ============================================================================
// EXPORTED SYSTEM PROMPT
// ============================================================================
/**
 * Re-export the system prompt for easy access.
 * This is the default personality/instructions for the AI.
 */
export { SYSTEM_PROMPT };

// ============================================================================
// 📝 WHAT'S NEXT?
// ============================================================================
/**
 * Great! You now understand:
 *   ✅ How to create an LLM client (ChatGoogleGenerativeAI)
 *   ✅ What "binding tools" means (telling LLM what functions exist)
 *   ✅ How to create specialized LLMs for different roles
 * 
 * ➡️  NEXT: Read tools.js (4/11) to see how tools are defined
 */
