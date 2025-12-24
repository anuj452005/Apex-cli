# 💬 Implement Chat Feature

## Architecture Overview

The chat feature implements a conversational AI interface using **LangGraph** with **Gemini AI**. This creates a stateful conversation flow that maintains context across messages.

```
┌─────────────────────────────────────────────────────────────────┐
│                       CHAT ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│   │   User      │───▶│   CLI       │───▶│  LangGraph  │        │
│   │   Input     │    │  Interface  │    │   Engine    │        │
│   └─────────────┘    └─────────────┘    └──────┬──────┘        │
│                                                 │               │
│                      ┌──────────────────────────┼───────────┐   │
│                      │         LangGraph        │           │   │
│                      │    ┌─────────────┐       ▼           │   │
│                      │    │   START     │                   │   │
│                      │    └──────┬──────┘                   │   │
│                      │           │                          │   │
│                      │           ▼                          │   │
│                      │    ┌─────────────┐                   │   │
│                      │    │  validate   │◀──── Check if     │   │
│                      │    │   input     │      input valid  │   │
│                      │    └──────┬──────┘                   │   │
│                      │           │                          │   │
│                      │           ▼                          │   │
│                      │    ┌─────────────┐                   │   │
│                      │    │   chat      │◀──── Gemini AI    │   │
│                      │    │   model     │      Processing   │   │
│                      │    └──────┬──────┘                   │   │
│                      │           │                          │   │
│                      │           ▼                          │   │
│                      │    ┌─────────────┐                   │   │
│                      │    │  format     │◀──── Format       │   │
│                      │    │  response   │      for CLI      │   │
│                      │    └──────┬──────┘                   │   │
│                      │           │                          │   │
│                      │           ▼                          │   │
│                      │    ┌─────────────┐                   │   │
│                      │    │    END      │                   │   │
│                      │    └─────────────┘                   │   │
│                      └──────────────────────────────────────┘   │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                    STATE (Checkpointer)                 │   │
│   │  - messages: HumanMessage[] | AIMessage[]               │   │
│   │  - sessionId: string                                    │   │
│   │  - timestamp: Date                                      │   │
│   │  - metadata: { tokens, model, etc. }                    │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Folder Structure After Implementation

```
server/src/
├── cli/
│   ├── commands/
│   │   ├── auth/
│   │   │   └── login.js          # Existing auth
│   │   └── chat/
│   │       └── chat.js           # Chat command (NEW)
│   └── main.js                   # Updated with chat command
├── lib/
│   ├── auth.js                   # Existing auth
│   ├── db.js                     # Existing db
│   ├── token.js                  # Token management
│   └── langgraph/
│       ├── chat/
│       │   ├── graph.js          # LangGraph chat graph (NEW)
│       │   ├── nodes.js          # Graph nodes (NEW)
│       │   ├── state.js          # State definition (NEW)
│       │   └── config.js         # Chat config (NEW)
│       └── shared/
│           ├── llm.js            # Gemini LLM setup (NEW)
│           └── checkpointer.js   # Memory persistence (NEW)
└── index.js                      # Main server
```

## File Summaries

| File | Purpose |
|------|---------|
| `chat/chat.js` | CLI command handler for chat interactions with REPL interface |
| `langgraph/chat/graph.js` | LangGraph graph definition with nodes and edges |
| `langgraph/chat/nodes.js` | Node functions: validate, chat, format |
| `langgraph/chat/state.js` | State schema using Annotation API |
| `langgraph/chat/config.js` | Configuration for chat (model, temperature, etc.) |
| `langgraph/shared/llm.js` | Gemini AI model initialization |
| `langgraph/shared/checkpointer.js` | Memory persistence for conversation state |

---

## Implementation Files

Each file is documented with its complete code in the following sections.
