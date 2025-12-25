/**
 * ============================================================================
 * 📚 LANGGRAPH LEARNING PATH - FILE 5 OF 11
 * ============================================================================
 * 
 * 📖 WHAT IS THIS FILE?
 *    This is the PLANNER node - the first step in our agent's workflow.
 *    It analyzes the user's task and creates a step-by-step plan.
 * 
 * 📝 PREREQUISITES: Read state.js, config.js, llm.js, tools.js (1-4) first
 * 
 * ➡️  NEXT FILE: After understanding this, read executor.js (6/11)
 * 
 * ============================================================================
 * 
 * 🧠 WHAT IS THE PLANNER?
 * 
 * The Planner is the "strategist" of our agent. When a user gives a task:
 * 
 *   User: "Create a React todo app with authentication"
 * 
 * The Planner breaks it down into steps:
 * 
 *   Plan:
 *   1. Set up a new React project
 *   2. Create the Todo component
 *   3. Add state management
 *   4. Implement authentication
 *   5. Style the application
 * 
 * This is crucial because:
 *   - Complex tasks need structure
 *   - The Executor can focus on one step at a time
 *   - Progress can be tracked step by step
 *   - The Reflector can evaluate each step
 * 
 * ============================================================================
 */

import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import chalk from "chalk";

import { createPlannerLLM } from "./llm.js";
import { PLANNER_PROMPT } from "../../config/google.config.js";
import { getToolDescriptions } from "./tools.js";

// ============================================================================
// UNDERSTANDING NODES
// ============================================================================
/**
 * A "node" in LangGraph is just an async function that:
 *   1. Receives the current state
 *   2. Does some work
 *   3. Returns updates to the state
 * 
 * The node doesn't return the ENTIRE state, just the parts that changed.
 * LangGraph handles merging the updates with the existing state.
 * 
 * Basic structure:
 * 
 * async function myNode(state) {
 *   // Do something
 *   return {
 *     someField: newValue,  // This gets merged into state
 *   };
 * }
 */

// ============================================================================
// PLANNER NODE
// ============================================================================
/**
 * The Planner node analyzes the user's request and creates a structured plan.
 * 
 * Input: state.messages contains the user's request
 * Output: state.plan is populated with the structured plan
 * 
 * @param {Object} state - Current agent state
 * @returns {Object} State updates (plan, messages)
 */
export async function plannerNode(state) {
  console.log(chalk.cyan("\n📍 [Planner] Creating plan..."));
  
  try {
    // ─────────────────────────────────────────────────────────────────────────
    // STEP 1: GET THE USER'S REQUEST
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Find the user's message in the conversation history.
     * We look for the last HumanMessage to understand what they want.
     */
    const userMessages = state.messages.filter(
      (m) => m._getType() === "human" || m.constructor.name === "HumanMessage"
    );
    
    if (userMessages.length === 0) {
      return {
        error: "No user request found",
        plan: null,
      };
    }
    
    const userRequest = userMessages[userMessages.length - 1].content;
    console.log(chalk.gray(`   Task: "${userRequest.slice(0, 50)}..."`));
    
    // ─────────────────────────────────────────────────────────────────────────
    // STEP 2: PREPARE THE PROMPT
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * We construct a prompt that tells the Planner:
     *   - What its job is (PLANNER_PROMPT)
     *   - What tools are available
     *   - What the user wants
     */
    const toolDescriptions = getToolDescriptions();
    
    const systemPrompt = `${PLANNER_PROMPT}

## Available Tools:
${toolDescriptions}`;
    
    // ─────────────────────────────────────────────────────────────────────────
    // STEP 3: CALL THE LLM
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * We use a specialized Planner LLM with lower temperature
     * for more structured, consistent output.
     */
    const llm = createPlannerLLM();
    
    const response = await llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userRequest),
    ]);
    
    // ─────────────────────────────────────────────────────────────────────────
    // STEP 4: PARSE THE PLAN
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * The LLM should return JSON. We need to parse it.
     * If parsing fails, we try to extract JSON from the response.
     */
    let plan = null;
    
    try {
      // Try to parse the entire response as JSON
      plan = JSON.parse(response.content);
    } catch (e) {
      // Try to find JSON in the response (might be wrapped in markdown)
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          plan = JSON.parse(jsonMatch[0]);
        } catch (e2) {
          // Couldn't parse - create a simple single-step plan
          plan = {
            goal: userRequest,
            steps: [
              { id: 1, description: userRequest, tools_needed: [], status: "pending" }
            ],
            estimated_complexity: "simple",
          };
        }
      }
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // STEP 5: VALIDATE AND NORMALIZE THE PLAN
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Ensure the plan has the expected structure.
     * Add "status" to each step if not present.
     */
    if (plan && plan.steps) {
      plan.steps = plan.steps.map((step, idx) => ({
        id: step.id || idx + 1,
        description: step.description || step.task || "Unknown step",
        tools_needed: step.tools_needed || [],
        status: step.status || "pending",
      }));
    }
    
    // Log the plan
    console.log(chalk.green(`   ✅ Created plan with ${plan?.steps?.length || 0} steps`));
    if (plan?.steps) {
      plan.steps.forEach((step, idx) => {
        console.log(chalk.gray(`      ${idx + 1}. ${step.description.slice(0, 50)}...`));
      });
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // STEP 6: RETURN STATE UPDATES
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * We return:
     *   - plan: The structured plan
     *   - currentStep: Start at step 0 (first step)
     *   - iterations: Increment by 1
     * 
     * Note: We don't add a message here because the plan itself is the output.
     */
    return {
      plan,
      currentStep: 0,
      iterations: state.iterations + 1,
    };
    
  } catch (error) {
    console.error(chalk.red(`   ❌ Planner error: ${error.message}`));
    return {
      error: `Planner failed: ${error.message}`,
      plan: null,
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the current step from the plan
 * 
 * @param {Object} state - Agent state
 * @returns {Object|null} Current step or null
 */
export function getCurrentStep(state) {
  if (!state.plan || !state.plan.steps) return null;
  return state.plan.steps[state.currentStep];
}

/**
 * Check if all steps in the plan are complete
 * 
 * @param {Object} state - Agent state
 * @returns {boolean} True if all steps complete
 */
export function isAllStepsComplete(state) {
  if (!state.plan || !state.plan.steps) return true;
  
  return state.plan.steps.every(
    (step) => state.stepResults[step.id]?.success === true
  );
}

/**
 * Get progress as a string (e.g., "2/5")
 * 
 * @param {Object} state - Agent state
 * @returns {string} Progress string
 */
export function getProgressString(state) {
  if (!state.plan || !state.plan.steps) return "0/0";
  
  const completed = Object.values(state.stepResults).filter(r => r?.success).length;
  const total = state.plan.steps.length;
  
  return `${completed}/${total}`;
}

// ============================================================================
// 📝 WHAT'S NEXT?
// ============================================================================
/**
 * Great! You now understand:
 *   ✅ What a node is (async function that updates state)
 *   ✅ How the Planner works (analyzes task → creates steps)
 *   ✅ How to parse LLM output (JSON parsing with fallbacks)
 *   ✅ How to return state updates (just the changed parts)
 * 
 * ➡️  NEXT: Read executor.js (6/11) to see how steps are executed
 */
