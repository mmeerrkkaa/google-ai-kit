import { RequestHandler } from './requestHandler';
import { GeminiClientConfig, DEFAULT_GEMINI_CONFIG, DEFAULT_GEMINI_CLIENT_MAX_TOOL_CALLS } from './config';
import { FileManager } from '../features/fileManager';
import {
  GenerateContentRequest,
  GenerateContentResponse,
  CountTokensRequest,
  CountTokensResponse,
  EmbedContentRequest,
  EmbedContentResponse,
  Content,
  Part,
  SystemInstruction as SystemInstructionObject,
  StreamGenerateContentResponse,
  EnhancedGenerateContentResponse,
  ChatRequest,
  ChatMessage,
  FinishReason,
  Tool,
  FunctionDeclaration,
  BlockReason,
} from '../types';
import { IMessageStore, MemoryMessageStore, DiskMessageStore } from './messageStore';

export class GeminiClient {
  private requestHandler: RequestHandler;
  private config: Required<Omit<GeminiClientConfig, 'proxy' | 'defaultModel' | 'messageStoreConfig' | 'defaultMaxToolCalls'>> &
                  Pick<GeminiClientConfig, 'proxy' | 'defaultModel' | 'messageStoreConfig' | 'defaultMaxToolCalls'>;
  public readonly files: FileManager;
  public messageStore?: IMessageStore;

  constructor(config: GeminiClientConfig) {
    if (!config.apiKeys || config.apiKeys.length === 0) {
        throw new Error("API keys must be provided in GeminiClientConfig.");
    }
    this.config = {
        ...DEFAULT_GEMINI_CONFIG,
        ...config
    } as GeminiClient['config'];

    this.requestHandler = new RequestHandler(this.config);
    this.files = new FileManager(this.requestHandler, this.config.apiEndpoint);

    if (this.config.messageStoreConfig) {
      if (this.config.messageStoreConfig.type === 'memory') {
        this.messageStore = new MemoryMessageStore();
      } else if (this.config.messageStoreConfig.type === 'disk') {
        if (!this.config.messageStoreConfig.path) {
          throw new Error("Disk message store requires a 'path' in messageStoreConfig.");
        }
        this.messageStore = new DiskMessageStore(this.config.messageStoreConfig.path);
      }
    }
  }

  private getModelPath(model?: string): string {
    const modelToUse = model || this.config.defaultModel;
    return `models/${modelToUse}`;
  }

  private async executeFunctionCall(
    functionCall: NonNullable<Part['functionCall']>,
    toolsFromRequest?: Tool[]
  ): Promise<Part> {
    const toolName = functionCall.name;
    const toolArgs = functionCall.args;

    let toolDefinition: FunctionDeclaration | undefined;

    if (toolsFromRequest) {
      for (const tool of toolsFromRequest) {
        if (tool.functionDeclarations) {
          toolDefinition = tool.functionDeclarations.find(fd => fd.name === toolName);
          if (toolDefinition) break;
        }
      }
    }

    if (toolDefinition && typeof toolDefinition.execute === 'function') {
        try {
            const result = await toolDefinition.execute(toolArgs);
            return {
                functionResponse: {
                    name: toolName,
                    response: { content: result },
                },
            };
        } catch (error: any) {
            console.error(`[Client] Error executing tool '${toolName}' from its definition:`, error);
            return {
                functionResponse: {
                    name: toolName,
                    response: { content: { error: error.message || `Tool '${toolName}' execution failed.` } },
                },
            };
        }
    } else {
        const errorMessage = `Tool '${toolName}' not found or has no executable 'execute' method in provided tools.`;
        console.warn(`[Client] ${errorMessage}`);
        return {
            functionResponse: {
                name: toolName,
                response: { content: { error: errorMessage } },
            },
        };
    }
  }

  private prepareToolsForApi(tools?: Tool[]): Tool[] | undefined {
    if (!tools) return undefined;
    return tools.map(tool => {
      if (tool.functionDeclarations) {
        return {
          ...tool,
          functionDeclarations: tool.functionDeclarations.map(fd => {
            const { execute, ...apiSafeFd } = fd;
            return apiSafeFd as Omit<FunctionDeclaration, 'execute'>;
          })
        };
      }
      return tool;
    });
  }

