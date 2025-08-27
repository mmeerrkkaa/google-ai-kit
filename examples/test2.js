const { GeminiClient, SchemaType } = require('../dist/index');
const path = require('path');
const fs = require('fs');

async function runMessageStoreTest() {
  const apiKey = process.env.GOOGLE_API_KEYS ? process.env.GOOGLE_API_KEYS.split(',')[0] : "YOUR_FALLBACK_API_KEY";
  if (apiKey === "YOUR_FALLBACK_API_KEY") {
    console.warn("Using fallback API key. Please set GOOGLE_API_KEYS in .env");
  }


  const proxyConfig = {
    host: process.env.PROXY_HOST || '',
    port: process.env.PROXY_PORT || '',
    user: process.env.PROXY_USER || '',
    pass: process.env.PROXY_PASS || ''
  };

  const modelToUse = "gemini-2.5-flash";
  const userId = "testUser123";
  const diskStorePath = path.join(__dirname, '.gemini_history');

  console.log("\n--- Testing with Memory Message Store ---");
  const clientMemory = new GeminiClient({
    apiKeys: [apiKey],
    proxy: proxyConfig,
    defaultModel: modelToUse,
    messageStoreConfig: { type: 'memory' }
  });

  console.log(`\n[Memory] Chat 1 for user: ${userId}`);
  let response1Memory = await clientMemory.chat({
    prompt: "Привет! Меня зовут " + userId + ".",
    user: userId
  });
  console.log("AI (Memory):", response1Memory.text());

  console.log(`\n[Memory] Chat 2 for user: ${userId} (AI should remember name)`);
  let response2Memory = await clientMemory.chat({
    prompt: "Как меня зовут?",
    user: userId
  });
  console.log("AI (Memory):", response2Memory.text());
  
  if (response2Memory.text() && response2Memory.text().toLowerCase().includes(userId.toLowerCase())) {
    console.log("[Memory] SUCCESS: AI remembered the user's name.");
  } else {
    console.log("[Memory] FAILURE: AI did not remember the user's name.");
  }

  console.log("\n\n--- Testing with Disk Message Store ---");
  const userHistoryFilePath = path.join(diskStorePath, `${userId}.json`);
  if (fs.existsSync(userHistoryFilePath)) {
    fs.unlinkSync(userHistoryFilePath);
    console.log(`[Disk] Cleared previous history file: ${userHistoryFilePath}`);
  }


  const clientDisk = new GeminiClient({
    apiKeys: [apiKey],
    proxy: proxyConfig,
    defaultModel: modelToUse,
    messageStoreConfig: { type: 'disk', path: diskStorePath }
  });

  console.log(`\n[Disk] Chat 1 for user: ${userId}`);
  let response1Disk = await clientDisk.chat({
    prompt: "Привет! Мой любимый цвет - синий.",
    user: userId
  });
  console.log("AI (Disk):", response1Disk.text());

  console.log(`\n[Disk] Chat 2 for user: ${userId} (AI should remember favorite color)`);
  const clientDiskNewSession = new GeminiClient({
    apiKeys: [apiKey],
    proxy: proxyConfig,
    defaultModel: modelToUse,
    messageStoreConfig: { type: 'disk', path: diskStorePath }
  });
  let response2Disk = await clientDiskNewSession.chat({
    prompt: "Какой мой любимый цвет?",
    user: userId
  });
  console.log("AI (Disk - New Session):", response2Disk.text());

  if (response2Disk.text() && response2Disk.text().toLowerCase().includes("синий")) {
    console.log("[Disk] SUCCESS: AI remembered the user's favorite color from disk.");
  } else {
    console.log("[Disk] FAILURE: AI did not remember the user's favorite color from disk.");
  }

  console.log("\n\n--- Testing generateContent with prompt and user (Disk Store) ---");
  const kingdomName = "Эльдорадо";
  const kingdomSchema = {
    type: SchemaType.OBJECT,
    properties: {
      kingdomName: { type: SchemaType.STRING },
      mainExport: { type: SchemaType.STRING },
      population: { type: SchemaType.INTEGER },
    },
    required: ["kingdomName", "mainExport", "population"]
  };
  
  console.log(`\n[Disk GC] generateContent 1 for user: ${userId}`);
  const jsonResponse1 = await clientDisk.generateContent({
    prompt: `Расскажи мне о королевстве ${kingdomName}. Какой у них основной экспорт?`,
    user: userId,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: kingdomSchema,
      maxOutputTokens: 1000,
    }
  });
  const kingdomData1 = jsonResponse1.json();
  console.log("AI (Disk GC - JSON 1):", JSON.stringify(kingdomData1, null, 2));

  console.log(`\n[Disk GC] generateContent 2 for user: ${userId} (should have context of kingdom)`);
  const clientDiskNewSessionGC = new GeminiClient({
    apiKeys: [apiKey], proxy: proxyConfig, defaultModel: modelToUse, messageStoreConfig: { type: 'disk', path: diskStorePath }
  });
  const followupResponse = await clientDiskNewSessionGC.generateContent({
    prompt: `Какова была численность населения этого королевства (${kingdomName})? Ответь кратко.`,
    user: userId,
  });
  console.log("AI (Disk GC - Follow-up):", followupResponse.text());
   if (followupResponse.text() && kingdomData1 && kingdomData1.population && followupResponse.text().includes(String(kingdomData1.population))) {
    console.log("[Disk GC] SUCCESS: AI likely used context for population.");
  } else {
    console.log("[Disk GC] FAILURE: AI might not have used context for population. Check response and stored history.");
  }


  if (fs.existsSync(userHistoryFilePath)) {
    console.log(`[Disk] Test history file left for inspection: ${userHistoryFilePath}`);
  }
  if (fs.existsSync(diskStorePath) && fs.readdirSync(diskStorePath).length === 0) {
    fs.rmdirSync(diskStorePath);
    console.log(`[Disk] Cleaned up empty history directory: ${diskStorePath}`);
  }
}

require('dotenv').config();
runMessageStoreTest().catch(error => {
  console.error("\nUnhandled error in runMessageStoreTest:", error);
});