# Lock-in Backend API

Express.js backend server that powers the Lock-in Chrome extension.

## Quick Start

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Set up environment:**

   ```bash
   cp .env.example .env
   ```

   Then edit `.env` and add your OpenAI API key:

   ```
   OPENAI_API_KEY=sk-your-key-here
   ```

3. **Run development server:**

   ```bash
   npm run dev
   ```

4. **For production:**
   ```bash
   npm start
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
  "message": "Lock-in API is running"
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
  "text": "Your selected text here",
  "mode": "explain",
  "targetLanguage": "en"
}
```

**Parameters:**

- `text` (required): The text to process (max 5000 characters)
- `mode` (required): One of `explain`, `simplify`, or `translate`
- `targetLanguage` (optional): Language code for translations (e.g., 'en', 'es', 'zh')

**Response Examples:**

Explain mode:

```json
{
  "mode": "explain",
  "answer": "This is the explanation...",
  "example": "For example, if you..."
}
```

Simplify mode:

```json
{
  "mode": "simplify",
  "answer": "The simplified text..."
}
```

Translate mode:

```json
{
  "mode": "translate",
  "answer": "La traducción...",
  "explanation": "Una breve explicación..."
}
```

**Error Responses:**

400 Bad Request:

```json
{
  "error": "Bad Request",
  "message": "Text is required and cannot be empty"
}
```

500 Internal Server Error:

```json
{
  "error": "Internal Server Error",
  "message": "Failed to process your request. Please try again."
}
```

## Environment Variables

| Variable          | Description                    | Default             |
| ----------------- | ------------------------------ | ------------------- |
| `OPENAI_API_KEY`  | Your OpenAI API key (required) | -                   |
| `PORT`            | Server port                    | 3000                |
| `ALLOWED_ORIGINS` | CORS allowed origins           | chrome-extension:// |

## Project Structure

```
backend/
├── index.js          # Main Express application
├── openaiClient.js   # OpenAI API wrapper
├── package.json      # Dependencies and scripts
├── .env.example      # Environment template
└── .gitignore        # Git ignore rules
```

## Scripts

- `npm start` - Run production server
- `npm run dev` - Run development server with auto-reload (nodemon)

## Dependencies

- **express**: Web framework
- **cors**: Cross-origin resource sharing
- **dotenv**: Environment variable management
- **openai**: Official OpenAI API client

## Development Dependencies

- **nodemon**: Auto-restart server on file changes

## OpenAI Configuration

The backend uses OpenAI's API with the following configuration:

- **Model**: `gpt-4o-mini` (will be updated to `gpt-5-nano` when available)
- **Temperature**: 0.7 (balanced creativity)
- **Max Tokens**: 500 (quick, concise responses)

### Model Notes

Currently using `gpt-4o-mini` as it provides:

- Fast response times
- Cost-effective for student use cases
- High-quality explanations

When GPT-5 nano becomes available, update the model name in `openaiClient.js`:

```javascript
const model = "gpt-5-nano"; // Update this line
```

## Security Considerations

1. **API Key Protection**: Never commit `.env` file
2. **Request Validation**: All inputs are validated before processing
3. **Rate Limiting**: Consider adding rate limiting in production
4. **CORS**: Configured to accept Chrome extension requests
5. **Logging**: Production logs don't include full text content

## Deployment

### Local Development

```bash
npm run dev
```

### Production Deployment

#### Option 1: Traditional Hosting

1. Set environment variables on your server
2. Run `npm install --production`
3. Start with `npm start`

#### Option 2: Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

#### Option 3: Cloud Platforms

- **Heroku**: Add `Procfile` with `web: node index.js`
- **AWS Lambda**: Use with API Gateway
- **Google Cloud Run**: Deploy with Docker
- **Azure App Service**: Deploy directly from GitHub

## Monitoring

Consider adding:

- Request/response logging
- Error tracking (Sentry)
- Performance monitoring (New Relic)
- API usage analytics

## Testing

To test the API:

```bash
# Health check
curl http://localhost:3000/health

# Test explain mode
curl -X POST http://localhost:3000/api/lockin \
  -H "Content-Type: application/json" \
  -d '{"text":"Photosynthesis is the process by which plants make food","mode":"explain"}'

# Test simplify mode
curl -X POST http://localhost:3000/api/lockin \
  -H "Content-Type: application/json" \
  -d '{"text":"The mitochondria is the powerhouse of the cell","mode":"simplify"}'

# Test translate mode
curl -X POST http://localhost:3000/api/lockin \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello, how are you?","mode":"translate","targetLanguage":"es"}'
```

## Troubleshooting

### "Cannot find module 'openai'"

Run `npm install` to install dependencies.

### "OPENAI_API_KEY not found"

1. Create `.env` file from `.env.example`
2. Add your actual API key

### Port already in use

Change the PORT in `.env` or kill the process:

```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Mac/Linux
lsof -ti:3000 | xargs kill
```

## License

MIT