  async generateContent(
    request: GenerateContentRequest,
    model?: string
  ): Promise<EnhancedGenerateContentResponse> {
    let currentApiContents: Content[] = [];
    let interactionToStoreUserContent: Content | undefined;

    if (request.prompt) {
      interactionToStoreUserContent = { role: 'user', parts: [{ text: request.prompt }] };
      if (request.contents && request.contents.length > 0) {
        currentApiContents = [...request.contents, interactionToStoreUserContent];
      } else {
        currentApiContents = [interactionToStoreUserContent];
      }
    } else if (request.contents && request.contents.length > 0) {
      currentApiContents = [...request.contents];
      const lastContent = currentApiContents[currentApiContents.length - 1];
      if (lastContent.role === 'user' || lastContent.role === 'function') {
        interactionToStoreUserContent = lastContent;
      }
    } else {
      throw new Error("Either 'prompt' or 'contents' must be provided in GenerateContentRequest.");
    }

    if (request.user && this.messageStore) {
      const storedHistory = await this.messageStore.getHistory(request.user);
      if (request.prompt || !(request.contents && request.contents.length >= storedHistory.length)) {
         currentApiContents = [...storedHistory, ...currentApiContents.filter(c => !storedHistory.find(sh => JSON.stringify(sh) === JSON.stringify(c)))];
      }
    }

    let toolCallCount = 0;
    const maxCallsFromRequest = request.toolConfig?.functionCallingConfig?.maxCalls;
    const maxToolCalls = typeof maxCallsFromRequest === 'number'
        ? maxCallsFromRequest
        : (this.config.defaultMaxToolCalls ?? DEFAULT_GEMINI_CLIENT_MAX_TOOL_CALLS);

    let lastApiResponse: GenerateContentResponse | undefined;
    const toolsForApi = this.prepareToolsForApi(request.tools);

    while (true) {
        const { maxCalls: _mc, ...apiFunctionCallingConfig } = request.toolConfig?.functionCallingConfig || {};
        
        let finalToolConfig = undefined;
        if (request.toolConfig) {
            const tempToolConfig = { ...request.toolConfig };
            if (Object.keys(apiFunctionCallingConfig).length > 0) {
                tempToolConfig.functionCallingConfig = apiFunctionCallingConfig;
            } else {
                delete tempToolConfig.functionCallingConfig;
            }
            if (Object.values(tempToolConfig).some(v => v !== undefined && (typeof v !== 'object' || (v && Object.keys(v).length > 0)))) {
                finalToolConfig = tempToolConfig;
            }
        }


        const apiRequestPayload: Omit<GenerateContentRequest, 'prompt' | 'user' | 'tools'> & { tools?: Tool[] } = {
            safetySettings: request.safetySettings,
            generationConfig: request.generationConfig,
            systemInstruction: request.systemInstruction,
            contents: [...currentApiContents],
            tools: toolsForApi,
            toolConfig: finalToolConfig,
        };
        delete (apiRequestPayload as any).user;
        delete (apiRequestPayload as any).prompt;

        const path = `${this.getModelPath(model)}:generateContent`;
        const rawResponse = await this.requestHandler.request<GenerateContentResponse>(
            'POST', path, apiRequestPayload, false
        );

        if (rawResponse instanceof ReadableStream) {
            throw new Error("generateContent received a stream when a direct response was expected.");
        }
        lastApiResponse = rawResponse;

        const modelCandidate = rawResponse.candidates?.[0];

        if (request.user && this.messageStore && interactionToStoreUserContent && modelCandidate?.content) {
            await this.messageStore.addInteraction(request.user, interactionToStoreUserContent, modelCandidate.content);
            interactionToStoreUserContent = undefined;
        }

        if (modelCandidate?.content) {
            if (request.user && this.messageStore) {
                currentApiContents = await this.messageStore.getHistory(request.user);
            } else {
                 currentApiContents.push(modelCandidate.content);
            }
        }

        const functionCallPart = modelCandidate?.content?.parts?.find(part => part.functionCall);
        const functionCall = functionCallPart?.functionCall;

        if (functionCall && request.tools && request.tools.length > 0) {
            toolCallCount++;
            if (maxToolCalls >= 0 && toolCallCount > maxToolCalls) {
                console.warn(`[Client] Max tool calls (${maxToolCalls}) reached. Stopping tool execution chain.`);
                if (modelCandidate) modelCandidate.finishReason = FinishReason.MAX_TOOL_CALLS_REACHED;
                break;
            }
             if (maxToolCalls === 0 && toolCallCount > 0) {
                 if (modelCandidate) modelCandidate.finishReason = FinishReason.MAX_TOOL_CALLS_REACHED;
                 break;
            }

            const functionResponsePart = await this.executeFunctionCall(functionCall, request.tools);
            const functionResponseContent: Content = { role: 'function', parts: [functionResponsePart] };

            currentApiContents.push(functionResponseContent);
            interactionToStoreUserContent = functionResponseContent;
        } else {
            break;
        }
    }

    if (!lastApiResponse) {
        return {
            text: () => null,
            json: () => null,
            promptFeedback: { blockReason: BlockReason.OTHER, blockReasonMessage: "No API response processed."}
        } as EnhancedGenerateContentResponse;
    }

    const finalResponseWithHelpers: EnhancedGenerateContentResponse = {
      ...lastApiResponse,
      text: function(): string | null {
        try {
          if (this.promptFeedback?.blockReason) return null;
          return this.candidates?.[0]?.content?.parts?.find((part: Part) => part.text)?.text || null;
        } catch (e) { return null; }
      },
      json: function<T = any>(): T | null {
        try {
          if (this.promptFeedback?.blockReason) return null;
          const textContent = this.candidates?.[0]?.content?.parts?.find((part: Part) => part.text)?.text;
          if (textContent) {
            try { return JSON.parse(textContent) as T; }
            catch { return null; }
          }
          return null;
        } catch (e) { return null; }
      }
    };

    return finalResponseWithHelpers;
  }

