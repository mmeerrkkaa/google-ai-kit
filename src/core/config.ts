import { IMessageStore } from "./messageStore/IMessageStore";

export interface ProxyConfig {
  host: string;
  port: string | number;
  user?: string;
  pass?: string;
  protocol?: 'http' | 'https';
}

export type MessageStoreType = 'memory' | 'disk';

export interface MessageStoreConfig {
  type: MessageStoreType;
  path?: string;
}

export const DEFAULT_GEMINI_CLIENT_MAX_TOOL_CALLS = 5;

export interface GeminiClientConfig {
  apiKeys: string[];
  defaultModel?: string;
  apiEndpoint?: string;
  apiVersion?: string;
  proxy?: ProxyConfig;
  requestTimeout?: number;
  maxRetries?: number;
  messageStoreConfig?: MessageStoreConfig;
  defaultMaxToolCalls?: number; 
}

export const DEFAULT_GEMINI_CONFIG: Omit<GeminiClientConfig, 'apiKeys'> = {
  defaultModel: "gemini-2.5-flash",
  apiEndpoint: "https://generativelanguage.googleapis.com",
  apiVersion: "v1beta",
  requestTimeout: 60000,
  maxRetries: 2,
  messageStoreConfig: undefined,
  defaultMaxToolCalls: DEFAULT_GEMINI_CLIENT_MAX_TOOL_CALLS,
};