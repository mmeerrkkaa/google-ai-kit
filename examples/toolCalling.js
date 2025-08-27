const { GeminiClient, SchemaType, FunctionCallingMode, FinishReason } = require('../dist/index');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// --- Пример данных ---
const mockUsers = [ { id: "user_1001", nick: "alice" }, { id: "user_1002", nick: "bob" } ];
const mockMessages = [ { id: "msg_101", userId: "user_1001", content: "Привет от alice!" }, { id: "msg_102", userId: "user_1002", content: "Привет от bob!" },  { id: "msg_103", userId: "user_1001", content: "Это второе сообщение от alice." }];
// ---

// --- Определения инструментов с методом execute ---
const getUserIdByNickTool = {
  name: "getUserIdByNick",
  description: "Получает ID пользователя по его никнейму",
  parameters: { type: SchemaType.OBJECT, properties: { nick: { type: SchemaType.STRING, description: "Никнейм пользователя" } }, required: ["nick"] },
  execute: async (args) => {
    console.log(`\n[Tool Execute: getUserIdByNick] Args: ${JSON.stringify(args)}`);
    await new Promise(res => setTimeout(res, 50 + Math.random() * 50)); 
    const user = mockUsers.find(u => u.nick.toLowerCase() === args.nick.toLowerCase());
    return user ? { userId: user.id, found: true } : { userId: null, found: false, message: `Пользователь с ником '${args.nick}' не найден.` };
  }
};

const getUserMessagesTool = {
  name: "getUserMessages",
  description: "Получает все сообщения пользователя по его ID",
  parameters: { type: SchemaType.OBJECT, properties: { userId: { type: SchemaType.STRING, description: "ID пользователя" } }, required: ["userId"] },
  execute: async (args) => {
    console.log(`\n[Tool Execute: getUserMessages] Args: ${JSON.stringify(args)}`);
    await new Promise(res => setTimeout(res, 50 + Math.random() * 50)); 
    const userMessages = mockMessages.filter(m => m.userId === args.userId);
    if (userMessages.length === 0 && !mockUsers.find(u => u.id === args.userId)) {
        return { messages: [], count: 0, found: false, message: `Пользователь с ID '${args.userId}' не существует.` };
    }
    return { messages: userMessages, count: userMessages.length, found: userMessages.length > 0 };
  }
};

const geminiTools = [{
  functionDeclarations: [getUserIdByNickTool, getUserMessagesTool] // Передаем объекты с execute
}];
// ---
// Глобальная функция executeTool больше не нужна, так как execute теперь часть определения инструмента
// globalThis.executeTool = ... (УДАЛЕНО)
// ---

async function main() {
  const apiKeysEnv = process.env.GOOGLE_API_KEYS;
  if (!apiKeysEnv) {
    console.error("GOOGLE_API_KEYS not found in .env file.");
    process.exit(1);
  }
  const apiKeys = apiKeysEnv.split(',').map(key => key.trim()).filter(key => key.length > 0);
  if (apiKeys.length === 0) {
    console.error("No valid API keys found in GOOGLE_API_KEYS.");
    process.exit(1);
  }

  let proxySettings;
  if (process.env.PROXY_HOST && process.env.PROXY_PORT) {
    proxySettings = {
      host: process.env.PROXY_HOST,
      port: process.env.PROXY_PORT,
      user: process.env.PROXY_USER,
      pass: process.env.PROXY_PASS,
      protocol: process.env.PROXY_PROTOCOL || 'http'
    };
    console.log(`Using proxy: ${proxySettings.host}:${proxySettings.port}`);
  }

  const targetModel = "gemini-2.5-flash";
  const userIdForHistory = "tool_user_js_004"; 
  const diskStorePath = path.join(__dirname, '.gemini_tool_history_js');


  const client = new GeminiClient({
    apiKeys: apiKeys,
    proxy: proxySettings,
    defaultModel: targetModel,
    messageStoreConfig: { type: 'disk', path: diskStorePath },
    defaultMaxToolCalls: 2 
  });

  console.log(`===== Gemini API Tool Calling Showcase (Model: ${targetModel}, User: ${userIdForHistory}) =====`);

  const initialPrompt = "Найди все сообщения пользователя alice.";
  
  try {
    console.log(`\nUser Query: "${initialPrompt}"`);

    const response = await client.generateContent({
      prompt: initialPrompt,
      tools: geminiTools,
      toolConfig: { 
        functionCallingConfig: { 
            mode: FunctionCallingMode.AUTO,
            maxCalls: 3 // Лимит для этого конкретного запроса
        } 
      },
      generationConfig: { 
        temperature: 0.2, 
        maxOutputTokens: 1000,
      },
      user: "1" 
    });

    console.log("\n--- Final Response from generateContent ---");
    if (response.promptFeedback?.blockReason) {
        console.error(`Request was blocked: ${response.promptFeedback.blockReason}`);
        if(response.promptFeedback.blockReasonMessage) console.error(`Message: ${response.promptFeedback.blockReasonMessage}`);
    }

    const finalCandidate = response.candidates?.[0];
    if (finalCandidate) {
        console.log("Finish Reason:", finalCandidate.finishReason);
        if (finalCandidate.finishReason === FinishReason.MAX_TOOL_CALLS_REACHED) {
            console.warn("Generation stopped because max tool calls limit was reached.");
        }
        const textOutput = response.text();
        if (textOutput) {
            console.log("Final AI Text Output:\n", textOutput);
        } else {
            console.log("No final text output from model.");
            if (finalCandidate.content?.parts && finalCandidate.content.parts.some(p => p.functionCall)) {
                 console.log("Last model action was a function call (or limit reached before text):", JSON.stringify(finalCandidate.content.parts, null, 2));
            } else if (finalCandidate.content?.parts) {
                 console.log("Last model parts (no text and no function call):", JSON.stringify(finalCandidate.content.parts, null, 2));
            }
        }
    } else {
        console.log("No candidates in the final response.");
    }


  } catch (error) {
    console.error("\n--- ERROR DURING PROCESSING ---");
    console.error(error.message);
    if (error.details) console.error("Details:", error.details);
    if (error.stack) console.error(error.stack);
  }
}

main();