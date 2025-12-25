
import { StateGraph, START, END } from "@langchain/langgraph";
import chalk from "chalk";

import { AgentState } from "./state.js";
import {

  plannerNode,

  executorNode,
  executeDangerousToolNode,

  reflectorNode,

  simpleAgentNode,

  safeToolNode,
  humanApprovalNode,
  simpleDangerousToolNode,

  routeAfterSimpleAgent,
  routeAfterPlanner,
  routeAfterExecutor,
  routeAfterReflector,
} from "./nodes.js";

export function buildFullAgentGraph(checkpointer = null) {
  console.log(chalk.gray("📊 Building full agent graph..."));

  const graph = new StateGraph(AgentState);

  graph.addNode("planner", plannerNode);
  graph.addNode("executor", executorNode);
  graph.addNode("reflector", reflectorNode);
  graph.addNode("human_approval", humanApprovalNode);
  graph.addNode("execute_dangerous", executeDangerousToolNode);

  graph.addEdge(START, "planner");

  graph.addConditionalEdges("planner", routeAfterPlanner, {
    execute: "executor",
    end: END,
  });

  graph.addConditionalEdges("executor", routeAfterExecutor, {
    needs_approval: "human_approval",
    reflect: "reflector",
    end: END,
  });

  graph.addConditionalEdges("reflector", routeAfterReflector, {
    execute: "executor",
    end: END,
  });

  graph.addEdge("human_approval", "execute_dangerous");

  graph.addEdge("execute_dangerous", "reflector");

  const compileOptions = {};
  if (checkpointer) {
    compileOptions.checkpointer = checkpointer;
  }

  console.log(chalk.green("   ✅ Full agent graph compiled"));
  return graph.compile(compileOptions);
}

export function buildSimpleChatGraph(checkpointer = null) {
  console.log(chalk.gray("📊 Building simple chat graph..."));

  const graph = new StateGraph(AgentState);

  graph.addNode("agent", simpleAgentNode);
  graph.addNode("safe_tools", safeToolNode);
  graph.addNode("human_approval", humanApprovalNode);
  graph.addNode("execute_dangerous", simpleDangerousToolNode);

  graph.addEdge(START, "agent");

  graph.addConditionalEdges("agent", routeAfterSimpleAgent, {
    call_tools: "safe_tools",
    needs_approval: "human_approval",
    end: END,
  });

  graph.addEdge("safe_tools", "agent");

  graph.addEdge("human_approval", "execute_dangerous");

  graph.addEdge("execute_dangerous", "agent");

  const compileOptions = {};
  if (checkpointer) {
    compileOptions.checkpointer = checkpointer;
  }

  console.log(chalk.green("   ✅ Simple chat graph compiled"));
  return graph.compile(compileOptions);
}

export function createAgentGraph(mode = "agent", checkpointer = null) {
  if (mode === "chat") {
    return buildSimpleChatGraph(checkpointer);
  }
  return buildFullAgentGraph(checkpointer);
}

export const buildFullAgent = buildSimpleChatGraph;
