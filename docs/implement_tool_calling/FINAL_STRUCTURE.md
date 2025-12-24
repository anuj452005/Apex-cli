# 📁 Final Structure - Tool Calling Feature

After implementing the tool calling feature, your server structure:

```
server/
├── package.json                    # Updated with dependencies
├── .env                            # Add GOOGLE_API_KEY
└── src/
    ├── index.js
    ├── cli/
    │   ├── main.js                 # ✏️ UPDATED: Add tools command
    │   └── commands/
    │       ├── auth/
    │       │   └── login.js
    │       ├── chat/
    │       │   └── chat.js
    │       └── tools/
    │           └── tools.js        # ✨ NEW: Tools command
    └── lib/
        ├── auth.js
        ├── db.js
        └── langgraph/
            ├── shared/
            │   ├── llm.js
            │   └── checkpointer.js
            ├── chat/
            │   └── ...
            └── tools/
                ├── config.js           # ✨ NEW
                ├── registry.js         # ✨ NEW
                ├── graph.js            # ✨ NEW
                └── definitions/
                    ├── file_tools.js   # ✨ NEW
                    ├── code_tools.js   # ✨ NEW
                    └── shell_tools.js  # ✨ NEW
```

## Update main.js

```javascript
import { tools } from "./commands/tools/tools.js";

program
  .addCommand(login)
  .addCommand(chat)
  .addCommand(tools)  // Add this
```

## Usage

```bash
# Interactive mode with tools
apex tools

# List available tools
apex tools --list

# Short alias
apex t
```

## Tool Categories

| Category | Tools |
|----------|-------|
| **File** | read_file, write_file, list_directory, search_files |
| **Code** | execute_code, evaluate_expression |
| **Shell** | shell_command, get_current_directory, find_executable |
