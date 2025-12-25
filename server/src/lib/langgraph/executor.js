/**
 * ============================================================================
 * 📚 LANGGRAPH LEARNING PATH - FILE 6 OF 11
 * ============================================================================
 * 
 * 📖 WHAT IS THIS FILE?
 *    This is the EXECUTOR node - it carries out individual steps from the plan.
 *    It uses tools to actually DO things (create files, run commands, etc.)
 * 
 * 📝 PREREQUISITES: Read state.js through planner.js (1-5) first
 * 
 * ➡️  NEXT FILE: After understanding this, read reflector.js (7/11)
 * 
 * ============================================================================
 * 
 * 🧠 WHAT IS THE EXECUTOR?
 * 
 * The Executor is the "worker" of our agent. It takes ONE step at a time
 * and uses tools to complete it.
 * 
 * Example flow:
 * 
 *   Plan Step: "Create a file called hello.js"
 *            ↓
 *   Executor: Calls write_file tool with content
 *            ↓
 *   Result: { success: true, output: "Created hello.js" }
 * 
 * The Executor:
 *   - Focuses on ONE step only
 *   - Uses tools to do the work
 *   - Reports what happened
 *   - Doesn't decide what to do next (that's the Reflector's job)
 * 
 * ============================================================================
 */

import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import chalk from "chalk";

import { createExecutorLLM } from "./llm.js";
import { EXECUTOR_PROMPT } from "../../config/google.config.js";
import { allTools, safeTools, isDangerousTool, getToolByName, getToolDescriptions } from "./tools.js";
import { getCurrentStep, getProgressString } from "./planner.js";
import { config } from "../../config/google.config.js";

// ============================================================================
// UNDERSTANDING THE EXECUTOR
// ============================================================================
/**
 * The Executor is more complex than the Planner because it needs to:
 * 
 * 1. Get the current step from the plan
 * 2. Ask the LLM how to complete it
 * 3. Handle tool calls (safe vs dangerous)
 * 4. Execute tools and get results
 * 5. Loop if multiple tool calls needed
 * 6. Report the final result
 * 
 * This is where the "agentic" behavior happens - the LLM decides
 * which tools to use and how to use them.
 */

// Create a ToolNode for executing safe tools
const safeToolNode = new ToolNode(safeTools);

// ============================================================================
// EXECUTOR NODE
// ============================================================================
/**
 * The Executor node completes one step from the plan using available tools.
 * 
 * Input: state.plan and state.currentStep
 * Output: state.stepResults updated with this step's result
 * 
 * @param {Object} state - Current agent state
 * @returns {Object} State updates
 */
