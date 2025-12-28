// Sliding Window Manager - Retrieve last N messages for LLM context
// Implements the sliding window strategy: store all, retrieve recent

import { HumanMessage, AIMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import chalk from 'chalk';
import { conversationStore } from './conversationStore.js';
import { config } from '../../../config/google.config.js';

export class SlidingWindowManager {
  
  constructor(options = {}) {
    this.windowSize = options.windowSize || config.memory?.windowSize || 10;
    this.includeSummary = options.includeSummary !== false;
  }

  /**
   * Get recent messages for LLM context with optional summary
   * @param {string} sessionId - Session identifier
   * @param {Object} options - Options for retrieval
   * @returns {Promise<Object>} { messages: BaseMessage[], summary: string|null }
   */
  async getRecentMessages(sessionId, options = {}) {
    const {
      windowSize = this.windowSize,
      includeSummary = this.includeSummary
    } = options;

    try {
      // Get conversation summary if enabled
      let summary = null;
      if (includeSummary) {
        const summaryRecord = await conversationStore.getSummary(sessionId);
        summary = summaryRecord?.content || null;
      }

      // Get total message count
      const totalCount = await conversationStore.getMessageCount(sessionId);
      
      // Calculate how many messages to skip (for sliding window)
      const skip = Math.max(0, totalCount - windowSize);
      
      // Get last N messages
      const messageRecords = await conversationStore.getMessages(sessionId, {
        limit: windowSize,
        offset: skip,
        orderBy: 'asc'
      });

      // Convert database records to LangChain messages
      const messages = messageRecords.map(record => this.recordToMessage(record));

      console.log(chalk.gray(
        `   📚 Loaded ${messages.length}/${totalCount} messages` +
        (summary ? ' + summary' : '')
      ));

      return { messages, summary, totalCount };
    } catch (error) {
      console.error(chalk.red(`   ❌ Error loading messages: ${error.message}`));
      return { messages: [], summary: null, totalCount: 0 };
    }
  }

  /**
   * Build full context for LLM including summary and recent messages
   * @param {string} sessionId - Session identifier
   * @param {string} systemPrompt - Base system prompt
   * @returns {Promise<BaseMessage[]>} Array of messages ready for LLM
   */
  async buildContext(sessionId, systemPrompt) {
    const { messages, summary } = await this.getRecentMessages(sessionId);
    
    const contextMessages = [];

    // Add base system prompt
    contextMessages.push(new SystemMessage(systemPrompt));

    // Add summary as additional system context if available
    if (summary) {
      contextMessages.push(new SystemMessage(
        `📋 **Previous Conversation Context:**\n${summary}\n\n` +
        `(The above is a summary of our earlier conversation. Continue from where we left off.)`
      ));
    }

    // Add recent messages
    contextMessages.push(...messages);

    return contextMessages;
  }

  /**
   * Convert database record to LangChain message
   * @param {Object} record - Database message record
   * @returns {BaseMessage} LangChain message
   */
  recordToMessage(record) {
    const content = record.content;
    
    switch (record.role) {
      case 'human':
        return new HumanMessage(content);
      
      case 'ai':
        const aiMsg = new AIMessage(content);
        if (record.toolCalls) {
          try {
            aiMsg.tool_calls = JSON.parse(record.toolCalls);
          } catch (e) {
            // Ignore parse errors
          }
        }
        return aiMsg;
      
      case 'system':
        return new SystemMessage(content);
      
      case 'tool':
        return new ToolMessage({
          content,
          tool_call_id: record.toolCallId || 'unknown'
        });
      
      default:
        return new HumanMessage(content);
    }
  }

  /**
   * Check if summarization is needed based on message count
   * @param {string} sessionId - Session identifier
   * @param {number} threshold - Message threshold for summarization
   * @returns {Promise<boolean>} Whether summarization is needed
   */
  async needsSummarization(sessionId, threshold = null) {
    const summarizationThreshold = threshold || config.memory?.summarizationThreshold || 20;
    const unsummarizedCount = await conversationStore.getMessageCount(sessionId, true);
    return unsummarizedCount >= summarizationThreshold;
  }
}

/**
 * Convenience function - get recent messages for a session
 * @param {string} sessionId - Session identifier
 * @param {Object} options - Options
 * @returns {Promise<Object>} { messages, summary, totalCount }
 */
export async function getRecentMessages(sessionId, options = {}) {
  const manager = new SlidingWindowManager(options);
  return manager.getRecentMessages(sessionId, options);
}
