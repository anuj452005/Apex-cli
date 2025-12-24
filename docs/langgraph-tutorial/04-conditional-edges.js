/**
 * ============================================================
 * 04 - Conditional Edges: Routing and Decision Making
 * ============================================================
 * 
 * Learn how to make your graph dynamic with conditional routing.
 * 
 * LEARNING GOALS:
 * - Use addConditionalEdges
 * - Create routing functions
 * - Build branching workflows
 * - Handle multiple paths
 */

import { StateGraph, START, END, Annotation } from "@langchain/langgraph";

// ============================================================
// SCENARIO: Intent Classification
// ============================================================
/**
 * We'll build a graph that routes messages based on intent:
 * - Technical questions → technical_support
 * - Billing questions → billing_support
 * - Other → general_support
 * 
 * Graph Structure:
 * 
 *        START
 *          │
 *          ▼
 *      classify
 *          │
 *    ┌─────┼─────┐
 *    ▼     ▼     ▼
 *  tech  billing general
 *    │     │     │
 *    └─────┼─────┘
 *          ▼
 *       respond
 *          │
 *          ▼
 *         END
 */

// ============================================================
// STEP 1: DEFINE STATE
// ============================================================

const SupportState = Annotation.Root({
  // User's message
  userMessage: Annotation({
    reducer: (_, update) => update,
    default: () => "",
  }),

  // Classified intent
  intent: Annotation({
    reducer: (_, update) => update,
    default: () => null,  // null = not classified yet
  }),

  // Generated response
  response: Annotation({
    reducer: (_, update) => update,
    default: () => "",
  }),

  // Support data collected
  supportData: Annotation({
    reducer: (curr, update) => ({ ...curr, ...update }),
    default: () => ({}),
  }),
});

// ============================================================
// STEP 2: DEFINE NODES
// ============================================================

/**
 * NODE: Classify the user's intent
 * 
 * In a real app, you'd use an LLM for this.
 * Here we use simple keyword matching for demonstration.
 */
async function classifyNode(state) {
  console.log("📍 classifyNode");
  console.log(`   Message: "${state.userMessage}"`);

  const message = state.userMessage.toLowerCase();
  let intent;

  // Simple keyword-based classification
  if (message.includes("bug") || message.includes("error") || message.includes("code") || message.includes("api")) {
    intent = "technical";
  } else if (message.includes("bill") || message.includes("payment") || message.includes("invoice") || message.includes("price")) {
    intent = "billing";
  } else {
    intent = "general";
  }

  console.log(`   Classified as: ${intent}`);

  return {
    intent: intent,
  };
}

/**
 * NODE: Handle technical support
 */
async function technicalSupportNode(state) {
  console.log("📍 technicalSupportNode");

  return {
    response: "🔧 Technical Support: I'll help you with your technical issue. " +
              "Please provide more details about the error you're experiencing.",
    supportData: {
      department: "technical",
      priority: "high",
      ticketType: "bug_report",
    },
  };
}

/**
 * NODE: Handle billing support
 */
async function billingSupportNode(state) {
  console.log("📍 billingSupportNode");

  return {
    response: "💳 Billing Support: I can help with your billing question. " +
              "Let me look up your account information.",
    supportData: {
      department: "billing",
      priority: "medium",
      ticketType: "billing_inquiry",
    },
  };
}

/**
 * NODE: Handle general inquiries
 */
async function generalSupportNode(state) {
  console.log("📍 generalSupportNode");

  return {
    response: "📋 General Support: Thank you for reaching out! " +
              "How can I assist you today?",
    supportData: {
      department: "general",
      priority: "normal",
      ticketType: "inquiry",
    },
  };
}

/**
 * NODE: Final response formatting
 */
async function respondNode(state) {
  console.log("📍 respondNode");

  // Add ticket number to response
  const ticketNumber = `TKT-${Date.now().toString().slice(-6)}`;

  return {
    response: `${state.response}\n\n📋 Ticket: ${ticketNumber}`,
    supportData: {
      ticketNumber: ticketNumber,
      timestamp: new Date().toISOString(),
    },
  };
}

// ============================================================
// STEP 3: DEFINE ROUTING FUNCTION
// ============================================================

/**
 * ROUTING FUNCTION
 * 
 * This function determines which node to go to next.
 * It receives the current state and returns a string
 * that matches one of the paths defined in the conditional edges.
 */
function routeByIntent(state) {
  console.log("🔀 Routing based on intent:", state.intent);

  // Return a string that matches a key in the route map
  switch (state.intent) {
    case "technical":
      return "technical";
    case "billing":
      return "billing";
    default:
      return "general";
  }
}

// ============================================================
// STEP 4: BUILD THE GRAPH
// ============================================================

function buildSupportGraph() {
  const graph = new StateGraph(SupportState);

  // Add all nodes
  graph.addNode("classify", classifyNode);
  graph.addNode("technical", technicalSupportNode);
  graph.addNode("billing", billingSupportNode);
  graph.addNode("general", generalSupportNode);
  graph.addNode("respond", respondNode);

  // START → classify
  graph.addEdge(START, "classify");

  // CONDITIONAL EDGES after classification
  // Syntax: addConditionalEdges(sourceNode, routingFunction, pathMap)
  graph.addConditionalEdges(
    "classify",        // Source node
    routeByIntent,     // Routing function
    {
      // Route map: { returnValue: targetNode }
      "technical": "technical",
      "billing": "billing",
      "general": "general",
    }
  );

  // All support nodes → respond
  graph.addEdge("technical", "respond");
  graph.addEdge("billing", "respond");
  graph.addEdge("general", "respond");

  // respond → END
  graph.addEdge("respond", END);

  return graph.compile();
}

// ============================================================
// STEP 5: TEST THE ROUTING
// ============================================================

async function main() {
  console.log("🚀 Conditional Edges Example - Support Router\n");
  console.log("=".repeat(50));

  const supportBot = buildSupportGraph();

  // Test different intents
  const testMessages = [
    "I found a bug in the API, it returns 500 error",
    "I need help with my invoice from last month",
    "Hello, I have a question about your services",
  ];

  for (const message of testMessages) {
    console.log("\n" + "=".repeat(50));
    console.log(`\n👤 User: "${message}"\n`);

    const result = await supportBot.invoke({
      userMessage: message,
    });

    console.log(`\n🤖 Response: ${result.response}`);
    console.log(`\n📊 Support Data:`, result.supportData);
  }
}

main().catch(console.error);

// ============================================================
// ADVANCED: Multiple Conditions
// ============================================================

/**
 * You can also use conditional edges for loops:
 * 
 * function shouldContinue(state) {
 *   if (state.attempts >= 3) return "give_up";
 *   if (state.success) return "done";
 *   return "retry";
 * }
 * 
 * graph.addConditionalEdges("process", shouldContinue, {
 *   "retry": "process",  // Loop back!
 *   "done": "success",
 *   "give_up": "failure",
 * });
 */

// ============================================================
// KEY TAKEAWAYS:
// ============================================================
/**
 * 1. addConditionalEdges(source, router, pathMap) enables branching
 * 
 * 2. Router function receives state and returns a string key
 * 
 * 3. Path map connects string keys to node names
 * 
 * 4. Multiple edges can lead to the same target node
 * 
 * 5. Conditional edges enable loops (node can route back to itself)
 * 
 * 6. This is the foundation for ReAct agents (tool calling loops)
 */
