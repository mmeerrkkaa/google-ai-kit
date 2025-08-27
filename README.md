# Google AI Kit

TypeScript/JavaScript SDK для работы с Google Gemini AI API с поддержкой прокси, множественных API ключей и автоматическим переключением при ошибках.

## Особенности

- 🔄 **Автоматическое переключение API ключей** при ошибках (включая CONSUMER_SUSPENDED)
- 🌐 **Поддержка прокси** для обхода ограничений
- 💬 **Управление историей чата** для каждого пользователя/группы
- 📝 **TypeScript поддержка** с полными типами
- 🛡️ **Обработка ошибок** с детальным логированием
- ⚡ **Высокая производительность** с оптимизированными запросами

## Установка

```bash
npm install google-ai-kit
```

## Быстрый старт

```javascript
const { GeminiClient } = require('google-ai-kit');

const client = new GeminiClient({
  apiKeys: ['your-api-key-1', 'your-api-key-2'],
  defaultModel: 'gemini-2.5-pro',
  debugMode: true
});

// Простой запрос
const response = await client.generateContent({
  prompt: 'Привет! Как дела?'
});

console.log(response.text());
```

## Конфигурация

### Основные параметры

```javascript
const client = new GeminiClient({
  // Обязательные параметры
  apiKeys: ['key1', 'key2', 'key3'], // Массив API ключей
  
  // Опциональные параметры
  defaultModel: 'gemini-2.5-pro',    // Модель по умолчанию
  debugMode: true,                   // Включить отладочные логи
  
  // Настройки прокси
  proxy: {
    host: 'proxy.example.com',
    port: 8080,
    user: 'username',
    pass: 'password'
  },
  
  // Настройки истории сообщений
  messageStoreConfig: {
    type: 'memory', // или 'disk'
    path: './messages' // для disk типа
  }
});
```

### Поддержка прокси

```javascript
// Простой прокси. для юзеров из рф
const client = new GeminiClient({
  apiKeys: ['your-key'],
  proxy: {
    host: '146.247.121.52',
    port: 5692,
    user: 'user134887',
    pass: 'twbxkp'
  }
});
```

## Использование

### Базовые запросы

```javascript
// Простой запрос
const response = await client.generateContent({
  prompt: 'Расскажи о JavaScript'
});

console.log(response.text());

// Запрос с системной инструкцией
const response = await client.generateContent({
  prompt: 'Привет!',
  systemInstruction: {
    role: 'system',
    parts: [{ text: 'Ты дружелюбный помощник' }]
  }
});
```

### Чат с историей

```javascript
// Запрос с сохранением истории
const response = await client.generateContent({
  prompt: 'Привет!',
  user: 'user123'
});

// Следующий запрос будет учитывать предыдущий контекст
const response2 = await client.generateContent({
  prompt: 'Как меня зовут?',
  user: 'user123'
});
```

### Работа с файлами

```javascript
// Загрузка файла
const file = await client.files.uploadFile({
  filePath: './document.pdf',
  mimeType: 'application/pdf'
});

// Запрос с файлом
const response = await client.generateContent({
  prompt: 'Проанализируй этот документ',
  contents: [
    {
      role: 'user',
      parts: [
        { text: 'Проанализируй этот документ' },
        { fileData: { mimeType: 'application/pdf', fileUri: file.uri } }
      ]
    }
  ]
});
```

### Потоковые ответы

```javascript
// Получение ответа потоком
const stream = client.generateContentStream({
  prompt: 'Напиши длинную историю'
});

for await (const chunk of stream) {
  if (chunk.candidates?.[0]?.content?.parts?.[0]?.text) {
    process.stdout.write(chunk.candidates[0].content.parts[0].text);
  }
}
```

## Обработка ошибок

SDK автоматически обрабатывает различные типы ошибок:

- **CONSUMER_SUSPENDED**: Автоматически переключается на следующий API ключ
- **Rate Limit**: Повторяет запрос с экспоненциальной задержкой
- **Network Errors**: Логирует ошибки и предоставляет детальную информацию

```javascript
try {
  const response = await client.generateContent({
    prompt: 'Тестовый запрос'
  });
} catch (error) {
  console.error('Ошибка:', error.message);
  console.error('Статус:', error.statusCode);
  console.error('Детали:', error.details);
}
```

## API Reference

### GeminiClient

#### Конструктор

```javascript
new GeminiClient(config: GeminiClientConfig)
```

#### Методы

- `generateContent(request: GenerateContentRequest): Promise<EnhancedGenerateContentResponse>`
- `generateContentStream(request: GenerateContentRequest): AsyncIterable<StreamGenerateContentResponse>`
- `chat(chatRequest: ChatRequest): Promise<EnhancedGenerateContentResponse>`
- `countTokens(request: CountTokensRequest): Promise<CountTokensResponse>`
- `embedContent(request: EmbedContentRequest): Promise<EmbedContentResponse>`

### Типы

Все TypeScript типы доступны для импорта:

```typescript
import {
  GeminiClientConfig,
  GenerateContentRequest,
  GenerateContentResponse,
  ChatRequest,
  // ... и другие
} from 'google-ai-kit';
```

## Примеры

Смотрите папку `examples/` для дополнительных примеров использования.

## Лицензия

MIT

## Поддержка

Если у вас есть вопросы или проблемы, создайте issue в репозитории проекта. Сам проект создавался для себя, но спустя времярешил выложить его на гит