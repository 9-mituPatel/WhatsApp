# Production WhatsApp API - Clean Architecture

## 📁 Project Structure

```
src/
├── 📁 config/
│   ├── database.js              # Database configuration & connection
│   ├── environment.js           # Environment variables validation
│   ├── redis.js                # Redis configuration
│   ├── swagger.js               # API documentation config
│   └── providers.js             # WhatsApp provider configurations
│
├── 📁 core/
│   ├── 📁 errors/
│   │   ├── AppError.js          # Base error class
│   │   ├── ValidationError.js   # Input validation errors
│   │   ├── BusinessError.js     # Business logic errors
│   │   └── index.js            # Error exports
│   │
│   ├── 📁 interfaces/
│   │   ├── IWhatsAppProvider.js # WhatsApp provider interface
│   │   ├── IRepository.js       # Repository pattern interface
│   │   └── IMessageHandler.js   # Message handler interface
│   │
│   └── 📁 constants/
│       ├── statusCodes.js       # HTTP status codes
│       ├── messageTypes.js      # WhatsApp message types
│       └── events.js            # Application events
│
├── 📁 infrastructure/
│   ├── 📁 database/
│   │   ├── 📁 models/
│   │   │   ├── User.js
│   │   │   ├── Session.js
│   │   │   ├── Message.js
│   │   │   ├── Group.js
│   │   │   ├── Contact.js
│   │   │   └── Template.js
│   │   │
│   │   ├── 📁 repositories/
│   │   │   ├── BaseRepository.js
│   │   │   ├── UserRepository.js
│   │   │   ├── SessionRepository.js
│   │   │   ├── MessageRepository.js
│   │   │   ├── GroupRepository.js
│   │   │   └── ContactRepository.js
│   │   │
│   │   └── migrations/           # Database migrations
│   │
│   ├── 📁 providers/
│   │   ├── 📁 baileys/
│   │   │   ├── BaileysProvider.js
│   │   │   ├── BaileysSessionManager.js
│   │   │   └── BaileysMessageHandler.js
│   │   │
│   │   ├── 📁 whatsapp-cloud/
│   │   │   ├── CloudProvider.js
│   │   │   ├── CloudMessageHandler.js
│   │   │   └── CloudWebhookHandler.js
│   │   │
│   │   └── 📁 twilio/
│   │       ├── TwilioProvider.js
│   │       └── TwilioMessageHandler.js
│   │
│   ├── 📁 cache/
│   │   ├── RedisCache.js        # Redis implementation
│   │   └── MemoryCache.js       # In-memory fallback
│   │
│   └── 📁 storage/
│       ├── LocalStorage.js      # Local file storage
│       ├── S3Storage.js         # AWS S3 storage
│       └── CloudinaryStorage.js # Cloudinary integration
│
├── 📁 application/
│   ├── 📁 use-cases/
│   │   ├── 📁 auth/
│   │   │   ├── InitiateSession.js
│   │   │   ├── VerifyOTP.js
│   │   │   └── LogoutSession.js
│   │   │
│   │   ├── 📁 messaging/
│   │   │   ├── SendTextMessage.js
│   │   │   ├── SendMediaMessage.js
│   │   │   ├── SendTemplateMessage.js
│   │   │   ├── ReceiveMessage.js
│   │   │   └── GetChatHistory.js
│   │   │
│   │   ├── 📁 groups/
│   │   │   ├── CreateGroup.js
│   │   │   ├── ManageGroupMembers.js
│   │   │   └── GetGroupInfo.js
│   │   │
│   │   └── 📁 contacts/
│   │       ├── SyncContacts.js
│   │       └── ManageContacts.js
│   │
│   ├── 📁 services/
│   │   ├── AuthService.js       # Authentication logic
│   │   ├── MessageService.js    # Message processing
│   │   ├── SessionService.js    # Session management
│   │   ├── GroupService.js      # Group operations
│   │   ├── ContactService.js    # Contact management
│   │   ├── MediaService.js      # Media handling
│   │   ├── TemplateService.js   # Message templates
│   │   ├── WebhookService.js    # Webhook processing
│   │   └── NotificationService.js # Push notifications
│   │
│   └── 📁 dto/
│       ├── MessageDTO.js        # Message data transfer objects
│       ├── SessionDTO.js        # Session DTOs
│       └── UserDTO.js          # User DTOs
│
├── 📁 presentation/
│   ├── 📁 controllers/
│   │   ├── BaseController.js    # Base controller with common methods
│   │   ├── AuthController.js    # Authentication endpoints
│   │   ├── MessageController.js # Message endpoints
│   │   ├── SessionController.js # Session management
│   │   ├── GroupController.js   # Group operations
│   │   ├── WebhookController.js # Webhook handling
│   │   └── MediaController.js   # Media upload/download
│   │
│   ├── 📁 routes/
│   │   ├── index.js            # Main router
│   │   ├── auth.js             # Auth routes
│   │   ├── messages.js         # Message routes
│   │   ├── sessions.js         # Session routes
│   │   ├── groups.js           # Group routes
│   │   ├── webhooks.js         # Webhook routes
│   │   └── media.js            # Media routes
│   │
│   ├── 📁 middleware/
│   │   ├── auth.js             # JWT authentication
│   │   ├── validation.js       # Request validation
│   │   ├── rateLimiting.js     # Rate limiting
│   │   ├── errorHandler.js     # Global error handling
│   │   ├── requestLogger.js    # HTTP request logging
│   │   ├── cors.js             # CORS configuration
│   │   ├── helmet.js           # Security headers
│   │   └── webhookVerification.js # Webhook signature verification
│   │
│   └── 📁 validators/
│       ├── authValidators.js    # Auth input validation
│       ├── messageValidators.js # Message validation
│       └── commonValidators.js  # Shared validators
│
├── 📁 shared/
│   ├── 📁 utils/
│   │   ├── logger.js           # Winston logger setup
│   │   ├── response.js         # Standardized API responses
│   │   ├── encryption.js       # Encryption utilities
│   │   ├── phoneNumber.js      # Phone number utilities
│   │   ├── mediaProcessor.js   # Media processing
│   │   ├── qrCodeGenerator.js  # QR code utilities
│   │   └── dateTime.js         # Date/time helpers
│   │
│   ├── 📁 helpers/
│   │   ├── asyncHandler.js     # Async error wrapper
│   │   ├── pagination.js       # Pagination helpers
│   │   ├── sanitizer.js        # Input sanitization
│   │   └── validator.js        # Common validations
│   │
│   └── 📁 events/
│       ├── EventEmitter.js     # Application events
│       ├── MessageEvents.js    # Message-related events
│       └── SessionEvents.js    # Session-related events
│
├── 📁 tests/
│   ├── 📁 unit/
│   │   ├── services/           # Service layer tests
│   │   ├── controllers/        # Controller tests
│   │   └── utils/              # Utility tests
│   │
│   ├── 📁 integration/
│   │   ├── api/                # API integration tests
│   │   ├── database/           # Database tests
│   │   └── providers/          # Provider tests
│   │
│   ├── 📁 fixtures/
│   │   └── testData.js         # Test data and mocks
│   │
│   └── setup.js                # Test environment setup
│
├── 📁 docs/
│   ├── api/                    # API documentation
│   ├── deployment/             # Deployment guides
│   └── architecture/           # Architecture documentation
│
└── app.js                      # Application entry point

## Root Files
├── .env.example                # Environment variables template
├── .gitignore                  # Git ignore rules
├── .dockerignore               # Docker ignore rules
├── Dockerfile                  # Docker configuration
├── docker-compose.yml          # Docker compose for development
├── package.json                # Dependencies and scripts
├── jest.config.js              # Jest testing configuration
├── eslint.config.js            # ESLint configuration
├── prettier.config.js          # Prettier configuration
└── README.md                   # Project documentation
```

