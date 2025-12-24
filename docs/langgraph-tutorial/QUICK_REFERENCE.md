# 📋 LangGraph.js Quick Reference

A cheatsheet for LangGraph.js patterns and syntax.

---

## 🔧 Installation

```bash
npm install @langchain/core @langchain/google-genai @langchain/langgraph zod
```

---

## 📦 Imports

```javascript
// Core LangGraph
import { StateGraph, START, END, Annotation, MemorySaver } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";

// Messages
import { HumanMessage, AIMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";

// LLM
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

// Tools
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
```

---

## 📊 State Definition

```javascript
const MyState = Annotation.Root({
  // Replace pattern - new value overwrites
  currentValue: Annotation({
    reducer: (_, newValue) => newValue,
    default: () => null,
  }),

  // Append pattern - values accumulate
  messages: Annotation({
    reducer: (curr, update) => [...curr, ...update],
    default: () => [],
  }),

  // Merge pattern - objects merge
  metadata: Annotation({
    reducer: (curr, update) => ({ ...curr, ...update }),
    default: () => ({}),
  }),
});
```

---

## 🔨 Node Functions

```javascript
// Basic node
async function myNode(state) {
  // Do something
  return { fieldToUpdate: newValue };
}

// LLM node
async function llmNode(state) {
  const response = await llm.invoke(state.messages);
  return { messages: [response] };
}
```

---

## 🔗 Building a Graph

```javascript
const graph = new StateGraph(MyState);

// Add nodes
graph.addNode("node1", node1Function);
graph.addNode("node2", node2Function);

// Add edges
graph.addEdge(START, "node1");
graph.addEdge("node1", "node2");
graph.addEdge("node2", END);

// Compile
const app = graph.compile();

// Invoke
const result = await app.invoke(initialState);
```

---

## 🔀 Conditional Edges

```javascript
function routeFunction(state) {
  if (state.condition) return "pathA";
  return "pathB";
}

graph.addConditionalEdges("sourceNode", routeFunction, {
  pathA: "nodeA",
  pathB: "nodeB",
});
```

---

## 🔧 Tool Definition

```javascript
const myTool = new DynamicStructuredTool({
  name: "tool_name",
  description: "What this tool does",
  schema: z.object({
    param1: z.string().describe("Description"),
    param2: z.number().optional(),
  }),
  func: async ({ param1, param2 }) => {
    return "result";
  },
});

// Bind tools to LLM
const llmWithTools = llm.bindTools([myTool]);
```

---

## 🔄 ReAct Pattern

```javascript
// Agent node
async function agent(state) {
  const response = await llmWithTools.invoke(state.messages);
  return { messages: [response] };
}

// Check for tool calls
function shouldContinue(state) {
  const last = state.messages[state.messages.length - 1];
  if (last.tool_calls?.length > 0) return "tools";
  return "end";
}

// Build
graph.addNode("agent", agent);
graph.addNode("tools", new ToolNode(tools));
graph.addEdge(START, "agent");
graph.addConditionalEdges("agent", shouldContinue, {
  tools: "tools",
  end: END,
});
graph.addEdge("tools", "agent");
```

---

## 💾 Memory & Threads

```javascript
// With checkpointer
const app = graph.compile({
  checkpointer: new MemorySaver(),
});

// Use threads
const config = { configurable: { thread_id: "unique-id" } };
await app.invoke(state, config);
```

---

## 🎯 Common Patterns

### Chat Pattern
```
START → process_input → call_llm → format_output → END
```

### ReAct Pattern
```
START → agent ←→ tools → END
```

### Approval Pattern
```
START → agent → [needs_approval?] → human → execute → agent
```

### Multi-Step Agent
```
START → plan → [loop] → execute → reflect → [done?] → END
```

---

## ⚠️ Common Mistakes

1. **Forgetting to return state updates**
   ```javascript
   // Wrong
   async function node(state) { doSomething(); }
   
   // Right
   async function node(state) { return { field: value }; }
   ```

2. **Not handling arrays in reducers**
   ```javascript
   // Handle both single items and arrays
   reducer: (curr, update) => [
     ...curr, 
     ...(Array.isArray(update) ? update : [update])
   ]
   ```

3. **Missing END edge**
   ```javascript
   // Always connect to END somewhere
   graph.addEdge("lastNode", END);
   ```

4. **Not binding tools to LLM**
   ```javascript
   // Wrong
   const response = await llm.invoke(messages);
   
   // Right (for tool calling)
   const llmWithTools = llm.bindTools(tools);
   const response = await llmWithTools.invoke(messages);
   ```

---

## 🔗 Useful Links

- [LangGraph.js Docs](https://langchain-ai.github.io/langgraphjs/)
- [LangChain.js Docs](https://js.langchain.com/)
- [Google AI Studio](https://aistudio.google.com/)
