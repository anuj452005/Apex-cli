/**
 * Coding Subagent
 * 
 * Specialized agent for code generation and modification.
 */

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { AGENT_CONFIG } from "../config.js";

const codingLLM = new ChatGoogleGenerativeAI({
  model: AGENT_CONFIG.llm.model,
  temperature: 0.2,
  apiKey: AGENT_CONFIG.llm.apiKey,
});

const CODING_PROMPT = `You are an expert software developer. Your task is to write clean, efficient, and well-documented code.

Guidelines:
- Write production-quality code
- Include comments for complex logic
- Follow best practices for the language
- Handle edge cases and errors
- Keep code modular and reusable

Language expertise: JavaScript, TypeScript, Python, React, Node.js`;

/**
 * Generate code for a task
 */
export async function generateCode(task, context = {}) {
  const { language = "javascript", existingCode = null } = context;

  const prompt = existingCode
    ? `Modify this code:\n\`\`\`${language}\n${existingCode}\n\`\`\`\n\nTask: ${task}`
    : `Write code for: ${task}\n\nLanguage: ${language}`;

  const response = await codingLLM.invoke([
    new SystemMessage(CODING_PROMPT),
    new HumanMessage(prompt),
  ]);

  // Extract code blocks
  const codeMatch = response.content.match(/```(\w+)?\n([\s\S]*?)```/);
  
  return {
    code: codeMatch ? codeMatch[2].trim() : response.content,
    language: codeMatch ? codeMatch[1] || language : language,
    explanation: response.content,
  };
}

/**
 * Review code for issues
 */
export async function reviewCode(code, language = "javascript") {
  const response = await codingLLM.invoke([
    new SystemMessage("You are a code reviewer. Find bugs, issues, and suggest improvements."),
    new HumanMessage(`Review this ${language} code:\n\`\`\`${language}\n${code}\n\`\`\``),
  ]);

  return {
    review: response.content,
    issues: [],
    suggestions: [],
  };
}

export const codingSubagent = {
  name: "CODER",
  generateCode,
  reviewCode,
};

export default codingSubagent;
