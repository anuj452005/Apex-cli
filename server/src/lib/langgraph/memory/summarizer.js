// Conversation Summarizer - Summarize older messages into a concise context
// Runs as a background step when message count exceeds threshold

import chalk from 'chalk';
import { conversationStore } from './conversationStore.js';
import { createBaseLLM } from '../llm.js';
import { config } from '../../../config/google.config.js';

// Prompt for summarizing conversations
const SUMMARIZATION_PROMPT = `You are a conversation summarizer. Your task is to create a concise but comprehensive summary of the conversation below.

**Instructions:**
- Preserve key decisions made during the conversation
- Keep track of important information shared by the user (names, preferences, goals)
- Note any ongoing tasks or objectives
- Maintain context needed for the AI assistant to continue helping effectively
- Be concise but don't lose critical details
- Write in past tense, as if describing what happened

**Conversation to summarize:**
{conversation}

**Generate a summary in 2-3 paragraphs:**`;

export class ConversationSummarizer {
  
  constructor(options = {}) {
    this.threshold = options.threshold || config.memory?.summarizationThreshold || 20;
    this.keepRecent = options.keepRecent || config.memory?.windowSize || 10;
    this.enabled = options.enabled !== false && config.memory?.enableSummarization !== false;
  }

  /**
   * Check if summarization should run for this session
   * @param {string} sessionId - Session identifier
   * @returns {Promise<boolean>} Whether summarization is needed
   */
  async shouldSummarize(sessionId) {
    if (!this.enabled) return false;
    
    const unsummarizedCount = await conversationStore.getMessageCount(sessionId, true);
    return unsummarizedCount >= this.threshold;
  }

  /**
   * Summarize older messages in a conversation
   * @param {string} sessionId - Session identifier
   * @param {Object} options - Summarization options
   * @returns {Promise<Object|null>} Summary record or null
   */
  async summarize(sessionId, options = {}) {
    const {
      threshold = this.threshold,
      keepRecent = this.keepRecent
    } = options;

    try {
      // Get all unsummarized messages
      const allMessages = await conversationStore.getMessages(sessionId, {
        excludeSummarized: true,
        orderBy: 'asc'
      });

      if (allMessages.length < threshold) {
        console.log(chalk.gray(`   ℹ️ Not enough messages for summarization (${allMessages.length}/${threshold})`));
        return null;
      }

      // Determine which messages to summarize (all except keepRecent)
      const messagesToSummarize = allMessages.slice(0, allMessages.length - keepRecent);
      
      if (messagesToSummarize.length === 0) {
        return null;
      }

      console.log(chalk.cyan(`   📝 Summarizing ${messagesToSummarize.length} messages...`));

      // Format messages for the summarization prompt
      const conversationText = this.formatMessagesForSummary(messagesToSummarize);

      // Get existing summary to include as context
      const existingSummary = await conversationStore.getSummary(sessionId);
      
      // Build prompt
      let fullPrompt = SUMMARIZATION_PROMPT.replace('{conversation}', conversationText);
      
      if (existingSummary) {
        fullPrompt = `**Previous Summary:**\n${existingSummary.content}\n\n` + fullPrompt;
      }

      // Call LLM to generate summary
      const llm = createBaseLLM({ temperature: 0.3, maxTokens: 1024 });
      const response = await llm.invoke(fullPrompt);
      const summaryContent = response.content;

      // Get the ID of the last summarized message
      const lastMessageId = messagesToSummarize[messagesToSummarize.length - 1].id;

      // Calculate total messages summarized (including previous)
      const totalSummarized = (existingSummary?.messagesCount || 0) + messagesToSummarize.length;

      // Save the summary
      const summary = await conversationStore.saveSummary(
        sessionId,
        summaryContent,
        totalSummarized,
        lastMessageId
      );

      // Mark messages as summarized
      const messageIds = messagesToSummarize.map(m => m.id);
      await conversationStore.markAsSummarized(messageIds);

      console.log(chalk.green(`   ✅ Summarized ${messagesToSummarize.length} messages`));

      return summary;
    } catch (error) {
      console.error(chalk.red(`   ❌ Summarization error: ${error.message}`));
      return null;
    }
  }

  /**
   * Run summarization in background (non-blocking)
   * @param {string} sessionId - Session identifier
   */
  async summarizeInBackground(sessionId) {
    // Run summarization without blocking
    setImmediate(async () => {
      try {
        const shouldRun = await this.shouldSummarize(sessionId);
        if (shouldRun) {
          await this.summarize(sessionId);
        }
      } catch (error) {
        console.error(chalk.yellow(`   ⚠️ Background summarization failed: ${error.message}`));
      }
    });
  }

  /**
   * Format messages for the summarization prompt
   * @param {Array} messages - Message records
   * @returns {string} Formatted conversation text
   */
  formatMessagesForSummary(messages) {
    return messages.map(msg => {
      const roleLabel = this.getRoleLabel(msg.role);
      const content = msg.content.slice(0, 500); // Truncate very long messages
      const truncated = msg.content.length > 500 ? '...' : '';
      return `${roleLabel}: ${content}${truncated}`;
    }).join('\n\n');
  }

  /**
   * Get human-readable role label
   * @param {string} role - Message role
   * @returns {string} Role label
   */
  getRoleLabel(role) {
    const labels = {
      'human': '👤 User',
      'ai': '🤖 Assistant',
      'system': '⚙️ System',
      'tool': '🔧 Tool Result'
    };
    return labels[role] || role;
  }
}

/**
 * Convenience function - summarize a conversation
 * @param {string} sessionId - Session identifier
 * @param {Object} options - Options
 * @returns {Promise<Object|null>} Summary or null
 */
export async function summarizeConversation(sessionId, options = {}) {
  const summarizer = new ConversationSummarizer(options);
  return summarizer.summarize(sessionId, options);
}
