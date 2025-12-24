# 📁 Final Structure - Chat Feature

After implementing the chat feature, your server structure should look like this:

```
server/
├── package.json                    # Updated with new dependencies
├── .env                            # Add GOOGLE_API_KEY
└── src/
    ├── index.js                    # Main server (unchanged)
    ├── cli/
    │   ├── main.js                 # ✏️ UPDATED: Add chat command
    │   └── commands/
    │       ├── auth/
    │       │   └── login.js        # Existing auth (unchanged)
    │       └── chat/
    │           └── chat.js         # ✨ NEW: Chat command
    └── lib/
        ├── auth.js                 # Existing (unchanged)
        ├── db.js                   # Existing (unchanged)
        ├── token.js                # Existing (unchanged)
        └── langgraph/
            ├── shared/
            │   ├── llm.js          # ✨ NEW: Gemini LLM setup
            │   └── checkpointer.js # ✨ NEW: Memory persistence
            └── chat/
                ├── config.js       # ✨ NEW: Chat configuration
                ├── state.js        # ✨ NEW: State definition
                ├── nodes.js        # ✨ NEW: Graph nodes
                └── graph.js        # ✨ NEW: LangGraph definition
```

## New Dependencies to Add

Add these to `package.json`:

```json
{
  "dependencies": {
    "@langchain/core": "^0.3.0",
    "@langchain/google-genai": "^0.1.0",
    "@langchain/langgraph": "^0.2.0"
  }
}
```

## Environment Variables

Add to `.env`:

```env
GOOGLE_API_KEY=your_gemini_api_key_here
```

## Update main.js

```javascript
// Add import at top
import { chat } from "./commands/chat/chat.js";

// Add command in program setup
program.version("0.0.1")
  .description("A Cli based AI tool")
  .addCommand(login)
  .addCommand(chat)  // Add this line
```

## Usage

```bash
# Interactive chat mode
apex chat

# Single message mode
apex chat -m "What is JavaScript?"

# Resume session
apex chat -s session_123456
```

## File Relationships

```
┌─────────────────────────────────────────────────────────┐
│                    main.js                              │
│                       │                                 │
│         ┌─────────────┼─────────────┐                   │
│         ▼             ▼             ▼                   │
│    login.js      chat.js      (future commands)        │
│                       │                                 │
│                       ▼                                 │
│              ┌────────────┐                             │
│              │  graph.js  │◄── Main orchestrator        │
│              └────────────┘                             │
│                    │                                    │
│      ┌─────────────┼─────────────┐                      │
│      ▼             ▼             ▼                      │
│  state.js      nodes.js     config.js                   │
│      │             │             │                      │
│      └─────────────┼─────────────┘                      │
│                    ▼                                    │
│          ┌──────────────────┐                           │
│          │  shared/llm.js   │                           │
│          │  checkpointer.js │                           │
│          └──────────────────┘                           │
└─────────────────────────────────────────────────────────┘
```
