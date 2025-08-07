/**
 * WhatsApp Message Types Constants
 * Defines all supported message types across different providers
 */

export const MESSAGE_TYPES = {
  // Basic message types
  TEXT: 'text',
  IMAGE: 'image',
  VIDEO: 'video', 
  AUDIO: 'audio',
  DOCUMENT: 'document',
  STICKER: 'sticker',
  LOCATION: 'location',
  CONTACT: 'contact',
  
  // Interactive message types
  INTERACTIVE: 'interactive',
  TEMPLATE: 'template',
  BUTTON: 'button',
  LIST: 'list',
  
  // Media types
  VOICE: 'voice',
  VIDEO_NOTE: 'video_note',
  
  // System message types
  REACTION: 'reaction',
  EDIT: 'edit',
  DELETE: 'delete',
  REVOKE: 'revoke',
  
  // Group message types
  GROUP_INVITE: 'group_invite',
  GROUP_NOTIFICATION: 'group_notification',
  
  // Other types
  UNKNOWN: 'unknown',
  UNSUPPORTED: 'unsupported'
};

/**
 * Message status types
 */
export const MESSAGE_STATUS = {
  PENDING: 'pending',
  QUEUED: 'queued',
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  FAILED: 'failed',
  REJECTED: 'rejected'
};

/**
 * Message directions
 */
export const MESSAGE_DIRECTION = {
  INBOUND: 'inbound',
  OUTBOUND: 'outbound'
};

/**
 * Interactive message subtypes
 */
export const INTERACTIVE_TYPES = {
  BUTTON: 'button',
  LIST: 'list',
  PRODUCT: 'product',
  PRODUCT_LIST: 'product_list',
  FLOW: 'flow'
};

/**
 * Template message categories
 */
export const TEMPLATE_CATEGORIES = {
  AUTHENTICATION: 'AUTHENTICATION',
  MARKETING: 'MARKETING', 
  UTILITY: 'UTILITY'
};

/**
 * Media file extensions by type
 */
export const MEDIA_EXTENSIONS = {
  [MESSAGE_TYPES.IMAGE]: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
  [MESSAGE_TYPES.VIDEO]: ['mp4', 'avi', 'mov', 'webm', '3gp'],
  [MESSAGE_TYPES.AUDIO]: ['mp3', 'wav', 'aac', 'ogg', 'm4a'],
  [MESSAGE_TYPES.VOICE]: ['ogg', 'mp3', 'wav', 'aac'],
  [MESSAGE_TYPES.DOCUMENT]: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'zip', 'rar'],
  [MESSAGE_TYPES.STICKER]: ['webp']
};

/**
 * Media MIME types
 */
export const MEDIA_MIME_TYPES = {
  // Images
  'image/jpeg': MESSAGE_TYPES.IMAGE,
  'image/jpg': MESSAGE_TYPES.IMAGE,
  'image/png': MESSAGE_TYPES.IMAGE,
  'image/gif': MESSAGE_TYPES.IMAGE,
  'image/webp': MESSAGE_TYPES.IMAGE,
  
  // Videos
  'video/mp4': MESSAGE_TYPES.VIDEO,
  'video/avi': MESSAGE_TYPES.VIDEO,
  'video/quicktime': MESSAGE_TYPES.VIDEO,
  'video/webm': MESSAGE_TYPES.VIDEO,
  'video/3gpp': MESSAGE_TYPES.VIDEO,
  
  // Audio
  'audio/mpeg': MESSAGE_TYPES.AUDIO,
  'audio/wav': MESSAGE_TYPES.AUDIO,
  'audio/aac': MESSAGE_TYPES.AUDIO,
  'audio/ogg': MESSAGE_TYPES.AUDIO,
  'audio/x-m4a': MESSAGE_TYPES.AUDIO,
  'audio/mp4': MESSAGE_TYPES.AUDIO,
  
  // Documents
  'application/pdf': MESSAGE_TYPES.DOCUMENT,
  'application/msword': MESSAGE_TYPES.DOCUMENT,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': MESSAGE_TYPES.DOCUMENT,
  'application/vnd.ms-excel': MESSAGE_TYPES.DOCUMENT,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': MESSAGE_TYPES.DOCUMENT,
  'text/plain': MESSAGE_TYPES.DOCUMENT,
  'application/zip': MESSAGE_TYPES.DOCUMENT,
  'application/x-rar-compressed': MESSAGE_TYPES.DOCUMENT
};

/**
 * File size limits (in bytes)
 */
export const FILE_SIZE_LIMITS = {
  [MESSAGE_TYPES.IMAGE]: 5 * 1024 * 1024, // 5MB
  [MESSAGE_TYPES.VIDEO]: 16 * 1024 * 1024, // 16MB
  [MESSAGE_TYPES.AUDIO]: 16 * 1024 * 1024, // 16MB
  [MESSAGE_TYPES.VOICE]: 16 * 1024 * 1024, // 16MB
  [MESSAGE_TYPES.DOCUMENT]: 100 * 1024 * 1024, // 100MB
  [MESSAGE_TYPES.STICKER]: 500 * 1024 // 500KB
};

/**
 * Message validation rules
 */
export const MESSAGE_LIMITS = {
  TEXT_MAX_LENGTH: 4096,
  CAPTION_MAX_LENGTH: 1024,
  BUTTON_TEXT_MAX_LENGTH: 20,
  BUTTON_MAX_COUNT: 3,
  LIST_ITEM_MAX_COUNT: 10,
  LIST_SECTION_MAX_COUNT: 10
};

/**
 * Utility functions
 */
export const MessageTypeUtils = {
  /**
   * Check if message type is media
   */
  isMediaType(type) {
    return [
      MESSAGE_TYPES.IMAGE,
      MESSAGE_TYPES.VIDEO,
      MESSAGE_TYPES.AUDIO,
      MESSAGE_TYPES.VOICE,
      MESSAGE_TYPES.DOCUMENT,
      MESSAGE_TYPES.STICKER
    ].includes(type);
  },

  /**
   * Check if message type is interactive
   */
  isInteractiveType(type) {
    return [
      MESSAGE_TYPES.INTERACTIVE,
      MESSAGE_TYPES.TEMPLATE,
      MESSAGE_TYPES.BUTTON,
      MESSAGE_TYPES.LIST
    ].includes(type);
  },

  /**
   * Get message type from MIME type
   */
  getTypeFromMimeType(mimeType) {
    return MEDIA_MIME_TYPES[mimeType] || MESSAGE_TYPES.UNKNOWN;
  },

  /**
   * Get file size limit for message type
   */
  getSizeLimit(type) {
    return FILE_SIZE_LIMITS[type] || FILE_SIZE_LIMITS[MESSAGE_TYPES.DOCUMENT];
  },

  /**
   * Validate file extension
   */
  isValidExtension(type, extension) {
    const validExtensions = MEDIA_EXTENSIONS[type];
    return validExtensions && validExtensions.includes(extension.toLowerCase());
  }
};

export default MESSAGE_TYPES;
