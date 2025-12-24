/**
 * ============================================================
 * 01 - Hello World: Your First LangGraph
 * ============================================================
 * 
 * This is the simplest possible LangGraph.
 * We'll create a graph with two nodes that just modify a counter.
 * 
 * LEARNING GOALS:
 * - Understand what a StateGraph is
 * - Learn how to define State with Annotation
 * - Learn how to add Nodes
 * - Learn how to add Edges
 * - Learn how to compile and invoke the graph
 */

// ============================================================
// IMPORTS
// ============================================================

// StateGraph: The main class for creating a graph
// START: Special constant representing the entry point
// END: Special constant representing the exit point
// Annotation: Used to define state schema
import { StateGraph, START, END, Annotation } from "@langchain/langgraph";

// ============================================================
// STEP 1: DEFINE STATE
// ============================================================

/**
 * State is the data that flows through your graph.
 * Every node will receive this state and can modify it.
 * 
 * We use Annotation.Root to create a state schema.
 * Each field has:
 *   - reducer: How to combine old value with new value
 *   - default: Initial value
 */
const SimpleState = Annotation.Root({
  // A simple counter that gets replaced when updated
  counter: Annotation({
    // Reducer: When updated, just use the new value
    // (_, newValue) means "ignore old value, use new"
    reducer: (_, newValue) => newValue,
    // Default: Start at 0
    default: () => 0,
  }),
  
  // A log of messages (array that grows)
  log: Annotation({
    // Reducer: Append new items to existing array
    reducer: (currentArray, newItems) => [...currentArray, ...newItems],
    // Default: Empty array
    default: () => [],
  }),
});

// ============================================================
// STEP 2: DEFINE NODE FUNCTIONS
// ============================================================

/**
 * A node is just an async function that:
 * 1. Receives the current state
 * 2. Does some work
 * 3. Returns updates to the state
 * 
 * IMPORTANT: You only return the fields you want to update!
 * LangGraph will merge your updates with the existing state.
 */

// First node: Increment the counter
async function incrementNode(state) {
  console.log("📍 Running incrementNode");
  console.log("   Current counter:", state.counter);
  
  // Return state updates
  // The reducer will merge this with existing state
  return {
    counter: state.counter + 1,       // New counter value
    log: ["Incremented counter"],     // Add to log array
  };
}

// Second node: Double the counter
async function doubleNode(state) {
  console.log("📍 Running doubleNode");
  console.log("   Current counter:", state.counter);
  
  return {
    counter: state.counter * 2,
    log: ["Doubled counter"],
  };
}

// Third node: Log the final result
async function finalNode(state) {
  console.log("📍 Running finalNode");
  console.log("   Final counter:", state.counter);
  
  return {
    log: [`Final value is ${state.counter}`],
  };
}

// ============================================================
// STEP 3: BUILD THE GRAPH
// ============================================================

/**
 * Now we create the graph structure:
 * 
 *     START
 *       │
 *       ▼
 *   increment
 *       │
 *       ▼
 *    double
 *       │
 *       ▼
 *     final
 *       │
 *       ▼
 *      END
 */

function buildGraph() {
  // Create a new StateGraph with our state schema
  const graph = new StateGraph(SimpleState);

  // Add nodes - each node is a (name, function) pair
  graph.addNode("increment", incrementNode);
  graph.addNode("double", doubleNode);
  graph.addNode("final", finalNode);

  // Add edges - define the flow
  // START → increment: The graph begins at "increment"
  graph.addEdge(START, "increment");
  
  // increment → double: After increment, go to double
  graph.addEdge("increment", "double");
  
  // double → final: After double, go to final
  graph.addEdge("double", "final");
  
  // final → END: After final, the graph ends
  graph.addEdge("final", END);

  // Compile the graph - this creates a runnable application
  return graph.compile();
}

// ============================================================
// STEP 4: RUN THE GRAPH
// ============================================================

async function main() {
  console.log("🚀 Hello World LangGraph Example\n");
  console.log("=".repeat(50));

  // Build and compile the graph
  const app = buildGraph();

  // Invoke the graph with initial state
  // You can override the default values here
  const initialState = {
    counter: 5,        // Start at 5 instead of 0
    log: ["Started"],  // Initial log entry
  };

  console.log("\n📊 Initial State:", initialState);
  console.log("\n" + "=".repeat(50) + "\n");

  // Run the graph
  const result = await app.invoke(initialState);

  // Print final result
  console.log("\n" + "=".repeat(50));
  console.log("\n✅ Final State:");
  console.log("   Counter:", result.counter);  // Should be (5+1)*2 = 12
  console.log("   Log:", result.log);
}

// Run the example
main().catch(console.error);

// ============================================================
// EXPECTED OUTPUT:
// ============================================================
/**
 * 🚀 Hello World LangGraph Example
 * 
 * ==================================================
 * 
 * 📊 Initial State: { counter: 5, log: [ 'Started' ] }
 * 
 * ==================================================
 * 
 * 📍 Running incrementNode
 *    Current counter: 5
 * 📍 Running doubleNode
 *    Current counter: 6
 * 📍 Running finalNode
 *    Final counter: 12
 * 
 * ==================================================
 * 
 * ✅ Final State:
 *    Counter: 12
 *    Log: [ 'Started', 'Incremented counter', 'Doubled counter', 'Final value is 12' ]
 */

// ============================================================
// KEY TAKEAWAYS:
// ============================================================
/**
 * 1. StateGraph holds your nodes and edges
 * 2. Annotation.Root defines your state schema
 * 3. Reducers determine how state updates are merged
 * 4. Nodes are async functions that return state updates
 * 5. Edges define the flow between nodes
 * 6. START and END are special entry/exit points
 * 7. compile() creates a runnable application
 * 8. invoke() runs the graph with initial state
 */
