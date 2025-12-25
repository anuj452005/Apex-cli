/**
 * ============================================================================
 * 📚 LANGGRAPH LEARNING PATH - FILE 9 OF 11
 * ============================================================================
 * 
 * 📖 WHAT IS THIS FILE?
 *    This is the GRAPH file - it builds the complete workflow by connecting
 *    all the nodes together with edges and conditional routing.
 * 
 * 📝 PREREQUISITES: Read state.js through nodes.js (1-8) first
 * 
 * ➡️  NEXT FILE: After understanding this, read session.js (10/11)
 * 
 * ============================================================================
 * 
 * 🧠 WHAT IS A GRAPH IN LANGGRAPH?
 * 
 * A LangGraph graph is like a flowchart that defines:
 *   - NODES: The steps/actions (functions that do work)
 *   - EDGES: The connections (which node runs after which)
 *   - CONDITIONS: Dynamic routing based on state
 * 
 * Once you build a graph, you "compile" it into a runnable object.
 * Then you can invoke it with input and it runs through the nodes.
 * 
 * ============================================================================
 */

import { StateGraph, START, END } from "@langchain/langgraph";
import chalk from "chalk";

import { AgentState } from "./state.js";
import {
  // Planner
  plannerNode,
  // Executor  
  executorNode,
  executeDangerousToolNode,
  // Reflector
  reflectorNode,
  // Simple agent for chat mode
  simpleAgentNode,
  // Shared nodes
  safeToolNode,
  humanApprovalNode,
  simpleDangerousToolNode,
  // Routing functions
  routeAfterSimpleAgent,
  routeAfterPlanner,
  routeAfterExecutor,
  routeAfterReflector,
} from "./nodes.js";

// ============================================================================
// UNDERSTANDING GRAPH BUILDING
// ============================================================================
/**
 * Building a graph involves:
 * 
 * 1. Create a StateGraph with your state schema
 * 2. Add nodes (named functions)
 * 3. Add edges (connections between nodes)
 * 4. Add conditional edges (dynamic routing)
 * 5. Compile the graph (with optional checkpointer for persistence)
 * 
 * The graph is immutable after compilation - you can't add more nodes.
 */

// ============================================================================
// FULL AGENT GRAPH (Planner → Executor → Reflector)
// ============================================================================
/**
 * Builds the complete agent graph with the Plan-Execute-Reflect pattern.
 * 
 * Graph Structure:
 * 
 *                    START
 *                      │
 *                      ▼
 *                  ┌───────┐
 *                  │Planner│
 *                  └───┬───┘
 *                      │
 *          ┌───────────┴───────────┐
 *          │    error?             │── END
 *          ▼                       │
 *      ┌────────┐                  │
 * ┌───▶│Executor│◀─────────────────┤
 * │    └───┬────┘                  │
 * │        │                       │
 * │    ┌───┴───┐                   │
 * │    │  Has pending tool?        │
 * │    ▼       ▼                   │
 * │ ┌──────┐ ┌─────────┐           │
 * │ │Reflect│ │Approval │           │
 * │ └──┬───┘ └────┬────┘           │
 * │    │          │                │
 * │ ┌──┴──┐       ▼                │
 * │ │continue│ ┌─────────┐         │
 * │ │retry   │ │Execute  │         │
 * │ └───┬────┘ │Dangerous│         │
 * │     │      └────┬────┘         │
 * │     ▼           │              │
 * └─────────────────┘              │
 *          │                       │
 *       finish/error ──────────────┘
 *          │
 *          ▼
 *         END
 * 
 * @param {Object} checkpointer - Optional checkpointer for persistence
 * @returns {CompiledGraph} Ready-to-use graph
 */
