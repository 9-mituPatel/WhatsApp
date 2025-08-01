import mongoose from 'mongoose';

const whatsAppSessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  userId: {
    type: String,
    required: false,
    trim: true
  },
  phoneNumber: {
    type: String,
    required: false,
    trim: true
  },
  status: {
    type: String,
    enum: ['connecting', 'qr_generated', 'qr_expired', 'connected', 'disconnected', 'logged_out', 'reconnecting', 'expired'],
    default: 'connecting'
  },
  qrCode: {
    type: String,
    required: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastConnected: {
    type: Date,
    default: Date.now
  },
  connectionData: {
    type: mongoose.Schema.Types.Mixed,
    required: false
  },
  sessionPath: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  versionKey: false
});

// Index for better query performance
whatsAppSessionSchema.index({ sessionId: 1 });
whatsAppSessionSchema.index({ phoneNumber: 1 });
whatsAppSessionSchema.index({ status: 1 });
whatsAppSessionSchema.index({ isActive: 1 });

// Pre-save middleware to update updatedAt
whatsAppSessionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Instance methods
whatsAppSessionSchema.methods.updateStatus = function(status, additionalData = {}) {
  this.status = status;
  this.lastConnected = new Date();
  Object.assign(this, additionalData);
  return this.save();
};

whatsAppSessionSchema.methods.deactivate = function() {
  this.isActive = false;
  this.status = 'logged_out';
  return this.save();
};

// Static methods
whatsAppSessionSchema.statics.findActiveSession = function(sessionId) {
  return this.findOne({ sessionId, isActive: true });
};

whatsAppSessionSchema.statics.findByPhoneNumber = function(phoneNumber) {
  return this.findOne({ phoneNumber, isActive: true });
};

const WhatsAppSession = mongoose.model('WhatsAppSession', whatsAppSessionSchema);

export default WhatsAppSession;