export async function executorNode(state) {
  const progress = getProgressString(state);
  console.log(chalk.cyan(`\n📍 [Executor] Step ${state.currentStep + 1} (${progress})`));
  
  try {
    // ─────────────────────────────────────────────────────────────────────────
    // STEP 1: GET THE CURRENT STEP
    // ─────────────────────────────────────────────────────────────────────────
    const currentStep = getCurrentStep(state);
    
    if (!currentStep) {
      // No more steps - we're done!
      console.log(chalk.green("   ✅ All steps complete!"));
      return {
        reflection: {
          assessment: "All steps completed",
          success: true,
          decision: "finish",
          reasoning: "No more steps in the plan",
        },
      };
    }
    
    console.log(chalk.gray(`   Step: "${currentStep.description.slice(0, 60)}..."`));
    
    // ─────────────────────────────────────────────────────────────────────────
    // STEP 2: CHECK IF ALREADY COMPLETED WITH RETRIES
    // ─────────────────────────────────────────────────────────────────────────
    const existingResult = state.stepResults[currentStep.id];
    if (existingResult?.retries >= config.maxRetries) {
      console.log(chalk.yellow(`   ⚠️ Max retries reached for this step`));
      return {
        stepResults: {
          [currentStep.id]: {
            ...existingResult,
            success: false,
            error: "Max retries reached",
          },
        },
        error: `Step ${currentStep.id} failed after ${config.maxRetries} retries`,
      };
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // STEP 2.5: CHECK FOR SIMPLE QUERY (DIRECT RESPONSE)
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * For simple queries, we use a simplified prompt that focuses on
     * responding naturally to the user's message without tool use.
     */
    const isSimpleQuery = state.plan?.query_type === "simple";
    
    // Get the original user message for context
    const userMessages = state.messages.filter(
      (m) => m._getType() === "human" || m.constructor.name === "HumanMessage"
    );
    const userMessage = userMessages.length > 0 
      ? userMessages[userMessages.length - 1].content 
      : "";
    
    if (isSimpleQuery) {
      console.log(chalk.cyan(`   💬 Simple query - generating direct response`));
      
      // For simple queries, use a direct response prompt
      const simplePrompt = `You are Apex, a friendly AI coding assistant.

The user said: "${userMessage}"

Respond naturally and conversationally. Be friendly and helpful.
- For greetings: Respond with a warm greeting and offer to help
- For "who are you": Briefly introduce yourself as Apex CLI agent
- For thanks: Acknowledge warmly
- Keep it concise but friendly`;
      
      const llm = createExecutorLLM([]);  // No tools needed
      
      const response = await llm.invoke([
        new SystemMessage(simplePrompt),
        new HumanMessage(userMessage),
      ]);
      
      console.log(chalk.green(`   ✅ Direct response generated`));
      
      return {
        messages: [response],
        stepResults: {
          [currentStep.id]: {
            success: true,
            output: response.content,
            retries: 0,
          },
        },
        iterations: state.iterations + 1,
      };
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // STEP 3: PREPARE THE PROMPT (for complex tasks)
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * We give the Executor context about:
     *   - The overall goal
     *   - The current step to execute
     *   - What tools are available
     *   - Results from previous steps (for context)
     */
    
    // Provide more complete previous results for analysis steps
    const previousResults = Object.entries(state.stepResults)
      .map(([id, result]) => {
        const status = result.success ? "✓ SUCCESS" : "✗ FAILED";
        const output = result.output || result.error || "(no output)";
        // Give more context - up to 1000 chars for each step
        return `Step ${id} ${status}:\n${output.slice(0, 1000)}`;
      })
      .join("\n\n");
    
    // Check if this is an analysis/synthesis step (no tools needed)
    const isAnalysisStep = currentStep.tools_needed?.length === 0 || 
      /analyze|summarize|present|explain|synthesize|review/i.test(currentStep.description);
    
    let contextPrompt;
    
    if (isAnalysisStep && previousResults) {
      // For analysis steps, emphasize using existing data
      contextPrompt = `${EXECUTOR_PROMPT}

## IMPORTANT: This is an ANALYSIS step
You should analyze and synthesize the information from Previous Results below.
DO NOT call any tools - just provide your analysis based on the data already collected.

## Overall Goal:
${state.plan?.goal || "Complete the user's request"}

## Current Step to Execute:
Step ${currentStep.id}: ${currentStep.description}

## Previous Results (USE THIS DATA):
${previousResults}

Based on the Previous Results above, provide a clear and helpful response.`;
    } else {
      // For tool-using steps
      contextPrompt = `${EXECUTOR_PROMPT}

## Available Tools:
${getToolDescriptions()}

## Overall Goal:
${state.plan?.goal || "Complete the user's request"}

## Current Step to Execute:
Step ${currentStep.id}: ${currentStep.description}

## Previous Results:
${previousResults || "No previous steps"}

Now complete this step using the appropriate tools.`;
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // STEP 4: CALL THE LLM WITH TOOLS
    // ─────────────────────────────────────────────────────────────────────────
    // For analysis steps, don't bind tools to prevent unnecessary tool calls
    const llm = isAnalysisStep ? createExecutorLLM([]) : createExecutorLLM(allTools);
    
    const response = await llm.invoke([
      new SystemMessage(contextPrompt),
      new HumanMessage(`Execute step ${currentStep.id}: ${currentStep.description}`),
    ]);
    
    // ─────────────────────────────────────────────────────────────────────────
    // STEP 5: HANDLE TOOL CALLS
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * The LLM might want to call tools. We need to:
     *   - Check if any tools are dangerous
     *   - Execute safe tools immediately
     *   - Queue dangerous tools for approval
     */
    if (response.tool_calls && response.tool_calls.length > 0) {
      // Check for dangerous tools first
      for (const toolCall of response.tool_calls) {
        if (isDangerousTool(toolCall.name)) {
          console.log(chalk.yellow(`   ⚠️ Dangerous tool: ${toolCall.name}`));
          
          // Store for approval
          return {
            messages: [response],
            pendingToolCall: {
              id: toolCall.id,
              name: toolCall.name,
              args: toolCall.args,
              stepId: currentStep.id,
            },
            iterations: state.iterations + 1,
          };
        }
      }
      
      // All tools are safe - execute them
      console.log(chalk.cyan(`   🔧 Executing: ${response.tool_calls.map(t => t.name).join(", ")}`));
      
      // Execute tools and collect results
      const toolResults = await executeTools(response.tool_calls);
      
      // Record success
      return {
        messages: [response, ...toolResults],
        stepResults: {
          [currentStep.id]: {
            success: true,
            output: toolResults.map(t => t.content).join("\n").slice(0, 500),
            retries: existingResult?.retries || 0,
          },
        },
        iterations: state.iterations + 1,
      };
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // STEP 6: NO TOOL CALLS - JUST A RESPONSE
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Sometimes the LLM just responds without using tools.
     * This is fine for steps that don't need tools.
     */
    console.log(chalk.gray(`   💬 Response without tools`));
    
    return {
      messages: [response],
      stepResults: {
        [currentStep.id]: {
          success: true,
          output: response.content.slice(0, 500),
          retries: existingResult?.retries || 0,
        },
      },
      iterations: state.iterations + 1,
    };
    
  } catch (error) {
    console.error(chalk.red(`   ❌ Executor error: ${error.message}`));
    
    const currentStep = getCurrentStep(state);
    const existingResult = state.stepResults[currentStep?.id];
    
    return {
      stepResults: {
        [currentStep?.id || 0]: {
          success: false,
          error: error.message,
          retries: (existingResult?.retries || 0) + 1,
        },
      },
      error: error.message,
      iterations: state.iterations + 1,
    };
  }
}

// ============================================================================
// HELPER: EXECUTE TOOLS
// ============================================================================
/**
 * Execute a list of tool calls and return the results.
 * 
 * @param {Array} toolCalls - Array of tool call objects
 * @returns {Array<ToolMessage>} Results as ToolMessages
 */
async function executeTools(toolCalls) {
  const results = [];
  
  for (const toolCall of toolCalls) {
    const tool = getToolByName(toolCall.name);
    
    if (!tool) {
      results.push(new ToolMessage({
        content: `Tool not found: ${toolCall.name}`,
        tool_call_id: toolCall.id,
        name: toolCall.name,
      }));
      continue;
    }
    
    try {
      const result = await tool.invoke(toolCall.args);
      results.push(new ToolMessage({
        content: result,
        tool_call_id: toolCall.id,
        name: toolCall.name,
      }));
      console.log(chalk.green(`      ✅ ${toolCall.name} completed`));
    } catch (error) {
      results.push(new ToolMessage({
        content: `Error: ${error.message}`,
        tool_call_id: toolCall.id,
        name: toolCall.name,
      }));
      console.log(chalk.red(`      ❌ ${toolCall.name} failed`));
    }
  }
  
  return results;
}

// ============================================================================
// EXECUTE DANGEROUS TOOL (After Approval)
// ============================================================================
/**
 * Execute a dangerous tool after user approval.
 * 
 * This is called after humanApprovalNode sets toolApproved = true.
 * 
 * @param {Object} state - Agent state
 * @returns {Object} State updates
 */
export async function executeDangerousToolNode(state) {
  console.log(chalk.cyan("\n📍 [Execute Dangerous Tool]"));
  
  const pending = state.pendingToolCall;
  
  if (!pending) {
    console.log(chalk.yellow("   No pending tool"));
    return { pendingToolCall: null };
  }
  
  // Check if approved
  if (!state.toolApproved) {
    console.log(chalk.red("   ❌ Tool was rejected"));
    
    return {
      messages: [
        new ToolMessage({
          content: "User rejected this action. Try a different approach.",
          tool_call_id: pending.id,
          name: pending.name,
        }),
      ],
      pendingToolCall: null,
      toolApproved: null,
      stepResults: {
        [pending.stepId]: {
          success: false,
          error: "User rejected the action",
          retries: (state.stepResults[pending.stepId]?.retries || 0) + 1,
        },
      },
    };
  }
  
  // Execute the tool
  console.log(chalk.green(`   ✅ Executing approved tool: ${pending.name}`));
  
  const tool = getToolByName(pending.name);
  
  if (!tool) {
    return {
      messages: [
        new ToolMessage({
          content: `Tool not found: ${pending.name}`,
          tool_call_id: pending.id,
          name: pending.name,
        }),
      ],
      pendingToolCall: null,
      toolApproved: null,
    };
  }
  
  try {
    const result = await tool.invoke(pending.args);
    
    return {
      messages: [
        new ToolMessage({
          content: result,
          tool_call_id: pending.id,
          name: pending.name,
        }),
      ],
      pendingToolCall: null,
      toolApproved: null,
      stepResults: {
        [pending.stepId]: {
          success: true,
          output: result.slice(0, 500),
          retries: state.stepResults[pending.stepId]?.retries || 0,
        },
      },
    };
  } catch (error) {
    return {
      messages: [
        new ToolMessage({
          content: `Error: ${error.message}`,
          tool_call_id: pending.id,
          name: pending.name,
        }),
      ],
      pendingToolCall: null,
      toolApproved: null,
      stepResults: {
        [pending.stepId]: {
          success: false,
          error: error.message,
          retries: (state.stepResults[pending.stepId]?.retries || 0) + 1,
        },
      },
      error: error.message,
    };
  }
}

// ============================================================================
// 📝 WHAT'S NEXT?
// ============================================================================
/**
 * Great! You now understand:
 *   ✅ How the Executor works (takes one step, uses tools)
 *   ✅ The difference between safe and dangerous tool execution
 *   ✅ How tool results are converted to ToolMessages
 *   ✅ How step results are tracked
 * 
 * ➡️  NEXT: Read reflector.js (7/11) to see how results are evaluated
 */
