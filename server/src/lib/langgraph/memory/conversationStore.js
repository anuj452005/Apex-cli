// Conversation Store - CRUD operations for conversations and messages
// Stores full conversation history in PostgreSQL via Prisma

import { PrismaClient } from '@prisma/client';
import chalk from 'chalk';

const prisma = new PrismaClient();

export class ConversationStore {
  
  /**
   * Create or get a conversation for the given session
   * @param {string} sessionId - Unique session identifier
   * @param {string} userId - Optional user ID
   * @returns {Promise<Object>} Conversation record
   */
  async getOrCreateConversation(sessionId, userId = null) {
    try {
      let conversation = await prisma.conversation.findUnique({
        where: { sessionId },
        include: { summary: true }
      });

      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: {
            sessionId,
            userId,
            title: `Session ${sessionId.slice(0, 8)}...`
          },
          include: { summary: true }
        });
        console.log(chalk.gray(`   📝 Created new conversation: ${sessionId}`));
      }

      return conversation;
    } catch (error) {
      console.error(chalk.red(`   ❌ Error getting/creating conversation: ${error.message}`));
      throw error;
    }
  }

  /**
   * Add a message to the conversation
   * @param {string} sessionId - Session identifier
   * @param {Object} message - Message data
   * @returns {Promise<Object>} Created message record
   */
  async addMessage(sessionId, { role, content, toolCalls = null, toolCallId = null }) {
    try {
      const conversation = await this.getOrCreateConversation(sessionId);
      
      const message = await prisma.conversationMessage.create({
        data: {
          conversationId: conversation.id,
          role,
          content: typeof content === 'string' ? content : JSON.stringify(content),
          toolCalls: toolCalls ? JSON.stringify(toolCalls) : null,
          toolCallId,
          tokenCount: this.estimateTokens(content)
        }
      });

      // Update conversation timestamp
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() }
      });

      return message;
    } catch (error) {
      console.error(chalk.red(`   ❌ Error adding message: ${error.message}`));
      throw error;
    }
  }

  /**
   * Add multiple messages at once
   * @param {string} sessionId - Session identifier
   * @param {Array} messages - Array of message objects
   * @returns {Promise<number>} Number of messages created
   */
  async addMessages(sessionId, messages) {
    const conversation = await this.getOrCreateConversation(sessionId);
    
    const data = messages.map(msg => ({
      conversationId: conversation.id,
      role: msg.role || this.getRoleFromMessage(msg),
      content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
      toolCalls: msg.tool_calls ? JSON.stringify(msg.tool_calls) : null,
      toolCallId: msg.tool_call_id || null,
      tokenCount: this.estimateTokens(msg.content)
    }));

    const result = await prisma.conversationMessage.createMany({ data });
    return result.count;
  }

  /**
   * Get all messages for a conversation
   * @param {string} sessionId - Session identifier
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of message records
   */
  async getMessages(sessionId, options = {}) {
    const { 
      limit = null, 
      offset = 0, 
      excludeSummarized = false,
      orderBy = 'asc' 
    } = options;

    try {
      const conversation = await prisma.conversation.findUnique({
        where: { sessionId }
      });

      if (!conversation) {
        return [];
      }

      const where = { conversationId: conversation.id };
      if (excludeSummarized) {
        where.summarized = false;
      }

      const messages = await prisma.conversationMessage.findMany({
        where,
        orderBy: { createdAt: orderBy },
        skip: offset,
        take: limit || undefined
      });

      return messages;
    } catch (error) {
      console.error(chalk.red(`   ❌ Error getting messages: ${error.message}`));
      return [];
    }
  }

  /**
   * Get message count for a conversation
   * @param {string} sessionId - Session identifier
   * @param {boolean} excludeSummarized - Exclude already summarized messages
   * @returns {Promise<number>} Message count
   */
  async getMessageCount(sessionId, excludeSummarized = false) {
    try {
      const conversation = await prisma.conversation.findUnique({
        where: { sessionId }
      });

      if (!conversation) return 0;

      const where = { conversationId: conversation.id };
      if (excludeSummarized) {
        where.summarized = false;
      }

      return await prisma.conversationMessage.count({ where });
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get conversation summary
   * @param {string} sessionId - Session identifier
   * @returns {Promise<Object|null>} Summary record or null
   */
  async getSummary(sessionId) {
    try {
      const conversation = await prisma.conversation.findUnique({
        where: { sessionId },
        include: { summary: true }
      });

      return conversation?.summary || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Save or update conversation summary
   * @param {string} sessionId - Session identifier
   * @param {string} content - Summary content
   * @param {number} messagesCount - Number of messages summarized
   * @param {string} lastMessageId - ID of last message included in summary
   * @returns {Promise<Object>} Summary record
   */
  async saveSummary(sessionId, content, messagesCount, lastMessageId = null) {
    const conversation = await this.getOrCreateConversation(sessionId);

    const summary = await prisma.conversationSummary.upsert({
      where: { conversationId: conversation.id },
      update: {
        content,
        messagesCount,
        lastMessageId,
        updatedAt: new Date()
      },
      create: {
        conversationId: conversation.id,
        content,
        messagesCount,
        lastMessageId
      }
    });

    console.log(chalk.gray(`   📋 Saved conversation summary (${messagesCount} messages)`));
    return summary;
  }

  /**
   * Mark messages as summarized
   * @param {Array<string>} messageIds - IDs of messages to mark
   * @returns {Promise<number>} Number of messages updated
   */
  async markAsSummarized(messageIds) {
    const result = await prisma.conversationMessage.updateMany({
      where: { id: { in: messageIds } },
      data: { summarized: true }
    });
    return result.count;
  }

  /**
   * Delete a conversation and all its messages
   * @param {string} sessionId - Session identifier
   * @returns {Promise<boolean>} Success status
   */
  async deleteConversation(sessionId) {
    try {
      await prisma.conversation.delete({
        where: { sessionId }
      });
      console.log(chalk.gray(`   🗑️ Deleted conversation: ${sessionId}`));
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * List all conversations
   * @param {string} userId - Optional user ID filter
   * @returns {Promise<Array>} Array of conversation records
   */
  async listConversations(userId = null) {
    const where = userId ? { userId } : {};
    
    return await prisma.conversation.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { messages: true } }
      }
    });
  }

  /**
   * Helper: Estimate token count (rough approximation)
   */
  estimateTokens(content) {
    if (!content) return 0;
    const text = typeof content === 'string' ? content : JSON.stringify(content);
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Helper: Get role from LangChain message type
   */
  getRoleFromMessage(message) {
    const type = message._getType?.() || message.constructor?.name || 'unknown';
    const roleMap = {
      'human': 'human',
      'HumanMessage': 'human',
      'ai': 'ai',
      'AIMessage': 'ai',
      'system': 'system',
      'SystemMessage': 'system',
      'tool': 'tool',
      'ToolMessage': 'tool'
    };
    return roleMap[type] || 'unknown';
  }

  /**
   * Cleanup: Close Prisma connection
   */
  async disconnect() {
    await prisma.$disconnect();
  }
}

// Export singleton instance
export const conversationStore = new ConversationStore();
