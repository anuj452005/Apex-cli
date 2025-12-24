# 🔧 Implement Tool Calling Feature

## Architecture Overview

The Tool Calling feature enables the AI to execute real-world actions through LangGraph. Tools are functions that the AI can invoke to interact with the file system, execute code, search the web, and more.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     TOOL CALLING ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────┐    ┌─────────────┐    ┌──────────────────────┐       │
│   │   User      │───▶│   CLI       │───▶│   LangGraph Agent    │       │
│   │   Input     │    │  Interface  │    │   with Tool Binding  │       │
│   └─────────────┘    └─────────────┘    └──────────┬───────────┘       │
│                                                     │                   │
│                      ┌──────────────────────────────┼──────────────┐    │
│                      │         LangGraph ReAct      │              │    │
│                      │    ┌─────────────┐           ▼              │    │
│                      │    │   START     │                          │    │
│                      │    └──────┬──────┘                          │    │
│                      │           │                                 │    │
│                      │           ▼                                 │    │
│                      │    ┌─────────────┐                          │    │
│                      │    │  call_model │◀──── LLM decides action  │    │
│                      │    └──────┬──────┘                          │    │
│                      │           │                                 │    │
│                      │     ┌─────┴─────┐                           │    │
│                      │     ▼           ▼                           │    │
│                      │  [tool_call]  [no_tool]                     │    │
│                      │     │           │                           │    │
│                      │     ▼           ▼                           │    │
│                      │  ┌──────┐   ┌──────┐                        │    │
│                      │  │tools │   │ END  │                        │    │
│                      │  └──┬───┘   └──────┘                        │    │
│                      │     │                                       │    │
│                      │     └──────▶ call_model (loop back)         │    │
│                      │                                             │    │
│                      └─────────────────────────────────────────────┘    │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                     AVAILABLE TOOLS                             │   │
│   ├─────────────────────────────────────────────────────────────────┤   │
│   │  📁 file_read      - Read file contents                        │   │
│   │  ✏️  file_write     - Write/create files                        │   │
│   │  📂 list_directory - List directory contents                   │   │
│   │  🔍 search_files   - Search for files by pattern               │   │
│   │  💻 execute_code   - Run code snippets (sandboxed)             │   │
│   │  🌐 web_search     - Search the internet                       │   │
│   │  📋 clipboard      - Read/write clipboard                      │   │
│   │  🖥️  shell_command  - Execute shell commands (with approval)   │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Folder Structure After Implementation

```
server/src/
├── cli/
│   ├── commands/
│   │   ├── auth/
│   │   │   └── login.js              # Existing auth
│   │   ├── chat/
│   │   │   └── chat.js               # Chat command
│   │   └── tools/
│   │       └── tools.js              # Tools command (NEW)
│   └── main.js                       # Updated with tools command
├── lib/
│   ├── auth.js
│   ├── db.js
│   ├── token.js
│   └── langgraph/
│       ├── shared/
│       │   ├── llm.js
│       │   └── checkpointer.js
│       ├── chat/
│       │   └── ...                   # Chat files
│       └── tools/
│           ├── definitions/
│           │   ├── file_tools.js     # File system tools (NEW)
│           │   ├── code_tools.js     # Code execution tools (NEW)
│           │   ├── search_tools.js   # Search tools (NEW)
│           │   └── shell_tools.js    # Shell command tools (NEW)
│           ├── registry.js           # Tool registry (NEW)
│           ├── executor.js           # Tool executor (NEW)
│           ├── graph.js              # Tool-enabled graph (NEW)
│           └── config.js             # Tool config (NEW)
└── index.js
```

## File Summaries

| File | Purpose |
|------|---------|
| `tools/tools.js` | CLI command for tool-enabled conversations |
| `definitions/file_tools.js` | File read/write/list tools using LangChain DynamicTool |
| `definitions/code_tools.js` | Code execution in sandboxed environment |
| `definitions/search_tools.js` | File and web search capabilities |
| `definitions/shell_tools.js` | Shell command execution with user approval |
| `registry.js` | Central registry of all available tools |
| `executor.js` | Safe tool execution with error handling |
| `graph.js` | LangGraph with tool binding (ReAct pattern) |
| `config.js` | Tool-specific configuration and permissions |

---

## Implementation Files

Each file is documented with its complete code in the following sections.
