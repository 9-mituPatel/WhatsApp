import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  messageId: {
    type: String,
    required: true,
    unique: true
  },
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  chatId: {
    type: String,
    required: true,
    index: true
  },
  fromMe: {
    type: Boolean,
    required: true,
    default: false
  },
  sender: {
    type: String,
    required: true
  },
  recipient: {
    type: String,
    required: true
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'video', 'audio', 'document', 'sticker', 'location', 'contact', 'other'],
    default: 'text'
  },
  content: {
    text: String,
    caption: String,
    mediaUrl: String,
    fileName: String,
    mimeType: String,
    fileSize: Number,
    duration: Number, // For audio/video
    location: {
      latitude: Number,
      longitude: Number,
      address: String
    },
    contact: {
      name: String,
      phone: String
    }
  },
  timestamp: {
    type: Date,
    required: true,
    index: true
  },
  quotedMessage: {
    messageId: String,
    content: String,
    sender: String
  },
  status: {
    type: String,
    enum: ['pending', 'sent', 'delivered', 'read', 'failed'],
    default: 'sent'
  },
  isForwarded: {
    type: Boolean,
    default: false
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  rawMessage: {
    type: mongoose.Schema.Types.Mixed
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  versionKey: false
});

// Indexes for better query performance
messageSchema.index({ sessionId: 1, chatId: 1, timestamp: -1 });
messageSchema.index({ sessionId: 1, timestamp: -1 });
messageSchema.index({ messageId: 1, sessionId: 1 });

// Static methods
messageSchema.statics.getRecentMessages = function(sessionId, chatId, limit = 20) {
  return this.find({ 
    sessionId, 
    chatId, 
    isDeleted: false 
  })
  .sort({ timestamp: -1 })
  .limit(limit)
  .exec();
};

messageSchema.statics.getAllChatsWithLastMessage = function(sessionId, limit = 50) {
  return this.aggregate([
    { $match: { sessionId, isDeleted: false } },
    { $sort: { timestamp: -1 } },
    {
      $group: {
        _id: '$chatId',
        lastMessage: { $first: '$$ROOT' },
        messageCount: { $sum: 1 },
        unreadCount: { 
          $sum: { 
            $cond: [
              { $and: [{ $eq: ['$fromMe', false] }, { $ne: ['$status', 'read'] }] }, 
              1, 
              0
            ] 
          } 
        }
      }
    },
    { $sort: { 'lastMessage.timestamp': -1 } },
    { $limit: limit }
  ]);
};

const Message = mongoose.model('Message', messageSchema);

export default Message;
