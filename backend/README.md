# Lock-in Backend API

Express.js backend server that powers the Lock-in Chrome extension.

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment:**
   Create a `.env` file:
   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   PORT=3000
   DAILY_REQUEST_LIMIT=100
   CHAT_LIST_LIMIT=5
   ```

3. **Run development server:**
   ```bash
   npm run dev
   ```

4. **For production:**
   ```bash
   npm start
   ```

## Project Structure

```
backend/
├── index.js              # Server entry point
├── app.js                # Express application setup
├── config.js             # Centralized configuration
├── routes/
│   └── lockinRoutes.js   # API route definitions
├── controllers/
│   └── lockinController.js  # Request handlers
├── openaiClient.js       # OpenAI API integration
├── chatRepository.js     # Database operations
├── supabaseClient.js     # Supabase client
├── authMiddleware.js     # Authentication middleware
├── rateLimiter.js        # Rate limiting
└── package.json          # Dependencies
```

## API Documentation

### Health Check

```
GET /health
```

Returns the status of the API.

**Response:**
```json
{
  "status": "ok",
  "message": "Lock-in API is running",
  "limits": {
    "maxSelectionLength": 5000,
    "maxUserMessageLength": 1500
  }
}
```

### Process Text

```
POST /api/lockin
```

Process text with AI assistance.

**Request Body:**
```json
{
  "selection": "The text to process",
  "mode": "explain",
  "targetLanguage": "en",
  "difficultyLevel": "highschool",
  "chatHistory": [],
  "newUserMessage": "Optional follow-up question",
  "chatId": "optional-existing-chat-id"
}
```

**Response:**
```json
{
  "chatId": "uuid",
  "mode": "explain",
  "answer": "AI-generated response",
  "chatHistory": [],
  "usage": {
    "prompt_tokens": 100,
    "completion_tokens": 50
  }
}
```

### List Chats

```
GET /api/chats?limit=10
```

Get recent chats for authenticated user.

### Delete Chat

```
DELETE /api/chats/:chatId
```

Delete a chat and all its messages.

### Get Chat Messages

```
GET /api/chats/:chatId/messages
```

Get all messages for a specific chat.

## Environment Variables

| Variable              | Description                    | Default |
| --------------------- | ------------------------------ | ------- |
| `OPENAI_API_KEY`      | Your OpenAI API key (required) | -       |
| `PORT`                | Server port                    | 3000    |
| `DAILY_REQUEST_LIMIT` | Requests per user per day      | 100     |
| `CHAT_LIST_LIMIT`     | Default chat list size         | 5       |

## Security

- ✅ All endpoints require authentication (Supabase JWT)
- ✅ Rate limiting per user (configurable daily limit)
- ✅ Input validation and sanitization
- ✅ CORS restricted to Chrome extensions
- ✅ No sensitive data in logs
- ✅ Error messages don't expose internal details

## Dependencies

- **express**: Web framework
- **cors**: Cross-origin resource sharing
- **dotenv**: Environment variable management
- **openai**: Official OpenAI API client
- **@supabase/supabase-js**: Supabase client library

## Development

```bash
npm run dev  # Starts with nodemon for auto-reload
npm start    # Production server
```

## Testing

```bash
# Health check
curl http://localhost:3000/health

# Test explain mode (requires auth token)
curl -X POST http://localhost:3000/api/lockin \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"selection":"Photosynthesis is the process","mode":"explain"}'
```

## License

MIT
