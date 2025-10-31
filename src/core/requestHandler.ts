import fetch, { RequestInit, Response } from 'node-fetch';
import OriginalFormData from 'form-data';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { GeminiClientConfig, DEFAULT_GEMINI_CONFIG, ProxyConfig } from './config';
import { APIKeyError, NetworkError, handleErrorResponse, GoogleAIError, ConsumerSuspendedError, RateLimitError, APIKeyExpiredError, APIKeyInvalidError } from './errors';
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

  private getCurrentApiKey(): string {
    return this.config.apiKeys[this.currentApiKeyIndex];
  }

  private switchToNextApiKey(): void {
    this.currentApiKeyIndex = (this.currentApiKeyIndex + 1) % this.config.apiKeys.length;
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
    let consecutiveRateLimitErrors = 0; // Счётчик подряд идущих RateLimitError

    while (true) {
      const currentKeyIndex = this.currentApiKeyIndex;
      const apiKey = this.getCurrentApiKey();

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

          // API Key Expired - переключаемся на следующий ключ
          if (apiError instanceof APIKeyExpiredError && apiKeyAttempts < maxApiKeyAttempts - 1) {
            apiKeyAttempts++;
            const expiredKeyPreview = apiKey.substring(0, 10) + '...';
            this.switchToNextApiKey();
            const nextKeyPreview = this.getCurrentApiKey().substring(0, 10) + '...';
            const message = `❌ API ключ ${expiredKeyPreview} (ключ #${currentKeyIndex + 1}) истёк, переключаюсь на ключ #${this.currentApiKeyIndex + 1} (попытка ${apiKeyAttempts}/${maxApiKeyAttempts})`;
            console.error(`[API KEY EXPIRED] ${message}`);
            if (this.config.debugMode) {
              console.log(`[DEBUG] Причина: ${apiError.message}`);
              console.log(`[DEBUG] Следующий ключ: #${this.currentApiKeyIndex + 1}: ${nextKeyPreview}`);
            }
            continue;
          }

          // API Key Invalid - переключаемся на следующий ключ
          if (apiError instanceof APIKeyInvalidError && apiKeyAttempts < maxApiKeyAttempts - 1) {
            apiKeyAttempts++;
            const invalidKeyPreview = apiKey.substring(0, 10) + '...';
            this.switchToNextApiKey();
            const nextKeyPreview = this.getCurrentApiKey().substring(0, 10) + '...';
            const message = `❌ API ключ ${invalidKeyPreview} (ключ #${currentKeyIndex + 1}) невалиден или не найден, переключаюсь на ключ #${this.currentApiKeyIndex + 1} (попытка ${apiKeyAttempts}/${maxApiKeyAttempts})`;
            console.error(`[API KEY INVALID] ${message}`);
            if (this.config.debugMode) {
              console.log(`[DEBUG] Причина: ${apiError.message}`);
              console.log(`[DEBUG] Следующий ключ: #${this.currentApiKeyIndex + 1}: ${nextKeyPreview}`);
            }
            continue;
          }

          // Consumer Suspended
          if (apiError instanceof ConsumerSuspendedError && apiKeyAttempts < maxApiKeyAttempts - 1) {
            apiKeyAttempts++;
            const suspendedKeyPreview = apiKey.substring(0, 10) + '...';
            this.switchToNextApiKey();
            const nextKeyPreview = this.getCurrentApiKey().substring(0, 10) + '...';
            const message = `API ключ ${suspendedKeyPreview} (ключ #${currentKeyIndex + 1}) приостановлен, переключаюсь на ключ #${this.currentApiKeyIndex + 1} (попытка ${apiKeyAttempts}/${maxApiKeyAttempts})`;
            console.warn(`[ПЕРЕКЛЮЧЕНИЕ КЛЮЧА] ${message}`);
            if (this.config.debugMode) {
              console.log(`[DEBUG] Причина: ConsumerSuspendedError - ${apiError.message}`);
              console.log(`[DEBUG] Следующий ключ: #${this.currentApiKeyIndex + 1}: ${nextKeyPreview}`);
            }
            continue;
          }

          // Rate Limit Error
          if (apiError instanceof RateLimitError) {
            consecutiveRateLimitErrors++;

            // Проверяем, все ли ключи исчерпали квоту
            if (consecutiveRateLimitErrors >= maxApiKeyAttempts) {
              // Все API ключи исчерпали квоту - нужно подождать обновления
              console.error(`⚠️ ВСЕ ${maxApiKeyAttempts} API КЛЮЧЕЙ ИСЧЕРПАЛИ КВОТУ!`);

              // Пытаемся извлечь время retry из сообщения об ошибке
              const retryMatch = apiError.message.match(/retry in ([\d.]+)s/i);
              let waitTime = 65000; // По умолчанию 65 секунд (квота обновляется каждую минуту)

              if (retryMatch) {
                waitTime = Math.ceil(parseFloat(retryMatch[1]) * 1000) + 5000; // +5 секунд запас
              }

              console.warn(`[ОЖИДАНИЕ] Ждём ${Math.ceil(waitTime / 1000)} секунд для обновления квот всех ключей...`);
              await new Promise(resolve => setTimeout(resolve, waitTime));

              // Сбрасываем счётчики и начинаем сначала
              consecutiveRateLimitErrors = 0;
              apiKeyAttempts = 0;
              console.log(`[ВОЗОБНОВЛЕНИЕ] Повторная попытка после ожидания обновления квот...`);
              continue;
            }

            // Если не все ключи исчерпаны, переключаемся на следующий
            if (apiKeyAttempts < maxApiKeyAttempts - 1) {
              apiKeyAttempts++;
              const rateLimitedKeyPreview = apiKey.substring(0, 10) + '...';
              this.switchToNextApiKey();
              const nextKeyPreview = this.getCurrentApiKey().substring(0, 10) + '...';
              const message = `API ключ ${rateLimitedKeyPreview} (ключ #${currentKeyIndex + 1}) превысил квоту, переключаюсь на ключ #${this.currentApiKeyIndex + 1} (попытка ${apiKeyAttempts}/${maxApiKeyAttempts})`;
              console.warn(`[ПЕРЕКЛЮЧЕНИЕ КЛЮЧА] ${message}`);
              if (this.config.debugMode) {
                console.log(`[DEBUG] Причина: RateLimitError - ${apiError.message}`);
                console.log(`[DEBUG] Следующий ключ: #${this.currentApiKeyIndex + 1}: ${nextKeyPreview}`);
                console.log(`[DEBUG] Подряд RateLimitError: ${consecutiveRateLimitErrors}/${maxApiKeyAttempts}`);
              }
              continue;
            }
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
        
        // Успешный ответ - сбрасываем счётчик RateLimitError
        consecutiveRateLimitErrors = 0;

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