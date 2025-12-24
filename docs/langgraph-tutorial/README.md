# 📚 LangGraph.js Tutorial

A complete tutorial for LangGraph.js - from basics to building production agents.

---

## 📋 Table of Contents

1. [Introduction](#1-introduction)
2. [Core Concepts](#2-core-concepts)
3. [Installation & Setup](#3-installation--setup)
4. [Tutorial Files](#4-tutorial-files)
5. [Building Your First Graph](#5-building-your-first-graph)
6. [State Management](#6-state-management)
7. [Conditional Routing](#7-conditional-routing)
8. [Tool Calling](#8-tool-calling)
9. [Memory & Persistence](#9-memory--persistence)
10. [Building Agents](#10-building-agents)
11. [Human-in-the-Loop](#11-human-in-the-loop)
12. [Integration with Apex CLI](#12-integration-with-apex-cli)

---

## 1. Introduction

### What is LangGraph?

**LangGraph** is a library for building **stateful, multi-actor applications** with LLMs. It extends LangChain with:

- **Graph-based orchestration** - Define workflows as nodes and edges
- **Built-in state management** - Automatic state passing between nodes
- **Persistence** - Save and resume conversations
- **Human-in-the-loop** - Pause for user input
- **Streaming** - Real-time responses

### When to Use LangGraph?

| Use Case | Why LangGraph? |
|----------|----------------|
| **Chatbots with memory** | Built-in state persistence |
| **Multi-step agents** | Graph-based planning |
| **Tool-using AI** | Native tool node support |
| **Complex workflows** | Conditional branching |
| **Human oversight** | Interrupt points |

### LangGraph vs Plain LangChain

```
LangChain (Chains):
  Input → Step1 → Step2 → Step3 → Output
  (linear, no loops, no conditions)

LangGraph (Graphs):
  Input → Node1 → [condition] → Node2 → Node3
                      ↓              ↑
                   Node4 ────────────┘
  (loops, conditions, parallel, stateful)
```

---

## 2. Core Concepts

### 2.1 State

**State** is the data that flows through your graph. Every node receives and can modify the state.

```javascript
// State is defined using Annotation.Root
const MyState = Annotation.Root({
  messages: Annotation({ reducer: (a, b) => [...a, ...b], default: () => [] }),
  count: Annotation({ reducer: (_, b) => b, default: () => 0 }),
});
```

### 2.2 Nodes

**Nodes** are functions that transform state. They receive state and return state updates.

```javascript
// A node is just an async function
async function myNode(state) {
  // Do something with state
  return { count: state.count + 1 };  // Return updates
}
```

### 2.3 Edges

**Edges** connect nodes and define the flow of your graph.

```javascript
graph.addEdge("node1", "node2");  // Always go node1 → node2
graph.addConditionalEdges("node1", routingFn, { ... });  // Conditional
```

### 2.4 Graph

**Graph** is the container that holds nodes and edges together.

```javascript
const graph = new StateGraph(MyState);
graph.addNode("name", nodeFunction);
graph.addEdge(START, "name");
graph.addEdge("name", END);
const app = graph.compile();
```

---

## 3. Installation & Setup

### Install Dependencies

```bash
npm install @langchain/core @langchain/google-genai @langchain/langgraph
```

### Environment Setup

```env
GOOGLE_API_KEY=your-gemini-api-key
```

### Basic Import Structure

```javascript
// Core LangGraph imports
import { StateGraph, START, END, Annotation } from "@langchain/langgraph";

// LangChain message types
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";

// LLM provider
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

// For tool definitions
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
```

---

## 4. Tutorial Files

This tutorial includes the following files:

| File | Description |
|------|-------------|
| `01-hello-world.js` | Simplest possible LangGraph |
| `02-state-basics.js` | Understanding state and reducers |
| `03-llm-node.js` | Adding LLM to your graph |
| `04-conditional-edges.js` | Routing and branching |
| `05-tool-calling.js` | Giving tools to LLM |
| `06-react-agent.js` | ReAct pattern agent |
| `07-memory-checkpointer.js` | Persistence and memory |
| `08-human-in-loop.js` | Pausing for human input |
| `09-full-agent.js` | Complete production agent |

---

## 5. Building Your First Graph

See: `01-hello-world.js`

The simplest LangGraph that just passes data through nodes.

---

## 6. State Management

See: `02-state-basics.js`

Understanding how state flows and how reducers work.

---

## 7. Conditional Routing

See: `04-conditional-edges.js`

Making decisions in your graph based on state.

---

## 8. Tool Calling

See: `05-tool-calling.js` and `06-react-agent.js`

How to give tools to your LLM.

---

## 9. Memory & Persistence

See: `07-memory-checkpointer.js`

Saving and resuming conversations.

---

## 10. Building Agents

See: `09-full-agent.js`

Complete agent implementation.

---

## 11. Human-in-the-Loop

See: `08-human-in-loop.js`

Pausing for human approval.

---

## 12. Integration with Apex CLI

After completing this tutorial, you can integrate LangGraph into Apex CLI by:

1. Copy the patterns from tutorial files
2. Create `lib/langgraph/` directory
3. Build chat, tools, and agent commands
4. Use memory for conversation persistence

See the `docs/implement_*` folders for full integration guides.
