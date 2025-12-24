/**
 * Researcher Subagent
 * 
 * Specialized agent for gathering information and research.
 */

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { AGENT_CONFIG } from "../config.js";

const researchLLM = new ChatGoogleGenerativeAI({
  model: AGENT_CONFIG.llm.model,
  temperature: 0.5,
  apiKey: AGENT_CONFIG.llm.apiKey,
});

const RESEARCH_PROMPT = `You are a research assistant. Your task is to provide accurate, relevant information.

Guidelines:
- Provide factual, up-to-date information
- Cite sources when possible
- Summarize key points clearly
- Acknowledge limitations of your knowledge
- Suggest further research if needed`;

/**
 * Research a topic
 */
export async function research(topic, context = {}) {
  const { depth = "overview", focus = null } = context;

  const prompt = `Research: ${topic}
${focus ? `Focus on: ${focus}` : ""}
Depth: ${depth}`;

  const response = await researchLLM.invoke([
    new SystemMessage(RESEARCH_PROMPT),
    new HumanMessage(prompt),
  ]);

  return {
    topic,
    findings: response.content,
    sources: [],
  };
}

/**
 * Find examples and patterns
 */
export async function findExamples(query, options = {}) {
  const { type = "code", language = "javascript" } = options;

  const response = await researchLLM.invoke([
    new SystemMessage("Find practical examples and patterns."),
    new HumanMessage(`Find ${type} examples for: ${query}\nLanguage: ${language}`),
  ]);

  return {
    query,
    examples: response.content,
    type,
  };
}

/**
 * Summarize documentation
 */
export async function summarizeDocs(content, options = {}) {
  const { focus = null } = options;

  const response = await researchLLM.invoke([
    new SystemMessage("Summarize documentation clearly and concisely."),
    new HumanMessage(`Summarize:\n${content}\n${focus ? `Focus on: ${focus}` : ""}`),
  ]);

  return {
    summary: response.content,
  };
}

export const researcherSubagent = {
  name: "RESEARCHER",
  research,
  findExamples,
  summarizeDocs,
};

export default researcherSubagent;
