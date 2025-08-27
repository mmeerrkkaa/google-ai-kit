import * as fs from 'fs';
import {
  GeminiClient,
  GenerateContentRequest,
  Content,
  SchemaType,
  EmbedContentRequest,
  CountTokensRequest,
  SystemInstruction,
  ProxyConfig,
  Schema,
  ChatMessage,
  FunctionCallingMode,
  ToolConfig
} from '../src';
import 'dotenv/config';

async function getCurrentWeather(location: string, unit: "celsius" | "fahrenheit" = "celsius"): Promise<object> {
  console.log(`[Tool Call] getCurrentWeather called for "${location}" in ${unit}`);
  const lowerLocation = location.toLowerCase();
  if (lowerLocation.includes("tokyo") || lowerLocation.includes("токио")) {
    return { location: "Tokyo", temperature: "15", unit: unit, forecast: "sunny" };
  } else if (lowerLocation.includes("london") || lowerLocation.includes("лондон")) {
    return { location: "London", temperature: "8", unit: unit, forecast: "cloudy" };
  }
  return { location: location, temperature: "unknown", unit: unit, forecast: "unknown" };
}

async function main() {
  const apiKeys = (process.env.GOOGLE_API_KEYS || "").split(',').map(k => k.trim()).filter(k => k);
  if (apiKeys.length === 0) {
    console.error("Please provide GOOGLE_API_KEYS in your .env file.");
    return;
  }

  let proxySettings: ProxyConfig | undefined = undefined;
  if (process.env.PROXY_HOST && process.env.PROXY_PORT) {
    proxySettings = {
      host: process.env.PROXY_HOST,
      port: process.env.PROXY_PORT,
      user: process.env.PROXY_USER,
      pass: process.env.PROXY_PASS,
    };
    console.log(`Using proxy: ${proxySettings.host}:${proxySettings.port}`);
  }

  const targetModel = "gemini-2.5-flash";

  const client = new GeminiClient({
    apiKeys: apiKeys,
    proxy: proxySettings,
    defaultModel: targetModel,
  });

  console.log(`===== Gemini API Showcase (Using Default Model: ${targetModel}) =====`);

  console.log("\n--- 1. Basic Text Generation (via client.chat) ---");
  try {
    const basicChatResponse = await client.chat({
        prompt: "Расскажи короткую историю о роботе.",
        generationConfig: { maxOutputTokens: 2000 }
    });
    console.log("Response:", basicChatResponse.text() || "No text.");
    if(basicChatResponse.text() === null) console.log("Raw Response (if text is null):", JSON.stringify(basicChatResponse, null, 2));
  } catch(e) { console.error("Error in Basic Text Generation:", e instanceof Error ? e.message : e); }


  console.log("\n--- 2. Chat Conversation & Function Calling (via client.generateContent) ---");
  try {
    const chatHistory: Content[] = [
      { role: "user", parts: [{ text: "Привет!" }] },
      { role: "model", parts: [{ text: "Привет! Как дела?" }] }
    ];
    const weatherQuery: Content = { role: "user", parts: [{ text: "Какая погода в Лондоне?" }] };
    const tools = [{
      functionDeclarations: [{
        name: "getCurrentWeather",
        description: "Получить текущую погоду.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: { location: { type: SchemaType.STRING, description: "Город для прогноза погоды" } },
          required: ["location"]
        }
      }]
    }];

    const toolConfigForceCall: ToolConfig = {
        functionCallingConfig: {
            mode: FunctionCallingMode.ANY,
        }
    };

    let genContentResponse = await client.generateContent({
      contents: [...chatHistory, weatherQuery],
      tools: tools,
      toolConfig: toolConfigForceCall,
      generationConfig: { maxOutputTokens: 500 }
    });

    let modelPart = genContentResponse.candidates?.[0]?.content?.parts?.[0];
    if (modelPart?.functionCall?.name === "getCurrentWeather") {
      console.log("Function Call:", modelPart.functionCall);
      const weatherArgs = modelPart.functionCall.args as { location: string };
      const weatherResult = await getCurrentWeather(weatherArgs.location);
      
      genContentResponse = await client.generateContent({
        contents: [
          ...chatHistory,
          weatherQuery,
          { role: "model", parts: [modelPart] },
          { role: "function", parts: [{ functionResponse: { name: "getCurrentWeather", response: { content: weatherResult } } }] }
        ],
        tools: tools,
        generationConfig: { maxOutputTokens: 500 }
      });
      console.log("Chat Response:", genContentResponse.text() || "No text after function response.");
    } else {
      console.log("Chat Response (no function call):", genContentResponse.text() || "No text and no function call.");
    }
  } catch(e) { console.error("Error in Chat Conversation:", e instanceof Error ? e.message : e); }


  console.log("\n--- 3. System Instructions (via client.chat) ---");
  try {
    const systemInstructionText = "Ты — веселый робот-помощник. Всегда заканчивай ответ шуткой.";
    const instructedChatResponse = await client.chat({
        systemInstruction: systemInstructionText,
        prompt: "Что такое API?",
        generationConfig: { maxOutputTokens: 1000 }
    });
    console.log("System Instruct Response:", instructedChatResponse.text() || "No text.");
    if(instructedChatResponse.text() === null) console.log("Raw Response (if text is null):", JSON.stringify(instructedChatResponse, null, 2));
  } catch(e) { console.error("Error in System Instructions:", e instanceof Error ? e.message : e); }


  console.log("\n--- 4. Count Tokens ---");
  try {
    const countResponse = await client.countTokens({
      contents: [{ role: "user", parts: [{ text: "Подсчитай эти токены." }] }]
    });
    console.log("Token Count:", countResponse.totalTokens);
  } catch(e) { console.error("Error in Count Tokens:", e instanceof Error ? e.message : e); }


  console.log("\n--- 5. Embed Content ---");
  try {
    const embeddingResponse = await client.embedContent({
      content: { parts: [{ text: "Это текст для эмбеддинга." }] }
    }, "models/text-embedding-004"); 
    console.log("Embedding (first 3):", embeddingResponse.embedding.values.slice(0, 3));
  } catch(e) { console.error("Error in Embed Content:", e instanceof Error ? e.message : e); }


  console.log("\n--- 6. File API & Multimodal (via client.generateContent) ---");
  const imagePath = 'examples/sample-image.png';
  if (fs.existsSync(imagePath)) {
    try {
      const uploadedFile = await client.files.uploadFile(imagePath, "Тестовая картинка");
      console.log("Uploaded:", uploadedFile.name);
      const multimodalResponse = await client.generateContent({
        contents: [{
          role: "user",
          parts: [
            GeminiClient.textPart("Что на этой картинке?"),
            GeminiClient.fileDataPart(uploadedFile.mimeType, uploadedFile.uri)
          ]
        }],
        generationConfig: { maxOutputTokens: 500 }
      });
      console.log("Image Desc:", multimodalResponse.text() || "No text.");
      if(multimodalResponse.text() === null) console.log("Raw Response (if text is null):", JSON.stringify(multimodalResponse, null, 2));
      
      await client.files.deleteFile(uploadedFile.name);
      console.log("File Deleted:", uploadedFile.name);
    } catch(e) { console.error("Error in File API & Multimodal:", e instanceof Error ? e.message : e); }
  } else {
    console.warn(`Skipping Multimodal: ${imagePath} not found.`);
  }

  console.log("\n--- 7. Structured Output (JSON) (via client.generateContent) ---");
  try {
    const citySchema: Schema = {
        type: SchemaType.OBJECT,
        properties: {
          cityName: { type: SchemaType.STRING, description: "Название города." },
          population: { type: SchemaType.NUMBER, description: "Приблизительная численность населения." },
          yearFounded: { type: SchemaType.INTEGER, description: "Год основания города." },
        },
        required: ["cityName", "population", "yearFounded"]
      };

    const jsonGenResponse = await client.generateContent({
      contents: [{ role: "user", parts: [{ text: "Информация о городе Москва в JSON." }] }],
      generationConfig: { 
        responseMimeType: "application/json", 
        responseSchema: citySchema,
        maxOutputTokens: 500 
      }
    });
    const jsonData = jsonGenResponse.json<{cityName: string, population: number, yearFounded: number }>();
    console.log("JSON Data:", jsonData);
    if(jsonData === null) console.log("Raw Response (if json is null):", JSON.stringify(jsonGenResponse, null, 2));

  } catch(e) { console.error("Error in Structured Output (JSON):", e instanceof Error ? e.message : e); }


  console.log("\n--- 8. Grounding (Google Search) (via client.generateContent) ---");
  try {
    const groundingResponse = await client.generateContent({
      contents: [{ role: "user", parts: [{ text: "Кто текущий президент Франции?" }] }],
      tools: [{ googleSearchRetrieval: {} }],
      generationConfig: { maxOutputTokens: 500 }
    });
    console.log("Grounding Response:", groundingResponse.text() || "No text.");
    if(groundingResponse.text() === null) console.log("Raw Response (if text is null):", JSON.stringify(groundingResponse, null, 2));
    if (groundingResponse.candidates?.[0]?.citationMetadata) {
      console.log("Citation Metadata:", groundingResponse.candidates[0].citationMetadata);
    }
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    console.error("Error in Grounding:", errorMessage);
    if (errorMessage.includes("Grounding is not supported")) {
        console.warn(`Note: Grounding might not be supported by the current model (${targetModel}).`);
    }
  }

  console.log("\n===== Test Run Finished =====");
}

main().catch(e => {
    console.error("Unhandled error in main:", e instanceof Error ? e.message : e);
});