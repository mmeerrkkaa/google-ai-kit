import * as fs from 'fs';
import { GeminiClient, GenerateContentRequest, Content, HarmCategory, HarmBlockThreshold } from '../src';
import 'dotenv/config';

async function main() {
  const apiKeysEnv = process.env.GOOGLE_API_KEYS;
  if (!apiKeysEnv) {
    console.error("GOOGLE_API_KEYS not found in .env file. Please ensure it's set with at least one valid API key.");
    process.exit(1);
  }
  const apiKeys = apiKeysEnv.split(',').map(key => key.trim()).filter(key => key.length > 0);
  if (apiKeys.length === 0) {
    console.error("No valid API keys found in GOOGLE_API_KEYS after trimming. Please check your .env file.");
    process.exit(1);
  }


  let proxyString: string | undefined = undefined;
  if (process.env.PROXY_HOST && process.env.PROXY_PORT) {
    if (process.env.PROXY_USER && process.env.PROXY_PASS) {
      proxyString = `http://${process.env.PROXY_USER}:${process.env.PROXY_PASS}@${process.env.PROXY_HOST}:${process.env.PROXY_PORT}`;
      if (process.env.DEBUG_MODE === 'true') console.log(`Using proxy: ${process.env.PROXY_HOST}:${process.env.PROXY_PORT} with authentication.`);
    } else {
      proxyString = `http://${process.env.PROXY_HOST}:${process.env.PROXY_PORT}`;
      if (process.env.DEBUG_MODE === 'true') console.log(`Using proxy: ${process.env.PROXY_HOST}:${process.env.PROXY_PORT} without authentication.`);
    }
  } else {
    if (process.env.DEBUG_MODE === 'true') console.log("No proxy configuration found or incomplete. Proceeding without proxy.");
  }


  const client = new GeminiClient({
    apiKeys: apiKeys,
    proxy: proxyString,
    defaultModel: "gemini-2.5-flash-preview-05-20",
  });

  const userNickname = "Merka";
  const userMessage = "Привет! Как твои дела? Расскажи мне о последних новостях в AI.";

  const systemInstructionText = `Ты — полезный ИИ-ассистент по имени Мерка-AI. 
  Общайся дружелюбно и информативно. Ты отвечаешь пользователю ${userNickname}.
  Текущая дата: ${new Date().toLocaleDateString('ru-RU')}.`;
  
  const chatHistory: Content[] = [
    { role: "user", parts: [{ text: "Кто ты?" }] },
    { role: "model", parts: [{ text: "Я Мерка-AI, ваш дружелюбный ассистент." }] },
  ];

  const currentConversation: Content[] = [
    ...chatHistory,
    { role: "user", parts: [{ text: userMessage }] }
  ];

  const request: GenerateContentRequest = {
    systemInstruction: {
      role: 'system',
      parts: [{ text: systemInstructionText }],
    },
    contents: currentConversation,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2048,
    },
    safetySettings: [
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      }
    ],
  };

  if (process.env.DEBUG_MODE === 'true') {
    console.log("Sending request to Gemini with payload:", JSON.stringify(request, null, 2));
  }


  try {
    if (process.env.DEBUG_MODE === 'true') {
        console.log("\n--- Non-Streaming Response ---");
    }
    const response = await client.generateContent(request);

    if (process.env.DEBUG_MODE === 'true') {
        console.log("Raw API Response (Non-Streaming):", JSON.stringify(response, null, 2)); 
    }

    if (response.promptFeedback) {
        console.error("[Merka-AI - Non-Streaming]: Prompt was blocked.");
        console.error("Prompt Feedback:", JSON.stringify(response.promptFeedback, null, 2));
    } else if (response.candidates && response.candidates.length > 0) {
      const candidate = response.candidates[0];
      if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) { 
        const textResponse = candidate.content.parts
          .map(part => part.text || "")
          .join("");
        console.log(`[${userNickname}]: ${userMessage}`);
        console.log(`[Merka-AI - Non-Streaming]: ${textResponse}`);

        if (candidate.finishReason) {
          if (process.env.DEBUG_MODE === 'true') console.log(`Finish Reason: ${candidate.finishReason}`);
        }
        if (candidate.tokenCount && process.env.DEBUG_MODE === 'true') {
          console.log(`Token count (candidate): ${candidate.tokenCount}`);
        }

      } else if (candidate.finishReason === 'SAFETY') {
         console.error(`[Merka-AI - Non-Streaming]: Content blocked due to safety settings.`);
         if (candidate.safetyRatings) console.error("Safety Ratings:", JSON.stringify(candidate.safetyRatings, null, 2));
      } else if (candidate.finishReason === 'MAX_TOKENS') {
         console.warn(`[Merka-AI - Non-Streaming]: Generation stopped due to MAX_TOKENS. No content parts returned. Consider increasing maxOutputTokens or simplifying the prompt.`);
         if (process.env.DEBUG_MODE === 'true') console.log(`Finish Reason: ${candidate.finishReason}`);
      } else {
        console.log("[Merka-AI - Non-Streaming]: No content parts in response or candidate blocked for other reasons.");
        if(candidate.finishReason && process.env.DEBUG_MODE === 'true') console.log(`Finish Reason: ${candidate.finishReason}`);
        if (process.env.DEBUG_MODE !== 'true' && candidate.finishReason) {
            console.log(`[Merka-AI - Non-Streaming]: Received response with finishReason: ${candidate.finishReason} but no content parts.`);
        }
      }
    } else {
      console.log("[Merka-AI - Non-Streaming]: No candidates in response AND no promptFeedback. Check raw response if DEBUG_MODE is on.");
    }

    const tokenCountRequestPayload = { contents: request.contents, systemInstruction: request.systemInstruction };
    if (tokenCountRequestPayload.systemInstruction && Object.keys(tokenCountRequestPayload.systemInstruction).length === 0) {
        delete tokenCountRequestPayload.systemInstruction;
    }


    if (process.env.DEBUG_MODE === 'true') {
        console.log("\n--- Streaming Response ---");
        process.stdout.write(`[${userNickname}]: ${userMessage}\n`);
        process.stdout.write(`[Merka-AI Stream]: `);
    }
    
    let streamedTextOutput = "";
    let streamHadContent = false;
    for await (const chunk of client.generateContentStream(request)) {
      if (process.env.VERY_DEBUG_MODE === 'true') {
        console.log("\nStream Chunk Raw:", JSON.stringify(chunk, null, 2));
      }
      if (chunk.promptFeedback) {
        console.error("\n[Merka-AI Stream]: Prompt was blocked during streaming.");
        console.error("Prompt Feedback:", JSON.stringify(chunk.promptFeedback, null, 2));
        streamHadContent = true;
        break;
      }
      if (chunk.candidates && chunk.candidates.length > 0) {
        const candidateChunk = chunk.candidates[0];
        if (candidateChunk.content && candidateChunk.content.parts && candidateChunk.content.parts.length > 0) {
            const partText = candidateChunk.content.parts[0]?.text || "";
            if (partText) {
                 if (process.env.DEBUG_MODE === 'true') {
                    process.stdout.write(partText);
                }
                streamedTextOutput += partText;
                streamHadContent = true;
            }
        }
        if (candidateChunk.finishReason && candidateChunk.finishReason !== 'STOP' && process.env.DEBUG_MODE === 'true') {
            console.log(`\nStream Finish Reason: ${candidateChunk.finishReason}`);
        }
      }
    }
    if (process.env.DEBUG_MODE === 'true' && streamHadContent) {
        process.stdout.write("\n");
        console.log("--- End of Stream ---");
    }
    if (streamedTextOutput) { 
        console.log(`[${userNickname}]: ${userMessage}`);
        console.log(`[Merka-AI Stream]: ${streamedTextOutput}`);
    } else if (streamHadContent && !streamedTextOutput && process.env.DEBUG_MODE !== 'true') {
        console.log("[Merka-AI Stream]: Stream finished without textual output. Check logs if DEBUG_MODE was on.");
    }


    const runFileApiExample = process.env.RUN_FILE_API_EXAMPLE === 'true';
    if (runFileApiExample) {
        if (process.env.DEBUG_MODE === 'true') {
            console.log("\n--- File API Example ---");
        }
        const sampleFilePath = 'sample.txt';
        if (!fs.existsSync(sampleFilePath)) {
            fs.writeFileSync(sampleFilePath, "This is a sample text file for testing uploads.");
        }
        try {
            const uploadedFile = await client.files.uploadFile(sampleFilePath, "My Sample Text");
            if (process.env.DEBUG_MODE === 'true') {
                console.log("Uploaded File:", JSON.stringify(uploadedFile, null, 2));
            }

            const fileUri = uploadedFile.uri;
            const fileMimeType = uploadedFile.mimeType;
            
            const contentWithFile: Content[] = [
                { role: "user", parts: [
                    GeminiClient.textPart("Summarize this document for me:"),
                    GeminiClient.fileDataPart(fileMimeType, fileUri)
                ]}
            ];
            const fileRequestForFileApi: GenerateContentRequest = { 
                contents: contentWithFile,
                generationConfig: { maxOutputTokens: 500 }
            };
            const fileResponse = await client.generateContent(fileRequestForFileApi);
            console.log("Response using file:", fileResponse.candidates?.[0]?.content?.parts?.[0]?.text || "No text in file response.");

            if (process.env.DEBUG_MODE === 'true') {
                const listedFiles = await client.files.listFiles(5);
                console.log(`Listed files (first ${listedFiles.files.length}):`, listedFiles.files.map(f => ({name: f.name, displayName: f.displayName})));

                const fetchedFile = await client.files.getFile(uploadedFile.name);
                console.log("Fetched file details:", fetchedFile.displayName);
            }

            await client.files.deleteFile(uploadedFile.name);
            if (process.env.DEBUG_MODE === 'true') {
                console.log(`File ${uploadedFile.name} deleted.`);
            }

        } catch (fileError) {
            console.error("File API Error:", fileError);
            if (fileError instanceof Error) {
                console.error("Error name:", fileError.name);
                console.error("Error message:", fileError.message);
                if ('statusCode' in fileError) console.error("Status Code:", (fileError as any).statusCode);
                if ('details' in fileError) console.error("Details:", (fileError as any).details);
            } else {
                console.error("Unknown file error object:", fileError);
            }
        }
    }

  } catch (error) {
    console.error("Error during Gemini API call:", error);
    if (error instanceof Error) {
        console.error("Error name:", error.name);
        console.error("Error message:", error.message);
        if ('statusCode' in error) console.error("Status Code:", (error as any).statusCode);
        if ('details' in error) console.error("Details:", (error as any).details);
    } else {
        console.error("Unknown error object:", error);
    }
  }
}

main();