## 🏗️ Architecture Principles

### 1. **Clean Architecture Layers**
- **Presentation Layer**: Controllers, Routes, Middleware
- **Application Layer**: Use Cases, Services, DTOs
- **Infrastructure Layer**: Repositories, Providers, External Services
- **Core Layer**: Business Logic, Interfaces, Constants

### 2. **Design Patterns**
- **Repository Pattern**: Data access abstraction
- **Factory Pattern**: Provider instantiation
- **Observer Pattern**: Event handling
- **Strategy Pattern**: Multiple WhatsApp providers
- **Dependency Injection**: Loose coupling

### 3. **Best Practices**
- **Single Responsibility**: Each class has one purpose
- **Open/Closed**: Open for extension, closed for modification
- **Interface Segregation**: Small, focused interfaces
- **Dependency Inversion**: Depend on abstractions
- **DRY**: Don't Repeat Yourself
- **YAGNI**: You Aren't Gonna Need It

### 4. **Error Handling Strategy**
- **Centralized Error Handling**: Global error middleware
- **Custom Error Classes**: Typed error responses
- **Error Logging**: Structured error logs
- **Graceful Degradation**: Fallback mechanisms

### 5. **Security Implementation**
- **Input Validation**: Joi/Zod validation
- **Authentication**: JWT tokens
- **Rate Limiting**: Express rate limit
- **CORS**: Cross-origin resource sharing
- **Helmet**: Security headers
- **Webhook Verification**: Signature validation
