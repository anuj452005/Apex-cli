/**
 * ============================================================================
 * 📚 LANGGRAPH LEARNING PATH - FILE 7 OF 11
 * ============================================================================
 * 
 * 📖 WHAT IS THIS FILE?
 *    This is the REFLECTOR node - it evaluates what the Executor did and
 *    decides what to do next (continue, retry, or finish).
 * 
 * 📝 PREREQUISITES: Read state.js through executor.js (1-6) first
 * 
 * ➡️  NEXT FILE: After understanding this, read nodes.js (8/11)
 * 
 * ============================================================================
 * 
 * 🧠 WHAT IS THE REFLECTOR?
 * 
 * The Reflector is the "critic" and "decision maker" of our agent.
 * After each step is executed, the Reflector:
 * 
 *   1. Evaluates: Did the step succeed?
 *   2. Analyzes: What went right/wrong?
 *   3. Decides: What should happen next?
 * 
 * Possible decisions:
 *   - "continue" → Move to the next step
 *   - "retry" → Try the current step again
 *   - "finish" → All done, stop the agent
 *   - "error" → Unrecoverable error, stop and report
 * 
 * This pattern is called "self-reflection" and makes agents smarter
 * because they can learn from their mistakes!
 * 
 * ============================================================================
 */

import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import chalk from "chalk";

import { createReflectorLLM } from "./llm.js";
import { REFLECTOR_PROMPT } from "../../config/google.config.js";
import { getCurrentStep, getProgressString, isAllStepsComplete } from "./planner.js";
import { config } from "../../config/google.config.js";

// ============================================================================
// REFLECTOR NODE
// ============================================================================
/**
 * The Reflector node evaluates the latest execution and decides next action.
 * 
 * Input: state.stepResults, state.currentStep, state.plan
 * Output: state.reflection (assessment + decision), possibly state.currentStep
 * 
 * @param {Object} state - Current agent state
 * @returns {Object} State updates
 */