  async chat(chatRequest: ChatRequest): Promise<EnhancedGenerateContentResponse> {
    const { prompt, systemInstruction, history: callHistory, model, generationConfig, user } = chatRequest;
    let initialContentsForApi: Content[] = [];

    if (callHistory && callHistory.length > 0) {
      callHistory.forEach((msg: ChatMessage) => {
        initialContentsForApi.push({ role: msg.role as 'user' | 'model', parts: [{ text: msg.text }] });
      });
    }

    const apiRequest: GenerateContentRequest = {
      prompt: prompt,
      contents: initialContentsForApi.length > 0 ? initialContentsForApi : undefined,
      generationConfig: generationConfig,
      systemInstruction: typeof systemInstruction === 'string'
        ? { role: 'system', parts: [{ text: systemInstruction }] }
        : systemInstruction as SystemInstructionObject | undefined,
      user: user,
      tools: (chatRequest as any).tools,
      toolConfig: (chatRequest as any).toolConfig,
    };
    return this.generateContent(apiRequest, model || this.config.defaultModel);
  }

  async *generateContentStream(
    request: GenerateContentRequest,
    model?: string
  ): AsyncIterable<StreamGenerateContentResponse> {
    let apiContents: Content[] = [];

    if (request.prompt) {
      const currentCallUserContent: Content = { role: 'user', parts: [{ text: request.prompt }] };
      if (request.contents && request.contents.length > 0) {
        apiContents = [...request.contents, currentCallUserContent];
      } else {
        apiContents = [currentCallUserContent];
      }
    } else if (request.contents && request.contents.length > 0) {
      apiContents = [...request.contents];
    } else {
      throw new Error("Either 'prompt' or 'contents' must be provided in GenerateContentRequest for streaming.");
    }

    if (request.user && this.messageStore) {
      const storedHistory = await this.messageStore.getHistory(request.user);
       if (request.prompt || !(request.contents && request.contents.length >= storedHistory.length)) {
           apiContents = [...storedHistory, ...apiContents.filter(c => !storedHistory.find(sh => JSON.stringify(sh) === JSON.stringify(c)))];
       }
    }

    const toolsForApi = this.prepareToolsForApi(request.tools);
    const { maxCalls: _mc, ...apiFunctionCallingConfig } = request.toolConfig?.functionCallingConfig || {};
    
    let finalToolConfig = undefined;
    if (request.toolConfig) {
        const tempToolConfig = { ...request.toolConfig };
        if (Object.keys(apiFunctionCallingConfig).length > 0) {
            tempToolConfig.functionCallingConfig = apiFunctionCallingConfig;
        } else {
            delete tempToolConfig.functionCallingConfig;
        }
        if (Object.values(tempToolConfig).some(v => v !== undefined && (typeof v !== 'object' || (v && Object.keys(v).length > 0)))) {
            finalToolConfig = tempToolConfig;
        }
    }

    const streamApiRequest: Omit<GenerateContentRequest, 'prompt' | 'user' | 'tools'> & { tools?: Tool[] } = {
      safetySettings: request.safetySettings,
      generationConfig: { ...request.generationConfig, candidateCount: 1 },
      systemInstruction: request.systemInstruction,
      contents: apiContents,
      tools: toolsForApi,
      toolConfig: finalToolConfig,
    };
    delete (streamApiRequest as any).user;
    delete (streamApiRequest as any).prompt;

    const path = `${this.getModelPath(model)}:streamGenerateContent?alt=SSE`;
    const stream = await this.requestHandler.request<ReadableStream<Uint8Array>>(
        'POST', path, streamApiRequest, true
    );

    if (!(stream instanceof ReadableStream)) {
        throw new Error("generateContentStream did not receive a ReadableStream as expected.");
    }
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let lastIndex = 0;
            while (true) {
                const newlineIndex = buffer.indexOf('\n', lastIndex);
                if (newlineIndex === -1) break;
                const chunkLine = buffer.substring(lastIndex, newlineIndex).trim();
                lastIndex = newlineIndex + 1;
                if (chunkLine.startsWith('data: ')) {
                    const jsonString = chunkLine.substring(6);
                     if (jsonString) {
                        try {
                            const parsed = JSON.parse(jsonString) as StreamGenerateContentResponse;
                            yield parsed;
                        } catch (e) {
                            console.warn("Stream parsing error for SSE chunk:", jsonString, e);
                        }
                    }
                }
            }
            buffer = buffer.substring(lastIndex);
        }
        if (buffer.trim().startsWith('data: ')) {
            const jsonString = buffer.trim().substring(6);
            if (jsonString) {
                 try {
                    const parsed = JSON.parse(jsonString) as StreamGenerateContentResponse;
                    yield parsed;
                } catch (e) {
                    console.warn("Stream parsing error for final SSE buffer:", jsonString, e);
                }
            }
        }
    } finally {
        if (reader) reader.releaseLock();
    }
  }

  async countTokens(
    request: CountTokensRequest, model?: string
  ): Promise<CountTokensResponse> {
    const path = `${this.getModelPath(model)}:countTokens`;
    const response = await this.requestHandler.request<CountTokensResponse>('POST', path, request, false);
    if (response instanceof ReadableStream) {
        throw new Error("countTokens received a stream when a direct response was expected.");
    }
    return response;
  }

  async embedContent(
    request: EmbedContentRequest, model?: string
  ): Promise<EmbedContentResponse> {
    const embeddingModel = model || "models/text-embedding-004";
    const path = `${embeddingModel}:embedContent`;
    const response = await this.requestHandler.request<EmbedContentResponse>('POST', path, request, false);
    if (response instanceof ReadableStream) {
        throw new Error("embedContent received a stream when a direct response was expected.");
    }
    return response;
  }

  static textPart(text: string): Part { return { text }; }
  static fileDataPart(mimeType: string, fileUri: string): Part { return { fileData: { mimeType, fileUri } }; }
  static inlineDataPart(mimeType: string, base64Data: string): Part { return { inlineData: { mimeType, data: base64Data } }; }
  static functionCallPart(name: string, args: object): Part { return { functionCall: { name, args } }; }
  static functionResponsePart(name: string, responseObject: object): Part { return { functionResponse: { name, response: responseObject } }; }
}