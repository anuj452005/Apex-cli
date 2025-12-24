/**
 * Main Agent Graph
 * 
 * Complete LangGraph definition for the autonomous agent.
 * Orchestrates planning, execution, and reflection.
 */

import { StateGraph, START, END } from "@langchain/langgraph";
import { AgentState, createAgentState, SubtaskStatus } from "./state.js";
import { plannerNode } from "./planner.js";
import { executorNode, prepareSubtaskNode } from "./executor.js";
import { reflectorNode, routeAfterReflection } from "./reflector.js";
import { memoryCheckpointer } from "../shared/checkpointer.js";
import { AGENT_CONFIG } from "./config.js";

/**
 * Increment iteration counter
 */
function incrementIteration(state) {
  return { iteration: state.iteration + 1 };
}

/**
 * Complete the agent run
 */
function completeNode(state) {
  const { task, plan, history, metadata } = state;
  
  const successful = plan.subtasks.filter(
    st => st.status === SubtaskStatus.COMPLETED
  ).length;
  
  const total = plan.subtasks.length;

  return {
    result: {
      task,
      status: successful === total ? "completed" : "partial",
      summary: `Completed ${successful}/${total} subtasks`,
      subtasks: plan.subtasks.map(st => ({
        description: st.description,
        status: st.status,
      })),
    },
    plan: { ...plan, status: "completed" },
    metadata: {
      ...metadata,
      endTime: new Date().toISOString(),
    },
  };
}

/**
 * Route after planning
 */
function routeAfterPlanning(state) {
  const { plan, error } = state;
  
  if (error || !plan.subtasks.length) {
    return "complete";
  }
  return "prepare";
}

/**
 * Build the Agent Graph
 */
function buildAgentGraph() {
  const graph = new StateGraph(AgentState);

  // Add nodes
  graph.addNode("plan", plannerNode);
  graph.addNode("prepare", prepareSubtaskNode);
  graph.addNode("execute", executorNode);
  graph.addNode("reflect", reflectorNode);
  graph.addNode("increment", incrementIteration);
  graph.addNode("complete", completeNode);

  // Add edges
  graph.addEdge(START, "plan");
  
  graph.addConditionalEdges("plan", routeAfterPlanning, {
    prepare: "prepare",
    complete: "complete",
  });

  graph.addEdge("prepare", "execute");
  graph.addEdge("execute", "reflect");

  graph.addConditionalEdges("reflect", routeAfterReflection, {
    retry: "execute",
    continue: "increment",
    complete: "complete",
  });

  graph.addEdge("increment", "prepare");
  graph.addEdge("complete", END);

  return graph;
}

/**
 * Compiled Agent
 */
export const agentGraph = buildAgentGraph().compile({
  checkpointer: memoryCheckpointer,
});

/**
 * Agent Session
 */
export class AgentSession {
  constructor(sessionId = null) {
    this.sessionId = sessionId || `agent_${Date.now()}`;
  }

  async run(task, onProgress = null) {
    const initialState = createAgentState(task);

    const config = {
      configurable: { thread_id: this.sessionId },
    };

    // Stream for progress updates
    const events = [];
    
    for await (const chunk of await agentGraph.stream(initialState, config)) {
      events.push(chunk);
      if (onProgress) {
        onProgress(chunk);
      }
    }

    // Get final state
    const finalEvent = events[events.length - 1];
    return finalEvent?.complete || finalEvent;
  }
}

/**
 * Quick agent run
 */
export async function runAgent(task) {
  const session = new AgentSession();
  return await session.run(task);
}

export default agentGraph;
