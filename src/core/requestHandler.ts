import fetch, { RequestInit, Response } from 'node-fetch';
import OriginalFormData from 'form-data';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { GeminiClientConfig, DEFAULT_GEMINI_CONFIG, ProxyConfig } from './config';
import { APIKeyError, NetworkError, handleErrorResponse, GoogleAIError, ConsumerSuspendedError, RateLimitError } from './errors';
import { Readable } from 'stream';

export class RequestHandler {
  private config: Required<Omit<GeminiClientConfig, 'proxy' | 'defaultModel' | 'debugMode'>> & { proxy?: ProxyConfig, defaultModel?: string, debugMode?: boolean };
  private currentApiKeyIndex: number = 0;
  private proxyAgent?: HttpsProxyAgent<string>;

  constructor(config: GeminiClientConfig) {
    if (!config.apiKeys || config.apiKeys.length === 0) {
      throw new APIKeyError("At least one API key must be provided.");
    }
    this.config = { 
        ...DEFAULT_GEMINI_CONFIG, 
        ...config 
    } as Required<Omit<GeminiClientConfig, 'proxy' | 'defaultModel'>> & { proxy?: ProxyConfig, defaultModel?: string };


    if (this.config.proxy) {
      const pc = this.config.proxy;
      const protocol = pc.protocol || 'http';
      let auth = '';
      if (pc.user) {
        auth = `${pc.user}${pc.pass ? ':' + pc.pass : ''}@`;
      }
      const proxyString = `${protocol}://${auth}${pc.host}:${pc.port}`;
      this.proxyAgent = new HttpsProxyAgent(proxyString);
    }
  }

  private getNextApiKey(): string {
    const key = this.config.apiKeys[this.currentApiKeyIndex];
    this.currentApiKeyIndex = (this.currentApiKeyIndex + 1) % this.config.apiKeys.length;
    return key;
  }

  public async request<TResponse>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    body?: any,
    isStream: boolean = false,
    isFileUpload: boolean = false
  ): Promise<TResponse | ReadableStream<Uint8Array>> {
    let attempts = 0;
    const maxRetries = this.config.maxRetries!;
    let apiKeyAttempts = 0;
    const maxApiKeyAttempts = this.config.apiKeys.length;

    while (true) {
      const currentKeyIndex = this.currentApiKeyIndex;
      const apiKey = this.getNextApiKey();

      if (this.config.debugMode) {
        const keyPreview = apiKey.substring(0, 10) + '...';
        console.log(`[DEBUG] Используется API ключ #${currentKeyIndex + 1}: ${keyPreview}`);
      }

      const headers: Record<string, string> = {
        'X-Goog-Api-Key': apiKey,
      };
      
      if (body && !(body instanceof OriginalFormData) && !isFileUpload) {
        headers['Content-Type'] = 'application/json';
      }

      const finalRequestUrl = path.startsWith('http') ? path : `${this.config.apiEndpoint}/${this.config.apiVersion}/${path}`;

      const requestOptions: RequestInit = {
        method,
        headers,
        agent: this.proxyAgent,
        timeout: this.config.requestTimeout,
      };

      if (body) {
        if (body instanceof OriginalFormData) {
            requestOptions.body = body as any;
        } else if (!isFileUpload) {
            requestOptions.body = JSON.stringify(body);
        } else {
            requestOptions.body = body; 
        }
      }

      try {
        const response: Response = await fetch(finalRequestUrl, requestOptions);

        if (isStream && response.ok) {
            if (!response.body) {
                throw new NetworkError("Stream response body is null despite response.ok being true.");
            }
            const nodeJsStream = response.body as unknown as Readable;
            if (typeof Readable.toWeb === 'function') {
                 return Readable.toWeb(nodeJsStream) as ReadableStream<Uint8Array>;
            } else {
                throw new Error("Readable.toWeb is not available. Node.js 18+ is required for this streaming method with node-fetch v2.");
            }
        }

        if (!response.ok) {
          let errorData;
          try {
            errorData = await response.json();
          } catch (e) {
            errorData = { error: { message: await response.text() || response.statusText || `HTTP error ${response.status}` } };
          }
          
          const apiError = handleErrorResponse(response, errorData);

          if (apiError instanceof ConsumerSuspendedError && apiKeyAttempts < maxApiKeyAttempts - 1) {
            apiKeyAttempts++;
            const suspendedKeyPreview = apiKey.substring(0, 10) + '...';
            const message = `API ключ ${suspendedKeyPreview} (ключ #${currentKeyIndex + 1}) приостановлен, переключаюсь на следующий (попытка ${apiKeyAttempts}/${maxApiKeyAttempts})`;
            console.warn(`[ПЕРЕКЛЮЧЕНИЕ КЛЮЧА] ${message}`);
            if (this.config.debugMode) {
              console.log(`[DEBUG] Причина: ConsumerSuspendedError - ${apiError.message}`);
            }
            continue;
          }

          if (apiError instanceof RateLimitError && apiKeyAttempts < maxApiKeyAttempts - 1) {
            apiKeyAttempts++;
            const rateLimitedKeyPreview = apiKey.substring(0, 10) + '...';
            const message = `API ключ ${rateLimitedKeyPreview} (ключ #${currentKeyIndex + 1}) превысил квоту, переключаюсь на следующий (попытка ${apiKeyAttempts}/${maxApiKeyAttempts})`;
            console.warn(`[ПЕРЕКЛЮЧЕНИЕ КЛЮЧА] ${message}`);
            if (this.config.debugMode) {
              console.log(`[DEBUG] Причина: RateLimitError - ${apiError.message}`);
              console.log(`[DEBUG] Следующий ключ будет: #${(this.currentApiKeyIndex % this.config.apiKeys.length) + 1}`);
            }
            continue;
          }

          if (
            (response.status >= 500 || response.status === 429) &&
            attempts < maxRetries
          ) {
            attempts++;
            const delay = Math.pow(2, attempts) * 1000 + Math.random() * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          throw apiError;
        }
        
        if (response.status === 204) {
            return {} as TResponse;
        }

        return (await response.json()) as TResponse;

      } catch (error) {
        if (error instanceof GoogleAIError) {
            throw error; 
        }

        if (attempts < maxRetries) {
          attempts++;
          const delay = Math.pow(2, attempts) * 1000 + Math.random() * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        if (error instanceof Error && (error.name === 'AbortError' || (error as any).type === 'request-timeout')) {
            throw new NetworkError(`Request timed out after ${this.config.requestTimeout}ms for ${finalRequestUrl}`);
        }
        throw new NetworkError(`Request failed for ${finalRequestUrl}: ${(error as Error).message}`);
      }
    }
  }
}