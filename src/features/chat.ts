/**
 * Simple Chat API - inspired by Google GenAI SDK
 * Provides an easier way to manage conversations with automatic history tracking
 */

import { GeminiClient } from '../core/client';
import { Content, Part, SystemInstruction, GenerationConfig, SafetySetting, Tool, FunctionCallingMode } from '../types';
import { EnhancedGenerateContentResponse, StreamGenerateContentResponse } from '../types/response';

/**
 * Configuration for creating a chat session
 */
export interface ChatConfig {
  /**
   * The model to use for this chat session
   * @example 'gemini-2.0-flash', 'gemini-2.5-flash'
   */
  model?: string;

  /**
   * System instruction for the chat
   */
  systemInstruction?: string | SystemInstruction;

  /**
   * Initial conversation history
   */
  history?: Content[];

  /**
   * Generation configuration
   */
  generationConfig?: GenerationConfig;

  /**
   * Safety settings
   */
  safetySettings?: SafetySetting[];

  /**
   * Tools/functions available to the model
   */
  tools?: Tool[];

  /**
   * Maximum number of automatic tool calls
   * @default 5
   */
  maxToolCalls?: number;
}

/**
 * Request for sending a message
 */
export interface SendMessageRequest {
  /**
   * The message text to send
   */
  message: string;

  /**
   * Optional: Override generation config for this message
   */
  generationConfig?: GenerationConfig;

  /**
   * Optional: Override safety settings for this message
   */
  safetySettings?: SafetySetting[];
}

/**
 * Chat session class - manages conversation state and history
 */
export class Chat {
  private client: GeminiClient;
  private config: Required<Pick<ChatConfig, 'model' | 'maxToolCalls'>> & Omit<ChatConfig, 'model' | 'maxToolCalls'>;
  private conversationHistory: Content[] = [];

  constructor(client: GeminiClient, config: ChatConfig) {
    this.client = client;

    // Set defaults
    this.config = {
      model: config.model || 'gemini-2.0-flash',
      maxToolCalls: config.maxToolCalls ?? 5,
      systemInstruction: config.systemInstruction,
      generationConfig: config.generationConfig,
      safetySettings: config.safetySettings,
      tools: config.tools,
    };

    // Initialize with provided history
    if (config.history && config.history.length > 0) {
      this.conversationHistory = [...config.history];
    }
  }

  /**
   * Send a message and get a response
   * @param request - The message request (can be a string or SendMessageRequest object)
   * @returns Enhanced response with text and JSON helpers
   */
  async sendMessage(request: string | SendMessageRequest): Promise<EnhancedGenerateContentResponse> {
    // Normalize request
    const messageText = typeof request === 'string' ? request : request.message;
    const generationConfig = typeof request === 'object' ? request.generationConfig : undefined;
    const safetySettings = typeof request === 'object' ? request.safetySettings : undefined;

    // Add user message to history
    const userContent: Content = {
      role: 'user',
      parts: [{ text: messageText }],
    };
    this.conversationHistory.push(userContent);

    // Prepare system instruction
    let systemInstruction: SystemInstruction | undefined;
    if (this.config.systemInstruction) {
      if (typeof this.config.systemInstruction === 'string') {
        systemInstruction = {
          role: 'system',
          parts: [{ text: this.config.systemInstruction }],
        };
      } else {
        systemInstruction = this.config.systemInstruction;
      }
    }

    // Call generateContent with full history
    const response = await this.client.generateContent({
      contents: [...this.conversationHistory],
      systemInstruction,
      generationConfig: generationConfig || this.config.generationConfig,
      safetySettings: safetySettings || this.config.safetySettings,
      tools: this.config.tools,
      toolConfig: this.config.tools ? {
        functionCallingConfig: {
          mode: FunctionCallingMode.AUTO,
          maxCalls: this.config.maxToolCalls,
        },
      } : undefined,
    }, this.config.model);

    // Add model response to history
    if (response.candidates && response.candidates.length > 0) {
      const modelContent = response.candidates[0].content;
      if (modelContent) {
        this.conversationHistory.push(modelContent);
      }
    }

    return response;
  }

