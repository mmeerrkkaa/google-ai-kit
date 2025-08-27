const { GeminiClient } = require('../dist/index');
require('dotenv').config();

async function runBooruTagAssistant() {
  const apiKey = [
    "AIzaSyA-pCdTZU7LbUAoY1AqLt7i7Lbkck1Mn3E"
  ];

  const proxyConfig = {
    host: process.env.PROXY_HOST || '',
    port: process.env.PROXY_PORT || '',
    user: process.env.PROXY_USER || '',
    pass: process.env.PROXY_PASS || ''
  };

  const client = new GeminiClient({
    apiKeys: apiKey,
    proxy: proxyConfig,
    defaultModel: "gemini-2.5-flash",
    debugMode: true
  });

  const systemInstructionText = "Ты БОТ Помощник";

  const userRequest = "привет";
  
  
  
  try {
    const response = await client.generateContent({
      prompt: userRequest,
      systemInstruction: {
        role: 'system',
        parts: [{ text: systemInstructionText }]
      }
    });

    console.log("\n--- Результат ---");
    console.log(response.text());

  } catch (error) {
    console.error("Произошла ошибка при вызове API:", error);
  }
}

runBooruTagAssistant().catch(console.error);