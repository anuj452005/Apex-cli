/**
 * LangGraph Graph Builder
 * 
 * Builds and compiles the complete agent graph.
 * 
 * Graph Structure:
 * 
 *              START
 *                │
 *                ▼
 *            ┌──agent◄───────────────┐
 *            │    │                  │
 *    ┌───────┼────┼────────┐         │
 *    │       │    │        │         │
 *    ▼       ▼    ▼        ▼         │
 * approve  tools error   END         │
 *    │       │                       │
 *    ▼       │                       │
 * execute    │                       │
 *    │       │                       │
 *    └───────┴───────────────────────┘
 */

import { StateGraph, START, END } from "@langchain/langgraph";

import { AgentState } from "./state.js";
import {
  agentNode,
  safeToolNode,
  humanApprovalNode,
  executeDangerousToolNode,
  routeAfterAgent,
} from "./nodes.js";

/**
 * Build the complete agent graph
 * @param {Object} checkpointer - Optional checkpointer for persistence
 * @returns {CompiledGraph} Compiled graph ready for invocation
 */
export function buildFullAgent(checkpointer = null) {
  const graph = new StateGraph(AgentState);

  // Add nodes
  graph.addNode("agent", agentNode);
  graph.addNode("safe_tools", safeToolNode);
  graph.addNode("human_approval", humanApprovalNode);
  graph.addNode("execute_dangerous", executeDangerousToolNode);

  // Entry point
  graph.addEdge(START, "agent");

  // After agent - route based on state
  graph.addConditionalEdges("agent", routeAfterAgent, {
    call_tools: "safe_tools",
    needs_approval: "human_approval",
    end: END,
  });

  // After safe tools - back to agent
  graph.addEdge("safe_tools", "agent");

  // After approval - execute the dangerous tool
  graph.addEdge("human_approval", "execute_dangerous");

  // After executing dangerous tool - back to agent
  graph.addEdge("execute_dangerous", "agent");

  // Compile with optional checkpointer
  const compileOptions = {};
  if (checkpointer) {
    compileOptions.checkpointer = checkpointer;
  }

  return graph.compile(compileOptions);
}