  /**
   * Send a message and get a streaming response
   * @param request - The message request (can be a string or SendMessageRequest object)
   * @returns Async generator yielding response chunks
   */
  async *sendMessageStream(request: string | SendMessageRequest): AsyncGenerator<StreamGenerateContentResponse, void, unknown> {
    // Normalize request
    const messageText = typeof request === 'string' ? request : request.message;
    const generationConfig = typeof request === 'object' ? request.generationConfig : undefined;
    const safetySettings = typeof request === 'object' ? request.safetySettings : undefined;

    // Add user message to history
    const userContent: Content = {
      role: 'user',
      parts: [{ text: messageText }],
    };
    this.conversationHistory.push(userContent);

    // Prepare system instruction
    let systemInstruction: SystemInstruction | undefined;
    if (this.config.systemInstruction) {
      if (typeof this.config.systemInstruction === 'string') {
        systemInstruction = {
          role: 'system',
          parts: [{ text: this.config.systemInstruction }],
        };
      } else {
        systemInstruction = this.config.systemInstruction;
      }
    }

    // Accumulate response parts for history
    const accumulatedParts: Part[] = [];

    // Stream the response
    const stream = this.client.generateContentStream({
      contents: [...this.conversationHistory],
      systemInstruction,
      generationConfig: generationConfig || this.config.generationConfig,
      safetySettings: safetySettings || this.config.safetySettings,
      tools: this.config.tools,
      toolConfig: this.config.tools ? {
        functionCallingConfig: {
          mode: FunctionCallingMode.AUTO,
          maxCalls: this.config.maxToolCalls,
        },
      } : undefined,
    }, this.config.model);

    for await (const chunk of stream) {
      // Accumulate parts from chunks
      if (chunk.candidates && chunk.candidates.length > 0) {
        const content = chunk.candidates[0].content;
        if (content?.parts) {
          accumulatedParts.push(...content.parts);
        }
      }

      yield chunk;
    }

    // Add accumulated response to history
    if (accumulatedParts.length > 0) {
      this.conversationHistory.push({
        role: 'model',
        parts: accumulatedParts,
      });
    }
  }

  /**
   * Get the full conversation history
   * @returns Array of Content objects representing the conversation
   */
  getHistory(): Content[] {
    return [...this.conversationHistory];
  }

  /**
   * Clear the conversation history
   */
  clearHistory(): void {
    this.conversationHistory = [];
  }

  /**
   * Set the conversation history
   * Useful for restoring a previous conversation or starting with a specific context
   * @param history - Array of Content objects
   */
  setHistory(history: Content[]): void {
    this.conversationHistory = [...history];
  }

  /**
   * Get the current model being used
   */
  getModel(): string {
    return this.config.model;
  }

  /**
   * Update the system instruction for this chat
   * @param instruction - New system instruction
   */
  setSystemInstruction(instruction: string | SystemInstruction): void {
    this.config.systemInstruction = instruction;
  }

  /**
   * Update generation config for this chat
   * @param config - New generation configuration
   */
  setGenerationConfig(config: GenerationConfig): void {
    this.config.generationConfig = config;
  }

  /**
   * Update tools for this chat
   * @param tools - New tools array
   */
  setTools(tools: Tool[]): void {
    this.config.tools = tools;
  }
}

/**
 * Chat manager - factory for creating chat sessions
 */
export class ChatManager {
  private client: GeminiClient;

  constructor(client: GeminiClient) {
    this.client = client;
  }

  /**
   * Create a new chat session
   * @param config - Chat configuration
   * @returns A new Chat instance
   */
  create(config: ChatConfig = {}): Chat {
    return new Chat(this.client, config);
  }
}
