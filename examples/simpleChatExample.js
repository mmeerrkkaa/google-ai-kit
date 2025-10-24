const { GeminiClient } = require('../dist/index');
require('dotenv').config();

/**
 * Example demonstrating the new simplified Chat API
 * Similar to Google GenAI SDK style - clean and intuitive
 */

const API_KEY = process.env.GEMINI_API_KEY;

// ============================================================
// Example 1: Basic Chat Conversation
// ============================================================
async function basicChatExample() {
  console.log("\n" + "=".repeat(60));
  console.log("Example 1: Basic Chat Conversation");
  console.log("=".repeat(60));

  const client = new GeminiClient({
    apiKeys: [API_KEY],
    defaultModel: "gemini-2.5-flash",
    debugMode: false
  });

  // Create a chat session - super simple!
  const chat = client.chats.create({
    model: 'gemini-2.5-flash'
  });

  // Send first message
  console.log("\nUser: Why is the sky blue?");
  const response1 = await chat.sendMessage({ message: 'Why is the sky blue?' });
  console.log(`\nModel: ${response1.text()}`);

  // Send follow-up message - history is automatically maintained!
  console.log("\n" + "-".repeat(60));
  console.log("\nUser: Why is the sunset red?");
  const response2 = await chat.sendMessage({ message: 'Why is the sunset red?' });
  console.log(`\nModel: ${response2.text()}`);

  // View conversation history
  console.log("\n" + "-".repeat(60));
  console.log("\nConversation History:");
  const history = chat.getHistory();
  history.forEach((content, index) => {
    const role = content.role === 'user' ? 'User' : 'Model';
    const text = content.parts[0]?.text || '[non-text content]';
    console.log(`\n${index + 1}. ${role}: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
  });
}

// ============================================================
// Example 2: Chat with System Instruction
// ============================================================
async function chatWithSystemInstruction() {
  console.log("\n" + "=".repeat(60));
  console.log("Example 2: Chat with System Instruction");
  console.log("=".repeat(60));

  const client = new GeminiClient({
    apiKeys: [API_KEY],
    defaultModel: "gemini-2.5-flash"
  });

  // Create chat with system instruction
  const chat = client.chats.create({
    model: 'gemini-2.5-flash',
    systemInstruction: 'You are a helpful assistant that always responds in Russian.'
  });

  console.log("\nUser: Hello, how are you?");
  const response = await chat.sendMessage('Hello, how are you?');
  console.log(`\nModel: ${response.text()}`);
}

// ============================================================
// Example 3: Streaming Chat
// ============================================================
async function streamingChatExample() {
  console.log("\n" + "=".repeat(60));
  console.log("Example 3: Streaming Chat");
  console.log("=".repeat(60));

  const client = new GeminiClient({
    apiKeys: [API_KEY],
    defaultModel: "gemini-2.5-flash"
  });

  const chat = client.chats.create({
    model: 'gemini-2.5-flash'
  });

  console.log("\nUser: Write a short story about a robot.");
  console.log("\nModel (streaming): ");

  // Stream the response
  const stream = chat.sendMessageStream({ message: 'Write a short story about a robot.' });

  for await (const chunk of stream) {
    // For streaming, access text from candidates directly
    const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) {
      process.stdout.write(text);
    }
  }

  console.log("\n");
}

// ============================================================
// Example 4: Chat with Generation Config
// ============================================================
async function chatWithConfig() {
  console.log("\n" + "=".repeat(60));
  console.log("Example 4: Chat with Custom Generation Config");
  console.log("=".repeat(60));

  const client = new GeminiClient({
    apiKeys: [API_KEY],
    defaultModel: "gemini-2.5-flash"
  });

  // Create chat with custom config
  const chat = client.chats.create({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0.9,
      maxOutputTokens: 100,
      topP: 0.95
    }
  });

  console.log("\nUser: Tell me a creative joke.");
  const response = await chat.sendMessage('Tell me a creative joke.');
  console.log(`\nModel: ${response.text()}`);
}

// ============================================================
// Example 5: Multiple Conversations
// ============================================================
async function multipleConversations() {
  console.log("\n" + "=".repeat(60));
  console.log("Example 5: Multiple Independent Conversations");
  console.log("=".repeat(60));

  const client = new GeminiClient({
    apiKeys: [API_KEY],
    defaultModel: "gemini-2.5-flash"
  });

  // Create two separate chat sessions
  const mathChat = client.chats.create({
    model: 'gemini-2.5-flash',
    systemInstruction: 'You are a math tutor. Give brief, clear explanations.'
  });

  const poetryChat = client.chats.create({
    model: 'gemini-2.5-flash',
    systemInstruction: 'You are a poet. Respond with short poems.'
  });

  // Math conversation
  console.log("\n--- Math Chat ---");
  console.log("\nUser: What is 15 * 23?");
  const mathResponse = await mathChat.sendMessage('What is 15 * 23?');
  console.log(`\nMath Tutor: ${mathResponse.text()}`);

  // Poetry conversation
  console.log("\n--- Poetry Chat ---");
  console.log("\nUser: Write about the moon.");
  const poetryResponse = await poetryChat.sendMessage('Write about the moon.');
  console.log(`\nPoet: ${poetryResponse.text()}`);

  console.log("\n--- Histories are separate ---");
  console.log(`Math chat history length: ${mathChat.getHistory().length}`);
  console.log(`Poetry chat history length: ${poetryChat.getHistory().length}`);
}

// ============================================================
// Example 6: Restoring Chat History
// ============================================================
async function restoreChatHistory() {
  console.log("\n" + "=".repeat(60));
  console.log("Example 6: Saving and Restoring Chat History");
  console.log("=".repeat(60));

  const client = new GeminiClient({
    apiKeys: [API_KEY],
    defaultModel: "gemini-2.5-flash"
  });

  // Create first chat
  const chat1 = client.chats.create({
    model: 'gemini-2.5-flash'
  });

  console.log("\n--- First Chat Session ---");
  console.log("User: My name is Alex.");
  await chat1.sendMessage('My name is Alex.');

  console.log("\nUser: What is 2+2?");
  const response1 = await chat1.sendMessage('What is 2+2?');
  console.log(`Model: ${response1.text()}`);

  // Save history
  const savedHistory = chat1.getHistory();
  console.log(`\nSaved history with ${savedHistory.length} messages`);

  // Create new chat and restore history
  const chat2 = client.chats.create({
    model: 'gemini-2.5-flash',
    history: savedHistory
  });

  console.log("\n--- Second Chat Session (with restored history) ---");
  console.log("User: What is my name?");
  const response2 = await chat2.sendMessage('What is my name?');
  console.log(`Model: ${response2.text()}`);
}

// ============================================================
// Example 7: String Shorthand
// ============================================================
async function stringShorthand() {
  console.log("\n" + "=".repeat(60));
  console.log("Example 7: String Shorthand (Even Simpler!)");
  console.log("=".repeat(60));

  const client = new GeminiClient({
    apiKeys: [API_KEY],
    defaultModel: "gemini-2.5-flash"
  });

  const chat = client.chats.create({
    model: 'gemini-2.5-flash'
  });

  // You can pass just a string instead of an object!
  console.log("\nUser: Hello!");
  const response1 = await chat.sendMessage('Hello!');
  console.log(`Model: ${response1.text()}`);

  console.log("\nUser: How are you?");
  const response2 = await chat.sendMessage('How are you?');
  console.log(`Model: ${response2.text()}`);
}

// ============================================================
// Example 8: Predefined Conversation History
// ============================================================
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

// ============================================================
// Run all examples
// ============================================================
async function runAllExamples() {
  try {
    await basicChatExample();
    await new Promise(resolve => setTimeout(resolve, 1000));

    await chatWithSystemInstruction();
    await new Promise(resolve => setTimeout(resolve, 1000));

    await streamingChatExample();
    await new Promise(resolve => setTimeout(resolve, 1000));

    await chatWithConfig();
    await new Promise(resolve => setTimeout(resolve, 1000));

    await multipleConversations();
    await new Promise(resolve => setTimeout(resolve, 1000));

    await restoreChatHistory();
    await new Promise(resolve => setTimeout(resolve, 1000));

    await stringShorthand();
    await new Promise(resolve => setTimeout(resolve, 1000));

    await predefinedConversationHistory();

    console.log("\n" + "=".repeat(60));
    console.log("All examples completed successfully!");
    console.log("=".repeat(60));
  } catch (error) {
    console.error("\nError running examples:", error);
  }
}

// Run all examples or uncomment individual ones to test
runAllExamples();

// Uncomment to run individual examples:
// basicChatExample();
// chatWithSystemInstruction();
// streamingChatExample();
// chatWithConfig();
// multipleConversations();
// restoreChatHistory();
// stringShorthand();
// predefinedConversationHistory();
