
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import chalk from "chalk";

import { createPlannerLLM } from "./llm.js";
import { PLANNER_PROMPT } from "../../config/google.config.js";
import { getToolDescriptions } from "./tools.js";

export async function plannerNode(state) {
  console.log(chalk.cyan("\n📍 [Planner] Creating plan..."));

  try {

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

    const simplePatterns = [
      /^(hi|hey|hello|helo|hola|yo)[\s!.,?]*$/i,
      /^good\s*(morning|afternoon|evening|night)[\s!.,?]*$/i,
      /^(hi|hey|hello)\s*(there|buddy|friend)?[\s!.,?]*$/i,
      /^(how\s*are\s*you|how's\s*it\s*going|what's\s*up|sup)[\s!.,?]*$/i,
      /^(thanks|thank\s*you|thx|ty)[\s!.,?]*$/i,
      /^(ok|okay|got\s*it|understood|sure|yep|yes|no)[\s!.,?]*$/i,
      /^(who|what)\s*(are\s*you|is\s*this)[\s!.,?]*$/i,
      /^what\s*(can\s*you\s*do|do\s*you\s*do)[\s!.,?]*$/i,
    ];

    const isSimpleQuery = simplePatterns.some(pattern => pattern.test(userRequest.trim()));

    if (isSimpleQuery) {
      console.log(chalk.green(`   ✅ Simple query detected - responding directly`));

      const simplePlan = {
        goal: "Respond to user's message",
        query_type: "simple",
        steps: [
          { id: 1, description: "Respond directly to the user", tools_needed: [], status: "pending" }
        ],
        estimated_complexity: "simple",
      };

      return {
        plan: simplePlan,
        currentStep: 0,
        iterations: state.iterations + 1,
      };
    }

    const toolDescriptions = getToolDescriptions();

    const systemPrompt = `${PLANNER_PROMPT}

## Available Tools:
${toolDescriptions}`;

    const llm = createPlannerLLM();

    const response = await llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userRequest),
    ]);

    let plan = null;

    try {

      plan = JSON.parse(response.content);
    } catch (e) {

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          plan = JSON.parse(jsonMatch[0]);
        } catch (e2) {

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

    if (plan && plan.steps) {
      plan.steps = plan.steps.map((step, idx) => ({
        id: step.id || idx + 1,
        description: step.description || step.task || "Unknown step",
        tools_needed: step.tools_needed || [],
        status: step.status || "pending",
      }));
    }

    console.log(chalk.green(`   ✅ Created plan with ${plan?.steps?.length || 0} steps`));
    if (plan?.steps) {
      plan.steps.forEach((step, idx) => {
        console.log(chalk.gray(`      ${idx + 1}. ${step.description.slice(0, 50)}...`));
      });
    }

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

export function getCurrentStep(state) {
  if (!state.plan || !state.plan.steps) return null;
  return state.plan.steps[state.currentStep];
}

export function isAllStepsComplete(state) {
  if (!state.plan || !state.plan.steps) return true;

  return state.plan.steps.every(
    (step) => state.stepResults[step.id]?.success === true
  );
}

export function getProgressString(state) {
  if (!state.plan || !state.plan.steps) return "0/0";

  const completed = Object.values(state.stepResults).filter(r => r?.success).length;
  const total = state.plan.steps.length;

  return `${completed}/${total}`;
}
