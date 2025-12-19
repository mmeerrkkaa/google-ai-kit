# Google AI Kit

> **TypeScript/JavaScript SDK для работы с Google Gemini AI API**

Полнофункциональная библиотека с поддержкой прокси, множественных API ключей, автоматического переключения при ошибках, и простого Chat API

[![npm version](https://img.shields.io/npm/v/google-ai-kit.svg)](https://www.npmjs.com/package/google-ai-kit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🌟 Основные возможности

- 🔄 **Автоматическое переключение API ключей** при ошибках
- 🌐 **Поддержка прокси** для обхода региональных ограничений
- 💬 **Автоматическое управление историей** разговоров
- 🔧 **Function Calling** с автоматическим выполнением
- 📁 **File API** для работы с мультимодальным контентом
- 🌊 **Streaming** с поддержкой SSE
- 📝 **Полная TypeScript поддержка** с детальными типами
- 🛡️ **Умная обработка ошибок** с retry логикой

---

## 📦 Установка

```bash
npm install google-ai-kit
```

---

## Быстрый старт

### Новый Chat API (Рекомендуется)

Простой и интуитивный способ работы с чатами:

```javascript
const { GeminiClient } = require('google-ai-kit');

const client = new GeminiClient({
  apiKeys: [process.env.GEMINI_API_KEY],
  defaultModel: 'gemini-2.5-flash'
});

// Создать чат сессию
const chat = client.chats.create({
  model: 'gemini-2.5-flash'
});

// Отправить сообщение - история автоматически сохраняется!
const response1 = await chat.sendMessage('Привет! Как дела?');
console.log(response1.text());

const response2 = await chat.sendMessage('Расскажи мне шутку');
console.log(response2.text());

// Получить историю
const history = chat.getHistory();
console.log(`Всего сообщений: ${history.length}`);
```

### Старый API (Для продвинутого использования)

```javascript
const { GeminiClient } = require('google-ai-kit');

const client = new GeminiClient({
  apiKeys: ['your-api-key'],
  defaultModel: 'gemini-2.5-flash'
});

const response = await client.generateContent({
  prompt: 'Привет! Как дела?'
});

console.log(response.text());
```

---

## 📚 Документация

### 📋 Содержание

1. [Конфигурация](#-конфигурация)
2. [Chat API (Новый)](#-chat-api-новый)
3. [Расширенный API](#-расширенный-api)
4. [Function Calling](#-function-calling)
5. [File API](#-file-api)
6. [Streaming](#-streaming)
7. [Работа с прокси](#-работа-с-прокси)
8. [Обработка ошибок](#-обработка-ошибок)
9. [API Reference](#-api-reference)
10. [Примеры](#-примеры)

---

## ⚙️ Конфигурация

### Основные параметры

```javascript
const client = new GeminiClient({
  // ✅ Обязательные параметры
  apiKeys: ['key1', 'key2', 'key3'], // Массив API ключей для fallback

  // 🎯 Опциональные параметры
  defaultModel: 'gemini-2.5-flash',        // Модель по умолчанию
  debugMode: true,                         // Включить отладочные логи
  apiEndpoint: 'https://generativelanguage.googleapis.com', // API endpoint
  apiVersion: 'v1beta',                    // Версия API
  requestTimeout: 60000,                   // Таймаут запроса (мс)
  maxRetries: 2,                           // Количество повторных попыток
  defaultMaxToolCalls: 5,                  // Макс. вызовов функций

  // 🌐 Настройки прокси
  proxy: {
    host: 'proxy.example.com',
    port: 8080,
    user: 'username',        // Опционально
    pass: 'password',        // Опционально
    protocol: 'http'         // 'http' или 'https'
  },

  // 💾 Хранилище истории сообщений
  messageStoreConfig: {
    type: 'memory',          // 'memory' или 'disk'
    path: './messages'       // Путь для 'disk' типа
  }
});
```

## 💬 Chat API (Новый)

### Создание чат-сессии

```javascript
const chat = client.chats.create({
  model: 'gemini-2.5-flash',
  systemInstruction: 'Ты дружелюбный помощник',
  generationConfig: {
    temperature: 0.7,
    maxOutputTokens: 2000,
    topP: 0.95,
    topK: 40
  },
  safetySettings: [
    {
      category: 'HARM_CATEGORY_HATE_SPEECH',
      threshold: 'BLOCK_MEDIUM_AND_ABOVE'
    }
  ],
  tools: [/* функции */],
  maxToolCalls: 5
});
```

### Отправка сообщений

```javascript
// Простая строка
const response = await chat.sendMessage('Привет!');
console.log(response.text());

// С объектом
const response = await chat.sendMessage({
  message: 'Привет!',
  generationConfig: { temperature: 0.9 },
  safetySettings: [/* ... */]
});
```

### Streaming

```javascript
const stream = chat.sendMessageStream('Напиши длинную историю');

for await (const chunk of stream) {
  const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
  if (text) {
    process.stdout.write(text);
  }
}
```

### Управление историей

```javascript
// Получить историю
const history = chat.getHistory();
console.log(history);

// Очистить историю
chat.clearHistory();

// Установить историю (восстановление из сохранённой)
const savedHistory = [
  { role: 'user', parts: [{ text: 'Меня зовут Алекс' }] },
  { role: 'model', parts: [{ text: 'Приятно познакомиться, Алекс!' }] }
];
chat.setHistory(savedHistory);

// Создать новый чат с начальной историей
const chat2 = client.chats.create({
  model: 'gemini-2.5-flash',
  history: savedHistory
});
```

### Дополнительные методы

```javascript
// Получить текущую модель
const model = chat.getModel();

// Обновить system instruction
chat.setSystemInstruction('Новая инструкция');

// Обновить generation config
chat.setGenerationConfig({ temperature: 0.5 });

// Обновить tools
chat.setTools([/* новые tools */]);
```

---

## 🔧 Расширенный API

### Базовый запрос

```javascript
const response = await client.generateContent({
  prompt: 'Расскажи о JavaScript',
  model: 'gemini-2.5-flash'  // Опционально
});

console.log(response.text());
```

### С системной инструкцией

```javascript
const response = await client.generateContent({
  prompt: 'Привет!',
  systemInstruction: {
    role: 'system',
    parts: [{ text: 'Ты эксперт по программированию' }]
  }
});
```

### С полной структурой contents

```javascript
const response = await client.generateContent({
  contents: [
    {
      role: 'user',
      parts: [
        { text: 'Проанализируй этот код:' },
        { text: 'function hello() { console.log("Hi"); }' }
      ]
    }
  ],
  generationConfig: {
    temperature: 0.7,
    maxOutputTokens: 1000,
    topP: 0.9,
    topK: 40
  }
});
```

### Упрощённый Chat метод

```javascript
const response = await client.chat({
  prompt: 'Как дела?',
  systemInstruction: 'Ты дружелюбный бот',
  history: [
    { role: 'user', text: 'Привет!' },
    { role: 'assistant', text: 'Здравствуй!' }
  ],
  user: 'user123'  // ID для сохранения истории
});
```

---

## 🛠️ Function Calling

### Определение функций с автоматическим выполнением

```javascript
const tools = [{
  functionDeclarations: [{
    name: "getCurrentWeather",
    description: "Получить текущую погоду для заданного местоположения",
    parameters: {
      type: "OBJECT",
      properties: {
        location: {
          type: "STRING",
          description: "Город или координаты"
        },
        unit: {
          type: "STRING",
          enum: ["celsius", "fahrenheit"],
          description: "Единица измерения температуры"
        }
      },
      required: ["location"]
    },
    // ✨ Функция выполнения - вызывается автоматически!
    execute: async (args) => {
      const { location, unit = "celsius" } = args;
      // Ваша логика получения погоды
      return {
        temperature: 22,
        condition: "sunny",
        location: location,
        unit: unit
      };
    }
  }, {
    name: "searchDatabase",
    description: "Поиск в базе данных",
    parameters: {
      type: "OBJECT",
      properties: {
        query: { type: "STRING" }
      },
      required: ["query"]
    },
    execute: async (args) => {
      // Поиск в БД
      return { results: [/* ... */] };
    }
  }]
}];

// Chat API
const chat = client.chats.create({
  tools: tools,
  maxToolCalls: 5
});

const response = await chat.sendMessage('Какая погода в Москве?');
// Функция getCurrentWeather вызывается автоматически!
console.log(response.text());

// Или расширенный API
const response = await client.generateContent({
  prompt: 'Какая погода в Лондоне?',
  tools: tools,
  toolConfig: {
    functionCallingConfig: {
      mode: 'AUTO',  // AUTO, ANY, NONE
      maxCalls: 5
    }
  }
});
```

### Режимы Function Calling

```javascript
const { FunctionCallingMode } = require('google-ai-kit');

// AUTO - модель решает, вызывать ли функцию
toolConfig: {
  functionCallingConfig: {
    mode: FunctionCallingMode.AUTO
  }
}

// ANY - модель ДОЛЖНА вызвать одну из функций
toolConfig: {
  functionCallingConfig: {
    mode: FunctionCallingMode.ANY,
    allowedFunctionNames: ['getCurrentWeather', 'searchDatabase']
  }
}

// NONE - модель НЕ может вызывать функции
toolConfig: {
  functionCallingConfig: {
    mode: FunctionCallingMode.NONE
  }
}
```

---

## 📁 File API

### Загрузка файлов

```javascript
// Загрузить файл
const file = await client.files.uploadFile(
  '/path/to/document.pdf',
  'My Document'  // Display name
);

console.log('File URI:', file.name);
console.log('MIME Type:', file.mimeType);

// Использовать файл в запросе
const response = await client.generateContent({
  contents: [{
    role: 'user',
    parts: [
      { text: 'Проанализируй этот документ' },
      {
        fileData: {
          mimeType: file.mimeType,
          fileUri: file.name
        }
      }
    ]
  }]
});
```

### Управление файлами

```javascript
// Список всех файлов
const files = await client.files.listFiles(10); // Лимит 10
files.files.forEach(file => {
  console.log(file.name, file.displayName);
});

// Получить информацию о файле
const fileInfo = await client.files.getFile('files/abc123');

// Удалить файл
await client.files.deleteFile('files/abc123');
```

### Поддерживаемые типы файлов

- **Изображения**: PNG, JPEG, WEBP, HEIC, HEIF
- **Аудио**: WAV, MP3, AIFF, AAC, OGG, FLAC
- **Видео**: MP4, MPEG, MOV, AVI, FLV, MPG, WEBM, WMV
- **Документы**: PDF, TXT, HTML, CSS, JS, TS, CSV, XML, RTF

---

## 🌊 Streaming

### Chat API Streaming

```javascript
const chat = client.chats.create({ model: 'gemini-2.5-flash' });

const stream = chat.sendMessageStream('Напиши эссе о космосе');

for await (const chunk of stream) {
  const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
  if (text) {
    process.stdout.write(text);
  }
}
console.log('\n\nГотово!');
```

### Расширенный API Streaming

```javascript
const stream = client.generateContentStream({
  prompt: 'Напиши длинную статью',
  generationConfig: {
    temperature: 0.8,
    maxOutputTokens: 2000
  }
});

for await (const chunk of stream) {
  // Обработка каждого chunk
  if (chunk.candidates && chunk.candidates[0]) {
    const content = chunk.candidates[0].content;
    const text = content?.parts?.[0]?.text;

    if (text) {
      process.stdout.write(text);
    }

    // Проверка причины завершения
    if (chunk.candidates[0].finishReason) {
      console.log('\nFinish reason:', chunk.candidates[0].finishReason);
    }
  }
}
```

---

## 🌐 Работа с прокси

### Настройка прокси для РФ

```javascript
const client = new GeminiClient({
  apiKeys: [process.env.GEMINI_API_KEY],
  proxy: {
    host: '146.247.121.52',
    port: 5692,
    user: 'user134887',
    pass: 'twbxkp',
    protocol: 'http'
  }
});
```

### SOCKS5 прокси

```javascript
const client = new GeminiClient({
  apiKeys: [process.env.GEMINI_API_KEY],
  proxy: {
    host: 'socks5-proxy.example.com',
    port: 1080,
    protocol: 'http'  // Используйте http-tunnel через SOCKS5
  }
});
```

### Проксирование через локальный тоннель

```javascript
// Запустите локальный прокси (например, Shadowsocks)
// Затем используйте его:
const client = new GeminiClient({
  apiKeys: [process.env.GEMINI_API_KEY],
  proxy: {
    host: '127.0.0.1',
    port: 1080,
    protocol: 'http'
  }
});
```

---

## 🛡️ Обработка ошибок

### Автоматическая обработка

SDK автоматически обрабатывает:

- ✅ **CONSUMER_SUSPENDED**: Переключается на следующий API ключ
- ✅ **Rate Limit (429)**: Retry с экспоненциальной задержкой
- ✅ **Server Errors (5xx)**: Автоматические повторные попытки
- ✅ **Network Errors**: Детальное логирование

### Ручная обработка

```javascript
const {
  GeminiAPIError,
  ConsumerSuspendedError,
  RateLimitError
} = require('google-ai-kit');

try {
  const response = await client.generateContent({
    prompt: 'Тестовый запрос'
  });
} catch (error) {
  if (error instanceof ConsumerSuspendedError) {
    console.error('API ключ приостановлен:', error.message);
  } else if (error instanceof RateLimitError) {
    console.error('Превышен лимит запросов:', error.message);
  } else if (error instanceof GeminiAPIError) {
    console.error('API ошибка:', error.statusCode, error.message);
    console.error('Детали:', error.details);
  } else {
    console.error('Неизвестная ошибка:', error);
  }
}
```

### Response helpers с обработкой ошибок

```javascript
const response = await client.generateContent({ prompt: 'Тест' });

// Получить текст (возвращает null при ошибке)
const text = response.text();
if (!text) {
  console.log('Blocked reason:', response.promptFeedback?.blockReason);
  console.log('Finish reason:', response.candidates?.[0]?.finishReason);
}

// Парсить JSON (возвращает null при ошибке)
const json = response.json();
if (!json) {
  console.error('Не удалось распарсить JSON ответ');
}
```

---

## 🔢 Подсчёт токенов

```javascript
// Подсчёт токенов для строки
const count = await client.countTokens('Привет, как дела?');
console.log('Токенов:', count.totalTokens);

// Подсчёт токенов для полного запроса
const count = await client.countTokens({
  contents: [{
    role: 'user',
    parts: [{ text: 'Длинный текст...' }]
  }],
  systemInstruction: {
    role: 'system',
    parts: [{ text: 'Ты помощник' }]
  }
});

console.log('Всего токенов:', count.totalTokens);
```

---

## 🎯 Embeddings

```javascript
const response = await client.embedContent({
  content: {
    parts: [{ text: 'Это текст для эмбеддинга' }]
  },
  taskType: 'RETRIEVAL_DOCUMENT'  // или 'RETRIEVAL_QUERY', 'SEMANTIC_SIMILARITY', etc.
}, 'models/text-embedding-004');

console.log('Эмбеддинг:', response.embedding.values);
console.log('Размерность:', response.embedding.values.length);
```

---

## 🧠 Thinking Mode

Thinking mode позволяет модели "обдумать" ответ перед генерацией, что улучшает качество ответов на сложные вопросы.

### Chat API с Thinking Mode

```javascript
const chat = client.chats.create({
  model: 'gemini-2.5-flash',
  generationConfig: {
    thinkingConfig: {
      mode: 'enabled',           // 'enabled' или 'disabled'
      maxThinkingTokens: 1000    // Лимит токенов для размышлений
    }
  }
});

const response = await chat.sendMessage(
  'Решите сложную математическую задачу: ...'
);
console.log(response.text());
```

### Расширенный API с Thinking Mode

```javascript
const response = await client.generateContent({
  prompt: 'Объясни квантовую запутанность',
  generationConfig: {
    temperature: 0.7,
    thinkingConfig: {
      mode: 'enabled',
      maxThinkingTokens: 1500
    }
  }
}, 'gemini-2.0-flash-thinking-exp');
```

### Динамическое управление

```javascript
const chat = client.chats.create({
  model: 'gemini-2.0-flash-thinking-exp'
});

// Простой вопрос - без thinking
chat.setGenerationConfig({
  thinkingConfig: { mode: 'disabled' }
});
await chat.sendMessage('Привет!');

// Сложный вопрос - включаем thinking
chat.setGenerationConfig({
  thinkingConfig: {
    mode: 'enabled',
    maxThinkingTokens: 1000
  }
});
await chat.sendMessage('Объясни теорию относительности');
```

### Когда использовать Thinking Mode?

✅ **Используйте для:**
- Сложных математических задач
- Логических головоломок
- Анализа научных концепций
- Задач требующих пошагового рассуждения
- Программирования сложных алгоритмов

❌ **Не нужен для:**
- Простых приветствий
- Генерации текста
- Перевода
- Суммаризации
- Простых вопросов

---

## 📖 API Reference

### GeminiClient

#### Constructor
```typescript
new GeminiClient(config: GeminiClientConfig)
```

#### Properties
```typescript
client.files: FileManager        // Управление файлами
client.chats: ChatManager        // Создание чат-сессий
client.messageStore?: IMessageStore  // Хранилище истории
```

#### Methods

**generateContent**
```typescript
generateContent(
  request: GenerateContentRequest,
  model?: string
): Promise<EnhancedGenerateContentResponse>
```

**generateContentStream**
```typescript
generateContentStream(
  request: GenerateContentRequest,
  model?: string
): AsyncGenerator<StreamGenerateContentResponse>
```

**chat**
```typescript
chat(
  chatRequest: ChatRequest
): Promise<EnhancedGenerateContentResponse>
```

**countTokens**
```typescript
countTokens(
  request: CountTokensRequest | string,
  model?: string
): Promise<CountTokensResponse>
```

**embedContent**
```typescript
embedContent(
  request: EmbedContentRequest,
  model?: string
): Promise<EmbedContentResponse>
```

### Chat Class

#### Constructor
```typescript
// Создаётся через ChatManager
const chat = client.chats.create(config: ChatConfig)
```

#### Methods

**sendMessage**
```typescript
sendMessage(
  request: string | SendMessageRequest
): Promise<EnhancedGenerateContentResponse>
```

**sendMessageStream**
```typescript
sendMessageStream(
  request: string | SendMessageRequest
): AsyncGenerator<StreamGenerateContentResponse>
```

**getHistory**
```typescript
getHistory(): Content[]
```

**setHistory**
```typescript
setHistory(history: Content[]): void
```

**clearHistory**
```typescript
clearHistory(): void
```

**getModel**
```typescript
getModel(): string
```

**setSystemInstruction**
```typescript
setSystemInstruction(instruction: string | SystemInstruction): void
```

**setGenerationConfig**
```typescript
setGenerationConfig(config: GenerationConfig): void
```

**setTools**
```typescript
setTools(tools: Tool[]): void
```

### FileManager

**uploadFile**
```typescript
uploadFile(
  filePath: string,
  displayName?: string
): Promise<FileMetadata>
```

**listFiles**
```typescript
listFiles(
  pageSize?: number,
  pageToken?: string
): Promise<{ files: FileMetadata[], nextPageToken?: string }>
```

**getFile**
```typescript
getFile(
  fileName: string
): Promise<FileMetadata>
```

**deleteFile**
```typescript
deleteFile(
  fileName: string
): Promise<void>
```

### Основные типы

```typescript
interface GeminiClientConfig {
  apiKeys: string[];
  defaultModel?: string;
  apiEndpoint?: string;
  apiVersion?: string;
  proxy?: ProxyConfig;
  requestTimeout?: number;
  maxRetries?: number;
  messageStoreConfig?: MessageStoreConfig;
  defaultMaxToolCalls?: number;
  debugMode?: boolean;
}

interface GenerateContentRequest {
  prompt?: string;
  contents?: Content[];
  systemInstruction?: SystemInstruction;
  tools?: Tool[];
  toolConfig?: ToolConfig;
  generationConfig?: GenerationConfig;
  safetySettings?: SafetySetting[];
  user?: string;
}

interface ChatConfig {
  model?: string;
  systemInstruction?: string | SystemInstruction;
  history?: Content[];
  generationConfig?: GenerationConfig;
  safetySettings?: SafetySetting[];
  tools?: Tool[];
  maxToolCalls?: number;
}

interface Content {
  role: 'user' | 'model' | 'system';
  parts: Part[];
}

interface Part {
  text?: string;
  inlineData?: { mimeType: string; data: string };
  fileData?: { mimeType: string; fileUri: string };
  functionCall?: FunctionCall;
  functionResponse?: FunctionResponse;
}

interface GenerationConfig {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  stopSequences?: string[];
  responseMimeType?: string;
  responseSchema?: Schema;
}
```

---

## 📝 Примеры

### Пример 1: Простой чат

```javascript
const { GeminiClient } = require('google-ai-kit');

const client = new GeminiClient({
  apiKeys: [process.env.GEMINI_API_KEY]
});

const chat = client.chats.create();

async function main() {
  const r1 = await chat.sendMessage('Привет!');
  console.log('AI:', r1.text());

  const r2 = await chat.sendMessage('Как дела?');
  console.log('AI:', r2.text());
}

main();
```

### Пример 2: Чат с историей

```javascript
// Предопределённая история
const history = [
  { role: 'user', parts: [{ text: 'Меня зовут Алекс' }] },
  { role: 'model', parts: [{ text: 'Приятно познакомиться, Алекс!' }] }
];

const chat = client.chats.create({
  history: history
});

const response = await chat.sendMessage('Как меня зовут?');
console.log(response.text()); // "Вас зовут Алекс"
```

### Пример 3: Function Calling

```javascript
const tools = [{
  functionDeclarations: [{
    name: "getWeather",
    description: "Получить погоду",
    parameters: {
      type: "OBJECT",
      properties: {
        city: { type: "STRING" }
      },
      required: ["city"]
    },
    execute: async ({ city }) => {
      // API вызов или mock данные
      return { temp: 25, condition: "sunny", city };
    }
  }]
}];

const chat = client.chats.create({ tools });
const response = await chat.sendMessage('Какая погода в Москве?');
console.log(response.text());
```

### Пример 4: Работа с файлами

```javascript
// Загрузить изображение
const file = await client.files.uploadFile('./photo.jpg', 'My Photo');

// Отправить в чат
const response = await client.generateContent({
  contents: [{
    role: 'user',
    parts: [
      { text: 'Опиши это изображение' },
      { fileData: { mimeType: file.mimeType, fileUri: file.name } }
    ]
  }]
});

console.log(response.text());
```

### Пример 5: Streaming с обработкой

```javascript
const chat = client.chats.create();

const stream = chat.sendMessageStream('Напиши длинную историю');

let fullText = '';
for await (const chunk of stream) {
  const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
  if (text) {
    fullText += text;
    process.stdout.write(text);
  }
}

console.log('\n\nВсего символов:', fullText.length);
```

### Пример 6: Несколько чатов одновременно

```javascript
const mathChat = client.chats.create({
  systemInstruction: 'Ты учитель математики'
});

const codeChat = client.chats.create({
  systemInstruction: 'Ты программист'
});

const [mathRes, codeRes] = await Promise.all([
  mathChat.sendMessage('Реши 15 * 23'),
  codeChat.sendMessage('Напиши функцию сортировки')
]);

console.log('Math:', mathRes.text());
console.log('Code:', codeRes.text());
```

### Пример 7: JSON режим

```javascript
const response = await client.generateContent({
  prompt: 'Создай JSON с информацией о 3 программистах',
  generationConfig: {
    responseMimeType: 'application/json',
    responseSchema: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          experience: { type: 'NUMBER' },
          skills: { type: 'ARRAY', items: { type: 'STRING' } }
        },
        required: ['name', 'experience', 'skills']
      }
    }
  }
});

const data = response.json();
console.log(data);
```

### Пример 8: Сохранение и восстановление

```javascript
const chat1 = client.chats.create();
await chat1.sendMessage('Меня зовут Иван');

// Сохранить в файл
const fs = require('fs');
const history = chat1.getHistory();
fs.writeFileSync('chat-history.json', JSON.stringify(history));

// Позже... восстановить
const savedHistory = JSON.parse(fs.readFileSync('chat-history.json'));
const chat2 = client.chats.create({ history: savedHistory });

const response = await chat2.sendMessage('Как меня зовут?');
console.log(response.text()); // "Вас зовут Иван"
```

---

## 🎭 Сравнение API стилей

### Chat API vs Расширенный API

| Особенность | Chat API | Расширенный API |
|------------|----------|-----------------|
| Простота | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Автоматическая история | ✅ | ❌ (вручную) |
| Гибкость | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Производительность | Одинаковая | Одинаковая |
| Код | Меньше | Больше |
| Использование | Чаты, диалоги | Сложные кейсы |

### Код сравнение

**Chat API:**
```javascript
const chat = client.chats.create();
const r1 = await chat.sendMessage('Hello');
const r2 = await chat.sendMessage('How are you?');
```

**Расширенный API:**
```javascript
let history = [];
history.push({ role: 'user', parts: [{ text: 'Hello' }] });
const r1 = await client.generateContent({ contents: history });
history.push(r1.candidates[0].content);

history.push({ role: 'user', parts: [{ text: 'How are you?' }] });
const r2 = await client.generateContent({ contents: history });
```

Новый Chat API на **70% короче** для типичных диалогов!

---


## 🔒 Безопасность

### Safety Settings

```javascript
const { HarmCategory, HarmBlockThreshold } = require('google-ai-kit');

const chat = client.chats.create({
  safetySettings: [
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE
    },
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
    }
  ]
});
```

### Проверка блокировки

```javascript
const response = await chat.sendMessage('Потенциально опасный контент');

if (response.promptFeedback?.blockReason) {
  console.log('Запрос заблокирован:', response.promptFeedback.blockReason);
  console.log('Рейтинги безопасности:', response.promptFeedback.safetyRatings);
}

const text = response.text();
if (!text) {
  console.log('Ответ заблокирован по причине:',
    response.candidates?.[0]?.finishReason);
}
```

---

## 🌍 Использование в разных окружениях

### Node.js

```javascript
const { GeminiClient } = require('google-ai-kit');
// Работает из коробки
```

### TypeScript

```typescript
import { GeminiClient, ChatConfig, GenerateContentRequest } from 'google-ai-kit';

const client = new GeminiClient({
  apiKeys: [process.env.GEMINI_API_KEY!]
});
```

### ES Modules

```javascript
import { GeminiClient } from 'google-ai-kit';

const client = new GeminiClient({
  apiKeys: [process.env.GEMINI_API_KEY]
});
```

### С .env файлом

```bash
# .env
GEMINI_API_KEY=your-api-key-here
PROXY_HOST=proxy.example.com
PROXY_PORT=8080
```

```javascript
require('dotenv').config();

const client = new GeminiClient({
  apiKeys: [process.env.GEMINI_API_KEY],
  proxy: {
    host: process.env.PROXY_HOST,
    port: parseInt(process.env.PROXY_PORT)
  }
});
```

---

## 🧪 Тестирование

### Запуск примеров

```bash
# Все примеры
node examples/simpleChatExample.js

# Отдельные примеры
node examples/basicChat.js
node examples/test.js

# Бенчмарк
node examples/speedComparison.js
```

### Собственные тесты

```javascript
const { GeminiClient } = require('google-ai-kit');

async function test() {
  const client = new GeminiClient({
    apiKeys: [process.env.GEMINI_API_KEY],
    debugMode: true
  });

  const chat = client.chats.create();

  console.log('Test 1: Basic message');
  const r1 = await chat.sendMessage('Hello');
  console.assert(r1.text(), 'Response should have text');

  console.log('Test 2: History tracking');
  const r2 = await chat.sendMessage('What did I just say?');
  console.assert(chat.getHistory().length === 4, 'History should have 4 messages');

  console.log('All tests passed!');
}

test().catch(console.error);
```

---

## 🐛 Отладка

### Включение debug режима

```javascript
const client = new GeminiClient({
  apiKeys: [process.env.GEMINI_API_KEY],
  debugMode: true  // 📝 Детальные логи
});
```

Вы увидите:
- ✅ URL запросов
- ✅ Используемые API ключи
- ✅ Время ответа
- ✅ Размер payload
- ✅ Ошибки с деталями


## ✨ Быстрые ссылки

- [Установка](#-установка)
- [Быстрый старт](#-быстрый-старт)
- [Chat API](#-chat-api-новый)
- [Примеры](#-примеры)
- [API Reference](#-api-reference)

---
