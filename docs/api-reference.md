# WhatsApp API - API Reference

## Table of Contents
- [Base URL](#base-url)
- [Authentication](#authentication)
- [HTTP Status Codes](#http-status-codes)
- [Response Format](#response-format)
- [Authentication Endpoints](#authentication-endpoints)
- [Messaging Endpoints](#messaging-endpoints)
- [Session Management](#session-management)
- [Health Check](#health-check)
- [WebSocket Events](#websocket-events)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Examples](#examples)

## Base URL

**Development**: `http://localhost:3000`  
**Production**: `https://your-domain.com`

All API endpoints are prefixed with `/api`

## Authentication

The API uses session-based authentication. Each WhatsApp session requires a unique `sessionId` for identification.

### Session ID Format
- **Type**: String
- **Format**: Alphanumeric with optional special characters
- **Example**: `user123_device1`, `session_abc123`

## HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | OK - Request successful |
| 201 | Created - Resource created successfully |
| 400 | Bad Request - Invalid request data |
| 401 | Unauthorized - Authentication required |
| 404 | Not Found - Resource not found |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error - Server error |

## Response Format

All API responses follow a consistent JSON format:

```json
{
  "success": true,
  "message": "Description of the result",
  "data": {
    // Response data
  },
  "error": null // Only present on errors
}
```

## Authentication Endpoints

### 1. QR Login
Generate QR code or create WhatsApp session.

**Endpoint**: `POST /api/auth/QRlogin`

**Request Body**:
```json
{
  "sessionId": "unique_session_identifier"
}
```

**Response** (QR Generated):
```json
{
  "success": true,
  "message": "QR Code generated successfully",
  "data": {
    "sessionId": "unique_session_identifier",
    "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "status": "qr_generated",
    "instructions": {
      "step1": "Open WhatsApp on your phone",
      "step2": "Go to Settings → Linked Devices",
      "step3": "Tap \"Link Device\"",
      "step4": "Scan the QR code"
    }
  }
}
```

**Response** (Already Connected):
```json
{
  "success": true,
  "message": "Already connected to WhatsApp",
  "data": {
    "sessionId": "unique_session_identifier",
    "status": "connected",
    "user": {
      "id": "1234567890:1@s.whatsapp.net",
      "name": "User Name",
      "phone": "1234567890"
    },
    "alreadyConnected": true
  }
}
```

**Response** (Auto-Reconnected):
```json
{
  "success": true,
  "message": "Auto-reconnected to WhatsApp",
  "data": {
    "sessionId": "unique_session_identifier",
    "status": "connected",
    "user": {
      "id": "1234567890:1@s.whatsapp.net",
      "name": "User Name",
      "phone": "1234567890"
    },
    "autoReconnected": true
  }
}
```

### 2. Check Session Status
Check the current status of a WhatsApp session.

**Endpoint**: `GET /api/auth/status/:sessionId`

**Parameters**:
- `sessionId` (path) - Session identifier

**Response**:
```json
{
  "success": true,
  "message": "Session is active",
  "data": {
    "sessionId": "unique_session_identifier",
    "status": "connected",
    "user": {
      "id": "1234567890:1@s.whatsapp.net",
      "name": "User Name",
      "phone": "1234567890"
    }
  }
}
```

### 3. Logout Session
Terminate and cleanup a WhatsApp session.

**Endpoint**: `POST /api/auth/logout/:sessionId`

**Parameters**:
- `sessionId` (path) - Session identifier

**Response**:
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

## Messaging Endpoints

### 1. Send Text Message
Send a text message to a WhatsApp number.

**Endpoint**: `POST /api/messaging/send-text`

**Request Body**:
```json
{
  "sessionId": "unique_session_identifier",
  "to": "1234567890@s.whatsapp.net",
  "text": "Hello, this is a test message!",
  "quotedMessageId": "optional_quoted_message_id"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Text message sent successfully",
  "data": {
    "messageId": "3EB0C431C266D23DCCFE2E_123456789",
    "status": "sent",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "to": "1234567890@s.whatsapp.net"
  }
}
```

### 2. Send Image Message
Send an image with optional caption.

**Endpoint**: `POST /api/messaging/send-image`

**Request** (multipart/form-data):
- `sessionId` (string) - Session identifier
- `to` (string) - WhatsApp number
- `image` (file) - Image file (JPG, PNG, WebP)
- `caption` (string, optional) - Image caption

**Response**:
```json
{
  "success": true,
  "message": "Image message sent successfully",
  "data": {
    "messageId": "3EB0C431C266D23DCCFE2E_123456789",
    "status": "sent",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "to": "1234567890@s.whatsapp.net",
    "caption": "Image caption text"
  }
}
```

### 3. Send Document Message
Send a document file.

**Endpoint**: `POST /api/messaging/send-document`

**Request** (multipart/form-data):
- `sessionId` (string) - Session identifier
- `to` (string) - WhatsApp number
- `document` (file) - Document file
- `filename` (string) - Document filename

**Response**:
```json
{
  "success": true,
  "message": "Document sent successfully",
  "data": {
    "messageId": "3EB0C431C266D23DCCFE2E_123456789",
    "status": "sent",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "to": "1234567890@s.whatsapp.net",
    "filename": "document.pdf"
  }
}
```

### 4. Send Location Message
Send location coordinates.

**Endpoint**: `POST /api/messaging/send-location`

**Request Body**:
```json
{
  "sessionId": "unique_session_identifier",
  "to": "1234567890@s.whatsapp.net",
  "latitude": 37.7749,
  "longitude": -122.4194,
  "address": "San Francisco, CA, USA"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Location sent successfully",
  "data": {
    "messageId": "3EB0C431C266D23DCCFE2E_123456789",
    "status": "sent",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "to": "1234567890@s.whatsapp.net",
    "location": {
      "latitude": 37.7749,
      "longitude": -122.4194,
      "address": "San Francisco, CA, USA"
    }
  }
}
```

### 5. Get Chat Messages
Retrieve chat history with a contact.

**Endpoint**: `GET /api/messaging/chat/:sessionId/:chatId`

**Parameters**:
- `sessionId` (path) - Session identifier
- `chatId` (path) - WhatsApp chat ID
- `limit` (query, optional) - Number of messages (default: 20)
- `offset` (query, optional) - Offset for pagination (default: 0)

**Response**:
```json
{
  "success": true,
  "message": "Chat messages retrieved successfully",
  "data": {
    "chatId": "1234567890@s.whatsapp.net",
    "messages": [
      {
        "messageId": "3EB0C431C266D23DCCFE2E_123456789",
        "fromMe": false,
        "sender": "1234567890@s.whatsapp.net",
        "content": {
          "text": "Hello there!"
        },
        "messageType": "text",
        "timestamp": "2024-01-15T10:25:00.000Z",
        "status": "received"
      }
    ],
    "totalCount": 150,
    "limit": 20,
    "offset": 0
  }
}
```

### 6. Get All Chats
Retrieve all active chats with last message.

**Endpoint**: `GET /api/messaging/chats/:sessionId`

**Parameters**:
- `sessionId` (path) - Session identifier
- `limit` (query, optional) - Number of chats (default: 50)

**Response**:
```json
{
  "success": true,
  "message": "All chats retrieved successfully",
  "data": {
    "chats": [
      {
        "chatId": "1234567890@s.whatsapp.net",
        "name": "Contact Name",
        "lastMessage": {
          "content": {
            "text": "Last message text"
          },
          "timestamp": "2024-01-15T10:30:00.000Z",
          "fromMe": true
        },
        "unreadCount": 3
      }
    ],
    "totalCount": 25,
    "limit": 50
  }
}
```

### 7. Mark Messages as Read
Mark all messages in a chat as read.

**Endpoint**: `PUT /api/messaging/mark-read`

**Request Body**:
```json
{
  "sessionId": "unique_session_identifier",
  "chatId": "1234567890@s.whatsapp.net"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Messages marked as read successfully"
}
```

## Session Management

### 1. Get Session Info
Get detailed information about a session.

**Endpoint**: `GET /api/session/:sessionId/info`

**Response**:
```json
{
  "success": true,
  "message": "Session information retrieved",
  "data": {
    "sessionId": "unique_session_identifier",
    "isConnected": true,
    "phoneNumber": "1234567890",
    "name": "User Name",
    "user": {
      "id": "1234567890:1@s.whatsapp.net",
      "name": "User Name"
    },
    "lastActivity": "2024-01-15T10:30:00.000Z"
  }
}
```

### 2. Get All Active Sessions
Get list of all active sessions.

**Endpoint**: `GET /api/session/active`

**Response**:
```json
{
  "success": true,
  "message": "Active sessions retrieved",
  "data": {
    "sessions": [
      {
        "sessionId": "session_1",
        "isConnected": true,
        "phoneNumber": "1234567890",
        "name": "User Name",
        "lastActivity": "2024-01-15T10:30:00.000Z"
      }
    ],
    "totalCount": 1
  }
}
```

## Health Check

### System Health
Check API server status and basic metrics.

**Endpoint**: `GET /api/health`

**Response**:
```json
{
  "status": "OK",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "service": "WhatsApp API Server"
}
```

## WebSocket Events

The API uses Socket.IO for real-time communication. Connect to the WebSocket server at the base URL.

### Client Events (Emit to Server)

#### 1. Join Session
Join a session room for receiving session-specific events.

```javascript
socket.emit('join-session', sessionId);
```

#### 2. Monitor Session
Start monitoring a session for authentication updates.

```javascript
socket.emit('monitor-session', sessionId);
```

#### 3. Get Session Status
Request current session status.

```javascript
socket.emit('get-session-status', sessionId);
```

### Server Events (Listen from Server)

#### 1. QR Code Generated
Receive QR code data when generated.

```javascript
socket.on('qr-code', (data) => {
  console.log('QR Code:', data);
  // data = {
  //   sessionId: "unique_session_identifier",
  //   qrCode: "data:image/png;base64,...",
  //   status: "qr_generated"
  // }
});
```

#### 2. Authentication Status Updates
Receive real-time authentication status changes.

```javascript
socket.on('auth-status', (data) => {
  console.log('Auth Status:', data);
  // data = {
  //   sessionId: "unique_session_identifier",
  //   status: "connecting|syncing|qr_expired",
  //   message: "Status description"
  // }
});
```

#### 3. Authentication Success
Receive notification when authentication completes successfully.

```javascript
socket.on('auth-success', (data) => {
  console.log('Authentication Success:', data);
  // data = {
  //   sessionId: "unique_session_identifier",
  //   status: "authenticated",
  //   user: {
  //     id: "1234567890:1@s.whatsapp.net",
  //     name: "User Name",
  //     phone: "1234567890"
  //   },
  //   message: "WhatsApp authentication successful!",
  //   timestamp: "2024-01-15T10:30:00.000Z"
  // }
});
```

#### 4. Session Status Response
Receive session status in response to get-session-status request.

```javascript
socket.on('session-status', (data) => {
  console.log('Session Status:', data);
  // data = {
  //   sessionId: "unique_session_identifier",
  //   status: "connected|not_found|error",
  //   lastActivity: "2024-01-15T10:30:00.000Z",
  //   createdAt: "2024-01-15T10:00:00.000Z"
  // }
});
```

#### 5. QR Refresh
Notification that QR code needs to be refreshed.

```javascript
socket.on('qr-refresh', (data) => {
  console.log('QR Refresh Required:', data);
  // data = {
  //   sessionId: "unique_session_identifier",
  //   message: "QR code expired, please refresh"
  // }
});
```

## Error Handling

### Standard Error Response
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message",
  "code": "ERROR_CODE" // Optional error code
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| `INVALID_SESSION_ID` | Session ID is required or invalid |
| `SESSION_NOT_FOUND` | Session does not exist or is inactive |
| `SESSION_LIMIT_REACHED` | Maximum concurrent sessions exceeded |
| `QR_EXPIRED` | QR code has expired |
| `CONNECTION_FAILED` | Failed to establish WhatsApp connection |
| `MESSAGE_SEND_FAILED` | Failed to send message |
| `INVALID_PHONE_NUMBER` | Phone number format is invalid |
| `FILE_TOO_LARGE` | Uploaded file exceeds size limit |
| `UNSUPPORTED_FILE_TYPE` | File type not supported |

## Rate Limiting

The API implements rate limiting to prevent abuse:

- **Authentication Endpoints**: 5 requests per minute per IP
- **Messaging Endpoints**: 10 requests per minute per session
- **General Endpoints**: 100 requests per minute per IP

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642262400
```

## Examples

### Complete Authentication Flow

```javascript
// 1. Connect to WebSocket
const socket = io('http://localhost:3000');

// 2. Join session room
socket.emit('join-session', 'my_session_123');

// 3. Listen for QR code
socket.on('qr-code', (data) => {
  // Display QR code to user
  document.getElementById('qr-code').src = data.qrCode;
});

// 4. Listen for authentication success
socket.on('auth-success', (data) => {
  // Redirect to dashboard
  window.location.href = '/dashboard';
});

// 5. Request QR login
fetch('/api/auth/QRlogin', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ sessionId: 'my_session_123' })
});
```

### Send Message Example

```javascript
// Send text message
const response = await fetch('/api/messaging/send-text', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: 'my_session_123',
    to: '1234567890@s.whatsapp.net',
    text: 'Hello from API!'
  })
});

const result = await response.json();
console.log('Message sent:', result);
```

### Send Image Example

```javascript
// Send image message
const formData = new FormData();
formData.append('sessionId', 'my_session_123');
formData.append('to', '1234567890@s.whatsapp.net');
formData.append('image', fileInput.files[0]);
formData.append('caption', 'Check out this image!');

const response = await fetch('/api/messaging/send-image', {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log('Image sent:', result);
```

### Error Handling Example

```javascript
try {
  const response = await fetch('/api/auth/QRlogin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: 'my_session_123' })
  });

  const result = await response.json();
  
  if (!result.success) {
    throw new Error(result.message);
  }
  
  // Handle successful response
  console.log('Success:', result.data);
} catch (error) {
  console.error('API Error:', error.message);
  // Handle error appropriately
}
```

This API reference provides comprehensive documentation for integrating with the WhatsApp API, covering all available endpoints, WebSocket events, and practical usage examples.
