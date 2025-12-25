
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import chalk from "chalk";

import { createReflectorLLM } from "./llm.js";
import { REFLECTOR_PROMPT } from "../../config/google.config.js";
import { getCurrentStep, getProgressString, isAllStepsComplete } from "./planner.js";
import { config } from "../../config/google.config.js";

export async function reflectorNode(state) {
  const progress = getProgressString(state);
  console.log(chalk.magenta(`\n📍 [Reflector] Evaluating (${progress})...`));

  try {

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

    const llm = createReflectorLLM();

    const response = await llm.invoke([
      new SystemMessage(contextPrompt),
      new HumanMessage("Evaluate the step result and provide your decision."),
    ]);

    let reflection = null;

    try {
      reflection = JSON.parse(response.content);
    } catch (e) {

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          reflection = JSON.parse(jsonMatch[0]);
        } catch (e2) {

          reflection = {
            assessment: stepResult.success ? "Step completed" : "Step failed",
            success: stepResult.success,
            decision: stepResult.success ? "continue" : "retry",
            reasoning: "Could not parse LLM response, using default logic",
          };
        }
      }
    }

    reflection = {
      assessment: reflection?.assessment || "Unknown",
      success: reflection?.success ?? stepResult.success,
      decision: reflection?.decision || (stepResult.success ? "continue" : "retry"),
      reasoning: reflection?.reasoning || "No reasoning provided",
      modification: reflection?.modification || null,
    };

    let stateUpdates = {
      reflection,
      iterations: state.iterations + 1,
    };

    switch (reflection.decision) {
      case "continue":

        console.log(chalk.green(`   ✅ Continue → Step ${state.currentStep + 2}`));
        stateUpdates.currentStep = state.currentStep + 1;
        stateUpdates.error = null;
        break;

      case "retry":

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

      console.log(chalk.gray(`🔀 Routing to: executor (default)`));
      return "execute";
  }
}