export async function reflectorNode(state) {
  const progress = getProgressString(state);
  console.log(chalk.magenta(`\n📍 [Reflector] Evaluating (${progress})...`));
  
  try {
    // ─────────────────────────────────────────────────────────────────────────
    // STEP 1: CHECK FOR QUICK EXITS
    // ─────────────────────────────────────────────────────────────────────────
    
    // Check iteration limit
    if (state.iterations >= config.maxIterations) {
      console.log(chalk.yellow("   ⚠️ Max iterations reached"));
      return {
        reflection: {
          assessment: "Reached maximum iterations",
          success: false,
          decision: "error",
          reasoning: "The agent has reached its maximum iteration limit",
        },
      };
    }
    
    // Check for errors
    if (state.error) {
      console.log(chalk.red(`   ❌ Error in state: ${state.error}`));
      return {
        reflection: {
          assessment: `Error occurred: ${state.error}`,
          success: false,
          decision: "error",
          reasoning: "An error prevented successful completion",
        },
      };
    }
    
    // Check if all steps are already complete
    if (isAllStepsComplete(state)) {
      console.log(chalk.green("   ✅ All steps complete!"));
      return {
        reflection: {
          assessment: "All planned steps have been completed successfully",
          success: true,
          decision: "finish",
          reasoning: "Every step in the plan has been executed successfully",
        },
      };
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // STEP 1.5: QUICK FINISH FOR SIMPLE QUERIES
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * For simple queries (greetings, small talk), we skip the LLM reflection
     * and immediately mark as finished if the step was successful.
     */
    const isSimpleQuery = state.plan?.query_type === "simple";
    const currentStep = getCurrentStep(state);
    const stepResult = currentStep ? state.stepResults[currentStep.id] : null;
    
    if (isSimpleQuery && stepResult?.success) {
      console.log(chalk.green("   ✅ Simple query completed successfully"));
      return {
        reflection: {
          assessment: "Direct response provided successfully",
          success: true,
          decision: "finish",
          reasoning: "Simple query handled with direct response",
        },
      };
    }
    
    if (!stepResult) {
      // No result yet - step hasn't been executed
      console.log(chalk.gray("   No result yet for current step"));
      return {
        reflection: {
          assessment: "Current step has not been executed yet",
          success: false,
          decision: "continue",
          reasoning: "Need to execute the current step first",
        },
      };
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // STEP 3: PREPARE CONTEXT FOR LLM
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * We give the Reflector all the context it needs:
     *   - The overall goal
     *   - The current step that was executed
     *   - The result of that execution
     *   - How many retries have been used
     */
    const contextPrompt = `${REFLECTOR_PROMPT}

## Overall Goal:
${state.plan?.goal || "Complete the user's request"}

## Current Step (${state.currentStep + 1}/${state.plan?.steps?.length || 1}):
${currentStep?.description || "Unknown step"}

## Step Result:
Success: ${stepResult.success}
${stepResult.output ? `Output: ${stepResult.output}` : ""}
${stepResult.error ? `Error: ${stepResult.error}` : ""}

## Retries Used:
${stepResult.retries || 0} of ${config.maxRetries} max retries

## Remaining Steps:
${state.plan?.steps?.slice(state.currentStep + 1).map(s => `- ${s.description}`).join("\n") || "None"}

Now evaluate this result and decide what to do next.`;
    
    // ─────────────────────────────────────────────────────────────────────────
    // STEP 4: CALL THE REFLECTOR LLM
    // ─────────────────────────────────────────────────────────────────────────
    const llm = createReflectorLLM();
    
    const response = await llm.invoke([
      new SystemMessage(contextPrompt),
      new HumanMessage("Evaluate the step result and provide your decision."),
    ]);
    
    // ─────────────────────────────────────────────────────────────────────────
    // STEP 5: PARSE THE REFLECTION
    // ─────────────────────────────────────────────────────────────────────────
    let reflection = null;
    
    try {
      reflection = JSON.parse(response.content);
    } catch (e) {
      // Try to extract JSON from the response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          reflection = JSON.parse(jsonMatch[0]);
        } catch (e2) {
          // Default based on step result
          reflection = {
            assessment: stepResult.success ? "Step completed" : "Step failed",
            success: stepResult.success,
            decision: stepResult.success ? "continue" : "retry",
            reasoning: "Could not parse LLM response, using default logic",
          };
        }
      }
    }
    
    // Validate and normalize the reflection
    reflection = {
      assessment: reflection?.assessment || "Unknown",
      success: reflection?.success ?? stepResult.success,
      decision: reflection?.decision || (stepResult.success ? "continue" : "retry"),
      reasoning: reflection?.reasoning || "No reasoning provided",
      modification: reflection?.modification || null,
    };
    
    // ─────────────────────────────────────────────────────────────────────────
    // STEP 6: ACT ON THE DECISION
    // ─────────────────────────────────────────────────────────────────────────
    let stateUpdates = {
      reflection,
      iterations: state.iterations + 1,
    };
    
    switch (reflection.decision) {
      case "continue":
        // Move to next step
        console.log(chalk.green(`   ✅ Continue → Step ${state.currentStep + 2}`));
        stateUpdates.currentStep = state.currentStep + 1;
        stateUpdates.error = null; // Clear any error
        break;
        
      case "retry":
        // Keep same step, but check retry limit
        const retries = stepResult.retries || 0;
        if (retries >= config.maxRetries) {
          console.log(chalk.red(`   ❌ Max retries reached`));
          stateUpdates.reflection = {
            ...reflection,
            decision: "error",
            reasoning: "Exceeded maximum retry attempts",
          };
        } else {
          console.log(chalk.yellow(`   🔄 Retry (${retries + 1}/${config.maxRetries})`));
          // Clear the failed result to retry
          stateUpdates.stepResults = {
            [currentStep.id]: {
              ...stepResult,
              success: false,
              retries: retries + 1,
            },
          };
        }
        break;
        
      case "finish":
        console.log(chalk.green("   🎉 Finished!"));
        break;
        
      case "error":
        console.log(chalk.red(`   ❌ Error: ${reflection.reasoning}`));
        stateUpdates.error = reflection.reasoning;
        break;
        
      default:
        console.log(chalk.yellow(`   ⚠️ Unknown decision: ${reflection.decision}`));
        stateUpdates.reflection.decision = "continue";
    }
    
    return stateUpdates;
    
  } catch (error) {
    console.error(chalk.red(`   ❌ Reflector error: ${error.message}`));
    return {
      reflection: {
        assessment: "Reflector encountered an error",
        success: false,
        decision: "error",
        reasoning: error.message,
      },
      error: error.message,
    };
  }
}

// ============================================================================
// HELPER: ROUTING FUNCTIONS
// ============================================================================
/**
 * Routing functions are used by LangGraph to decide which node to run next.
 * They look at the current state and return a string indicating the route.
 */

/**
 * Route after the Reflector node.
 * 
 * Based on the reflection's decision, go to:
 *   - "continue" or "retry" → back to executor
 *   - "finish" or "error" → end the graph
 * 
 * @param {Object} state - Current state
 * @returns {string} Route name
 */
export function routeAfterReflector(state) {
  const decision = state.reflection?.decision;
  
  switch (decision) {
    case "continue":
    case "retry":
      console.log(chalk.gray(`🔀 Routing to: executor`));
      return "execute";
      
    case "finish":
    case "error":
      console.log(chalk.gray(`🔀 Routing to: end`));
      return "end";
      
    default:
      // Default to continue if unknown
      console.log(chalk.gray(`🔀 Routing to: executor (default)`));
      return "execute";
  }
}

// ============================================================================
// 📝 WHAT'S NEXT?
// ============================================================================
/**
 * Great! You now understand:
 *   ✅ How the Reflector evaluates execution results
 *   ✅ The four decisions: continue, retry, finish, error
 *   ✅ How retry limits prevent infinite loops
 *   ✅ How routing functions work in LangGraph
 * 
 * ➡️  NEXT: Read nodes.js (8/11) to see how all nodes work together
 */