export function buildFullAgentGraph(checkpointer = null) {
  console.log(chalk.gray("📊 Building full agent graph..."));
  
  // ─────────────────────────────────────────────────────────────────────────
  // STEP 1: CREATE THE GRAPH
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * StateGraph takes your state annotation as the type parameter.
   * This ensures type safety and proper state merging.
   */
  const graph = new StateGraph(AgentState);
  
  // ─────────────────────────────────────────────────────────────────────────
  // STEP 2: ADD NODES
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Each node gets a unique name and the function to run.
   * The name is used in edges to reference the node.
   */
  graph.addNode("planner", plannerNode);
  graph.addNode("executor", executorNode);
  graph.addNode("reflector", reflectorNode);
  graph.addNode("human_approval", humanApprovalNode);
  graph.addNode("execute_dangerous", executeDangerousToolNode);
  
  // ─────────────────────────────────────────────────────────────────────────
  // STEP 3: ADD ENTRY EDGE
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * START is a special constant - it's where the graph begins.
   * This edge says: "Start by running the planner node"
   */
  graph.addEdge(START, "planner");
  
  // ─────────────────────────────────────────────────────────────────────────
  // STEP 4: ADD CONDITIONAL EDGES
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Conditional edges let you route dynamically based on state.
   * 
   * Format: graph.addConditionalEdges(fromNode, routingFunction, routeMap)
   * 
   * The routing function returns a string, and the routeMap maps
   * that string to the actual next node.
   */
  
  // After planner: go to executor or end (if error)
  graph.addConditionalEdges("planner", routeAfterPlanner, {
    execute: "executor",
    end: END,
  });
  
  // After executor: go to approval, reflector, or end
  graph.addConditionalEdges("executor", routeAfterExecutor, {
    needs_approval: "human_approval",
    reflect: "reflector",
    end: END,
  });
  
  // After reflector: continue/retry to executor, or end
  graph.addConditionalEdges("reflector", routeAfterReflector, {
    execute: "executor",
    end: END,
  });
  
  // ─────────────────────────────────────────────────────────────────────────
  // STEP 5: ADD REGULAR EDGES
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Regular edges always go from A to B (no conditions).
   */
  
  // After approval: execute the dangerous tool
  graph.addEdge("human_approval", "execute_dangerous");
  
  // After executing dangerous tool: back to reflector
  graph.addEdge("execute_dangerous", "reflector");
  
  // ─────────────────────────────────────────────────────────────────────────
  // STEP 6: COMPILE THE GRAPH
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Compiling "freezes" the graph and makes it runnable.
   * 
   * If you provide a checkpointer, the graph will:
   *   - Save state after each node
   *   - Allow resuming from the last checkpoint
   *   - Enable conversation memory across sessions
   */
  const compileOptions = {};
  if (checkpointer) {
    compileOptions.checkpointer = checkpointer;
  }
  
  console.log(chalk.green("   ✅ Full agent graph compiled"));
  return graph.compile(compileOptions);
}

// ============================================================================
// SIMPLE CHAT GRAPH (Without Planning)
// ============================================================================
/**
 * Builds a simpler graph for basic chat/tool use without planning.
 * 
 * Graph Structure:
 * 
 *         START
 *           │
 *           ▼
 *       ┌───────┐
 * ┌────▶│ Agent │◀────────┐
 * │     └───┬───┘         │
 * │         │             │
 * │     ┌───┴───┐         │
 * │     │ Route │         │
 * │     └┬──┬──┬┘         │
 * │      │  │  │          │
 * │      ▼  ▼  ▼          │
 * │   tools approval end  │
 * │      │  │             │
 * │      │  ▼             │
 * │      │ dangerous      │
 * │      │  │             │
 * └──────┴──┘             │
 *                         │
 *                      END
 * 
 * @param {Object} checkpointer - Optional checkpointer
 * @returns {CompiledGraph} Simple chat graph
 */
export function buildSimpleChatGraph(checkpointer = null) {
  console.log(chalk.gray("📊 Building simple chat graph..."));
  
  const graph = new StateGraph(AgentState);
  
  // Add nodes
  graph.addNode("agent", simpleAgentNode);
  graph.addNode("safe_tools", safeToolNode);
  graph.addNode("human_approval", humanApprovalNode);
  graph.addNode("execute_dangerous", simpleDangerousToolNode);
  
  // Entry point
  graph.addEdge(START, "agent");
  
  // After agent: route based on state
  graph.addConditionalEdges("agent", routeAfterSimpleAgent, {
    call_tools: "safe_tools",
    needs_approval: "human_approval",
    end: END,
  });
  
  // After safe tools: back to agent
  graph.addEdge("safe_tools", "agent");
  
  // After approval: execute the dangerous tool
  graph.addEdge("human_approval", "execute_dangerous");
  
  // After executing dangerous tool: back to agent
  graph.addEdge("execute_dangerous", "agent");
  
  // Compile
  const compileOptions = {};
  if (checkpointer) {
    compileOptions.checkpointer = checkpointer;
  }
  
  console.log(chalk.green("   ✅ Simple chat graph compiled"));
  return graph.compile(compileOptions);
}

// ============================================================================
// GRAPH FACTORY
// ============================================================================
/**
 * Factory function to create the appropriate graph based on mode.
 * 
 * @param {string} mode - "agent" for full planning, "chat" for simple chat
 * @param {Object} checkpointer - Optional checkpointer
 * @returns {CompiledGraph} The appropriate graph
 */
export function createAgentGraph(mode = "agent", checkpointer = null) {
  if (mode === "chat") {
    return buildSimpleChatGraph(checkpointer);
  }
  return buildFullAgentGraph(checkpointer);
}

// ============================================================================
// LEGACY EXPORT (Backward Compatibility)
// ============================================================================
/**
 * For backward compatibility with existing code that imports buildFullAgent.
 */
export const buildFullAgent = buildSimpleChatGraph;

// ============================================================================
// 📝 WHAT'S NEXT?
// ============================================================================
/**
 * Great! You now understand:
 *   ✅ What a LangGraph graph is (nodes + edges)
 *   ✅ How to add nodes to the graph
 *   ✅ How conditional edges enable dynamic routing
 *   ✅ How to compile a graph with optional checkpointing
 *   ✅ The difference between full agent and simple chat graphs
 * 
 * ➡️  NEXT: Read session.js (10/11) to see how sessions are managed
 */
