const { GeminiClient } = require('../dist/index');
require('dotenv').config();

const API_KEY = process.env.GEMINI_API_KEY;

async function predefinedConversationHistory() {
  console.log("\n" + "=".repeat(60));
  console.log("Example 8: Starting Chat with Predefined History");
  console.log("=".repeat(60));

  const client = new GeminiClient({
    apiKeys: [API_KEY],
    defaultModel: "gemini-2.5-flash"
  });

  // Create a predefined conversation history
  // Simulating a past conversation where AI asked for name
  const previousConversation = [
    {
      role: 'user',
      parts: [{ text: 'Hello! I would like to remember your name. Please tell me, what is your name?' }]
    },
    {
      role: 'model',
      parts: [{ text: 'Hello! I\'d be happy to help you remember my name, but I\'m an AI assistant - I don\'t have a personal name. However, I\'d love to know YOUR name so I can address you properly! What\'s your name?' }]
    },
    {
      role: 'user',
      parts: [{ text: 'Merka' }]
    },
    {
      role: 'model',
      parts: [{ text: 'Nice to meet you, Merka! I\'ll remember that. How can I help you today?' }]
    }
  ];

  console.log("\n--- Predefined conversation history ---");
  console.log("(Simulating a past conversation where user introduced themselves as 'Merka')");
  previousConversation.forEach((content, index) => {
    const role = content.role === 'user' ? 'User' : 'AI';
    const text = content.parts[0]?.text;
    console.log(`${index + 1}. ${role}: ${text}`);
  });

  // Create chat with the predefined history
  console.log("\n--- Creating new chat session with predefined history ---");
  const chat = client.chats.create({
    model: 'gemini-2.5-flash',
    history: previousConversation
  });

  console.log(`Chat initialized with ${previousConversation.length} messages from history`);

  // Now ask AI to recall the name
  console.log("\n--- Testing if AI remembers from predefined history ---");
  console.log("User: What is my name?\n");

  const recall = await chat.sendMessage('What is my name?');
  console.log(`AI: ${recall.text()}`);

  // Ask for a personalized message
  console.log("\n--- Asking for personalized content ---");
  console.log("User: Write me a short motivational message using my name.\n");

  const personalized = await chat.sendMessage('Write me a short motivational message using my name.');
  console.log(`AI: ${personalized.text()}`);

  // Show current conversation state
  console.log("\n--- Current Full History ---");
  const currentHistory = chat.getHistory();
  console.log(`Total messages: ${currentHistory.length} (${previousConversation.length} predefined + ${currentHistory.length - previousConversation.length} new)`);

  console.log("\nLast 3 messages:");
  currentHistory.slice(-3).forEach((content, index) => {
    const role = content.role === 'user' ? 'User' : 'AI';
    const text = content.parts[0]?.text || '[non-text content]';
    const preview = text.length > 100 ? text.substring(0, 100) + '...' : text;
    console.log(`${currentHistory.length - 2 + index}. ${role}: ${preview}`);
  });
}

predefinedConversationHistory().catch(console.error);
