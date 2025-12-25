import { StateGraph, START, END, Annotation } from "@langchain/langgraph";

import {HumanMessage ,AIMessage,SystemMessage,BaseMessage} from "@langchain/core/messages";

import {ChatGoogleGenerativeAI} from "@langchain/google-genai";

import dotenv from "dotenv";
import { error } from "console";

dotenv.config();


// step 1 setp llm

const llm = new ChatGoogleGenerativeAI({  // 
    // this is the model we are using
    model: "gemini-2.0-flash",
    temperature: 0.7,
    maxOutputTokens: 1024,
    apiKey: process.env.GOOGLE_API_KEY,
});

// step 2 define state  then --> node 

const ChatState = Annotation.Root({
    // this is the schema for the state 
    message : Annotation({
        reducer :(prev,next)=>{
            // if next is array 
            if(Array.isArray(next)) return [...prev,...next];
            return [...prev,next];
        },
        default :()=>[] // empty array 
    }),

    userInput : Annotation({
        reducer : (prev,next)=>next,
        default :()=>"" // empty string 
    }),

    status : Annotation({
        reducer : (prev,next)=>next,
        default :()=>"idle" // empty string 
    }),

    metadata : Annotation({
        reducer : (prev,next)=>next,
        default :()=>({}) // empty object 
    }), 
    error : Annotation({
        reducer : (prev,next)=>next,
        default :()=>null // empty object 
    }),

    log : Annotation({
        reducer : (prev,next)=>prev.concat(next),
        default :()=>[] // empty array 
    })

})


// step 3 define node --> async function

const SYSTEM_PROMPT=`You are a helpful assistant that can answer any question.`




async function processInputNode(state){
    // take the raw input and conver into the ChatState format  in th human messge 
    console.log("📍 Running processInputNode");
    console.log("   user input:", state.userInput);

    const humanMessage = new HumanMessage(state.userInput);

    return {
        messages :[humanMessage],
        status :"processing",
        userInput :"",  /// why this is empty 
        metadata :{},
        error :null,
        log :[]
    }     
}


async function callLLMNode(state){
    console.log("📍 Running callLLMNode");
    console.log("   Current messages:", state.messages);

    try{
        const systemMessage = new SystemMessage(SYSTEM_PROMPT);
        const allMessages = [systemMessage,...state.messages];
        const response = await llm.invoke(allMessages);

        const aiMessage = new AIMessage(response.content);

        return {
            messages :[aiMessage],
            status :"processing",
            userInput :"",  /// why this is empty 
            metadata :{},
            error :null,
            log :[]
        }     
    }
    catch(err){
        console.error("❌ Error in callLLMNode:", err);
        return {
            status :"error",
            error :err,
            log :[]
        }
    }
}


async function formatOutputNode(state){
    console.log("final output   :",state.messages[state.messages.length-1].content);
    return {
        messages :state.messages,
        status :"idle",
        userInput :"",  /// why this is empty 
        metadata :{},
        error :null,
        log :[]
    }     
}


// buiild the graph 


function buildGraph(){
    const graph= new StateGraph(ChatState);

    // add nodes
    graph.addNode("process_input",processInputNode);
    graph.addNode("call_llm",callLLMNode);
    graph.addNode("format_output",formatOutputNode);

    // add edges
    graph.addEdge(START,"process_input");
    graph.addEdge("process_input","call_llm");
    graph.addEdge("call_llm","format_output");
    graph.addEdge("format_output",END);

    return graph.compile();
}


// ============================================================
// STEP 5: RUN THE CHATBOT
// ============================================================

async function main() {
  console.log("🚀 LLM Node Example - Gemini Chatbot\n");
  console.log("=".repeat(50));

  // Check for API key
  if (!process.env.GOOGLE_API_KEY) {
    console.error("❌ Error: GOOGLE_API_KEY not set in environment");
    console.log("   Create a .env file with: GOOGLE_API_KEY=your-key-here");
    process.exit(1);
  }

  // Build the graph
  const chatbot = buildChatGraph();

  // Simulate a conversation with multiple turns
  const conversation = [
    "Hello! What can you help me with?",
    "Can you explain what an API is?",
    "Thanks! One more question: what's the difference between REST and GraphQL?",
  ];

  let state = { messages: [], userInput: "" };

  for (const userMessage of conversation) {
    console.log("\n" + "=".repeat(50));
    console.log(`\n👤 User: ${userMessage}\n`);

    // Invoke the graph with new input
    // IMPORTANT: We pass the accumulated messages + new input
    state = await chatbot.invoke({
      messages: state.messages,  // Keep conversation history
      userInput: userMessage,     // New user input
    });

    // Get the AI's response (last message)
    const aiResponse = state.messages[state.messages.length - 1];
    console.log(`\n🤖 AI: ${aiResponse.content}`);
  }

  console.log("\n" + "=".repeat(50));
  console.log("\n✅ Conversation complete!");
  console.log(`   Total messages: ${state.messages.length}`);
}

main().catch(console.error);

// ============================================================
// KEY TAKEAWAYS:
// ============================================================
/**
 * 1. ChatGoogleGenerativeAI is the LangChain wrapper for Gemini
 * 
 * 2. Messages are typed: HumanMessage, AIMessage, SystemMessage
 * 
 * 3. The LLM node calls llm.invoke(messages) to get a response
 * 
 * 4. Conversation history is maintained in the messages array
 * 
 * 5. Each graph invoke adds to the message history
 * 
 * 6. System prompt is typically added at the start of messages
 */



