/**
 * Lock-in Backend Server
 * Express API that handles AI-powered text processing for the Chrome extension.
 *
 * This file is now a thin bootstrap that wires configuration + the Express app
 * and starts the HTTP server. All request handling lives in the app/routes/
 * and controllers/ folders to keep things testable and maintainable.
 */

require("dotenv").config();

const { createApp } = require("./app");
const { PORT } = require("./config");

const app = createApp();

app.listen(PORT, () => {
  console.log(`Lock-in backend server running on http://localhost:${PORT}`);
  console.log("Ready to help students learn!");

  if (!process.env.OPENAI_API_KEY) {
    console.warn("WARNING: OPENAI_API_KEY not found in environment variables!");
    console.warn("   Please create a .env file with your OpenAI API key.");
  }
});
