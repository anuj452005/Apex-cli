# 📁 Final Structure - Agent Feature

Complete server structure after implementing the Agent feature:

```
server/
├── package.json                    # Updated with dependencies
├── .env                            # GOOGLE_API_KEY required
└── src/
    ├── index.js
    ├── cli/
    │   ├── main.js                 # ✏️ Add agent command
    │   └── commands/
    │       ├── auth/
    │       │   └── login.js
    │       ├── chat/
    │       │   └── chat.js
    │       ├── tools/
    │       │   └── tools.js
    │       └── agent/
    │           └── agent.js        # ✨ NEW
    └── lib/
        └── langgraph/
            ├── shared/
            │   ├── llm.js
            │   └── checkpointer.js
            ├── chat/
            │   └── ...
            ├── tools/
            │   └── ...
            └── agent/
                ├── config.js           # ✨ NEW
                ├── state.js            # ✨ NEW
                ├── planner.js          # ✨ NEW
                ├── executor.js         # ✨ NEW
                ├── reflector.js        # ✨ NEW
                ├── graph.js            # ✨ NEW
                └── subagents/
                    ├── coding.js       # ✨ NEW
                    ├── file_manager.js # ✨ NEW
                    └── researcher.js   # ✨ NEW
```

## Update main.js

```javascript
import { agent } from "./commands/agent/agent.js";

program
  .addCommand(login)
  .addCommand(chat)
  .addCommand(tools)
  .addCommand(agent)  // Add this
```

## Usage

```bash
# Interactive mode
apex agent

# Single task
apex agent -t "Create a React todo app"

# Short alias
apex a
```

## Agent Flow

```
User Task
    │
    ▼
┌─────────┐
│ Planner │ ──▶ Creates subtasks
└────┬────┘
     │
     ▼
┌──────────┐
│ Executor │ ──▶ Runs each subtask
└────┬─────┘
     │
     ▼
┌───────────┐
│ Reflector │ ──▶ Evaluates results
└─────┬─────┘
      │
   ┌──┴──┐
   ▼     ▼
Retry  Continue
   │     │
   └──┬──┘
      │
      ▼
  Complete
```
