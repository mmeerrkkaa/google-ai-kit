import fetch, { RequestInit, Response } from 'node-fetch';
import OriginalFormData from 'form-data';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { GeminiClientConfig, DEFAULT_GEMINI_CONFIG, ProxyConfig } from './config';
import { APIKeyError, NetworkError, handleErrorResponse, GoogleAIError, ConsumerSuspendedError, RateLimitError, APIKeyExpiredError, APIKeyInvalidError, APIKeyLeakedError } from './errors';
import { Readable } from 'stream';

export class RequestHandler {
  private config: Required<Omit<GeminiClientConfig, 'proxy' | 'defaultModel' | 'debugMode'>> & { proxy?: ProxyConfig, defaultModel?: string, debugMode?: boolean };
  private currentApiKeyIndex: number = 0;
  private proxyAgent?: HttpsProxyAgent<string>;
  private dailyQuotaExhaustedKeys: Set<number> = new Set(); // Индексы ключей с исчерпанной дневной квотой

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

  private getAvailableKeysCount(): number {
    return this.config.apiKeys.length - this.dailyQuotaExhaustedKeys.size;
  }

  private markKeyAsExhausted(keyIndex: number): void {
    this.dailyQuotaExhaustedKeys.add(keyIndex);
    console.error(`🚫 API ключ #${keyIndex + 1} помечен как исчерпавший дневную квоту (не будет использоваться до 00:00 UTC)`);
  }

  private isKeyAvailable(keyIndex: number): boolean {
    return !this.dailyQuotaExhaustedKeys.has(keyIndex);
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
      // Проверяем, остались ли доступные ключи
      const availableKeysCount = this.getAvailableKeysCount();
      if (availableKeysCount === 0) {
        throw new RateLimitError(`Все ${this.config.apiKeys.length} API ключей исчерпали дневную квоту. Попробуйте повторить запрос после 00:00 UTC.`);
      }

      const currentKeyIndex = this.currentApiKeyIndex;

      // Пропускаем ключи с исчерпанной дневной квотой
      if (!this.isKeyAvailable(currentKeyIndex)) {
        if (this.config.debugMode) {
          console.log(`[DEBUG] Пропуск ключа #${currentKeyIndex + 1} (дневная квота исчерпана)`);
        }
        this.switchToNextApiKey();
        continue;
      }

      const apiKey = this.getCurrentApiKey();

      if (this.config.debugMode) {
        const keyPreview = apiKey.substring(0, 10) + '...';
        console.log(`[DEBUG] Используется API ключ #${currentKeyIndex + 1}: ${keyPreview} (доступных ключей: ${availableKeysCount}/${this.config.apiKeys.length})`);
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
          if (apiError instanceof APIKeyLeakedError && apiKeyAttempts < maxApiKeyAttempts - 1) {
            apiKeyAttempts++;
            const leakedKeyPreview = apiKey.substring(0, 10) + '...';
            this.switchToNextApiKey();

            if (this.currentApiKeyIndex === currentKeyIndex) {
              throw new APIKeyLeakedError(`API ключ ${leakedKeyPreview} был скомпрометирован, и других ключей нет. ${apiError.message}`);
            }

            const nextKeyPreview = this.getCurrentApiKey().substring(0, 10) + '...';
            const message = `[API KEY LEAKED] 💀 API ключ ${leakedKeyPreview} (ключ #${currentKeyIndex + 1}) скомпрометирован, переключаюсь на ключ #${this.currentApiKeyIndex + 1} (попытка ${apiKeyAttempts}/${maxApiKeyAttempts})`;
            console.error(message);
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

            // Проверяем, не вернулись ли мы на тот же ключ (значит он единственный)
            if (this.currentApiKeyIndex === currentKeyIndex) {
              throw new APIKeyInvalidError(`API ключ ${invalidKeyPreview} невалиден и других ключей нет. ${apiError.message}`);
            }

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

            // Проверяем, не вернулись ли мы на тот же ключ (значит он единственный)
            if (this.currentApiKeyIndex === currentKeyIndex) {
              throw new ConsumerSuspendedError(`API ключ ${suspendedKeyPreview} приостановлен и других ключей нет. ${apiError.message}`);
            }

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
            // Проверяем, это дневная квота (3М токенов) или минутная (2 RPM)
            const isDailyQuota = apiError.message.includes('free_tier_input_token_count') ||
                                apiError.message.includes('free_tier_output_token_count');

            if (isDailyQuota) {
              // Дневная квота исчерпана - помечаем ключ как недоступный
              this.markKeyAsExhausted(currentKeyIndex);
              const availableKeys = this.getAvailableKeysCount();

              console.error(`💀 API ключ #${currentKeyIndex + 1} исчерпал ДНЕВНУЮ квоту (доступно ключей: ${availableKeys}/${this.config.apiKeys.length})`);

              if (availableKeys === 0) {
                // Все ключи исчерпали дневную квоту
                throw new RateLimitError(`Все ${this.config.apiKeys.length} API ключей исчерпали дневную квоту. Попробуйте повторить запрос после 00:00 UTC.`);
              }

              // Переключаемся на следующий доступный ключ
              this.switchToNextApiKey();
              continue;
            }

            // Минутная квота (RPM) - можно подождать и повторить
            consecutiveRateLimitErrors++;

            // Проверяем, все ли ДОСТУПНЫЕ ключи исчерпали минутную квоту
            const availableKeys = this.getAvailableKeysCount();
            if (consecutiveRateLimitErrors >= availableKeys) {
              // Все доступные API ключи исчерпали минутную квоту - нужно подождать обновления
              console.error(`⚠️ ВСЕ ${availableKeys} ДОСТУПНЫХ API КЛЮЧЕЙ ИСЧЕРПАЛИ МИНУТНУЮ КВОТУ!`);

              // Пытаемся извлечь время retry из сообщения об ошибке
              const retryMatch = apiError.message.match(/retry in ([\d.]+)s/i);
              let waitTime = 65000; // По умолчанию 65 секунд (квота обновляется каждую минуту)

              if (retryMatch) {
                waitTime = Math.ceil(parseFloat(retryMatch[1]) * 1000) + 5000; // +5 секунд запас
              }

              console.warn(`[ОЖИДАНИЕ] Ждём ${Math.ceil(waitTime / 1000)} секунд для обновления минутных квот...`);
              await new Promise(resolve => setTimeout(resolve, waitTime));

              // Сбрасываем счётчики и начинаем сначала
              consecutiveRateLimitErrors = 0;
              apiKeyAttempts = 0;
              console.log(`[ВОЗОБНОВЛЕНИЕ] Повторная попытка после ожидания обновления минутных квот...`);
              continue;
            }

            // Если не все доступные ключи исчерпаны, переключаемся на следующий
            if (apiKeyAttempts < maxApiKeyAttempts - 1) {
              apiKeyAttempts++;
              const rateLimitedKeyPreview = apiKey.substring(0, 10) + '...';
              this.switchToNextApiKey();
              const message = `API ключ ${rateLimitedKeyPreview} (ключ #${currentKeyIndex + 1}) превысил минутную квоту, переключаюсь на ключ #${this.currentApiKeyIndex + 1} (попытка ${apiKeyAttempts}/${maxApiKeyAttempts})`;
              console.warn(`[ПЕРЕКЛЮЧЕНИЕ КЛЮЧА] ${message}`);
              if (this.config.debugMode) {
                console.log(`[DEBUG] Причина: RateLimitError (минутная) - ${apiError.message}`);
                console.log(`[DEBUG] Подряд RateLimitError: ${consecutiveRateLimitErrors}/${availableKeys}`);
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