import Message from '../models/Message.js';

class MessageDAO {
  // Save a new message
  async saveMessage(messageData) {
    try {
      const message = new Message(messageData);
      return await message.save();
    } catch (error) {
      if (error.code === 11000) {
        // Duplicate message, return existing
        return await Message.findOne({ messageId: messageData.messageId });
      }
      throw error;
    }
  }

  // Get recent messages for a specific chat
  async getRecentMessages(sessionId, chatId, limit = 20, offset = 0) {
    return await Message.find({ 
      sessionId, 
      chatId, 
      isDeleted: false 
    })
    .sort({ timestamp: -1 })
    .skip(offset)
    .limit(limit)
    .exec();
  }

  // Get all chats with their last message for a session
  async getAllChatsWithLastMessage(sessionId, limit = 50) {
    return await Message.getAllChatsWithLastMessage(sessionId, limit);
  }

  // Get message by ID
  async getMessageById(messageId, sessionId) {
    return await Message.findOne({ messageId, sessionId });
  }

  // Update message status
  async updateMessageStatus(messageId, status) {
    return await Message.findOneAndUpdate(
      { messageId },
      { status },
      { new: true }
    );
  }

  // Mark messages as read for a chat
  async markMessagesAsRead(sessionId, chatId) {
    return await Message.updateMany(
      { 
        sessionId, 
        chatId, 
        fromMe: false, 
        status: { $ne: 'read' } 
      },
      { status: 'read' }
    );
  }

  // Delete message (soft delete)
  async deleteMessage(messageId) {
    return await Message.findOneAndUpdate(
      { messageId },
      { isDeleted: true },
      { new: true }
    );
  }

  // Get message statistics for a session
  async getMessageStats(sessionId) {
    const stats = await Message.aggregate([
      { $match: { sessionId, isDeleted: false } },
      {
        $group: {
          _id: null,
          totalMessages: { $sum: 1 },
          sentMessages: { $sum: { $cond: ['$fromMe', 1, 0] } },
          receivedMessages: { $sum: { $cond: ['$fromMe', 0, 1] } },
          unreadMessages: { 
            $sum: { 
              $cond: [
                { $and: [{ $eq: ['$fromMe', false] }, { $ne: ['$status', 'read'] }] }, 
                1, 
                0
              ] 
            } 
          }
        }
      }
    ]);
    
    return stats[0] || {
      totalMessages: 0,
      sentMessages: 0,
      receivedMessages: 0,
      unreadMessages: 0
    };
  }

  // Search messages
  async searchMessages(sessionId, query, limit = 50) {
    return await Message.find({
      sessionId,
      isDeleted: false,
      $or: [
        { 'content.text': { $regex: query, $options: 'i' } },
        { 'content.caption': { $regex: query, $options: 'i' } },
        { sender: { $regex: query, $options: 'i' } }
      ]
    })
    .sort({ timestamp: -1 })
    .limit(limit)
    .exec();
  }

  // Get messages for a date range
  async getMessagesByDateRange(sessionId, startDate, endDate, limit = 100) {
    return await Message.find({
      sessionId,
      isDeleted: false,
      timestamp: {
        $gte: startDate,
        $lte: endDate
      }
    })
    .sort({ timestamp: -1 })
    .limit(limit)
    .exec();
  }

  // Bulk save messages (for initial sync)
  async bulkSaveMessages(messages) {
    const operations = messages.map(msg => ({
      updateOne: {
        filter: { messageId: msg.messageId },
        update: { $set: msg },
        upsert: true
      }
    }));

    return await Message.bulkWrite(operations);
  }
}

export default new MessageDAO();
