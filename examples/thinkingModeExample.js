const { GeminiClient } = require('../dist/index');
require('dotenv').config();

/**
 * Пример использования Thinking Mode
 * Thinking mode позволяет модели "думать" перед ответом
 */

const API_KEY = process.env.GEMINI_API_KEY;

// ============================================================
// Example 1: Chat API с Thinking Mode
// ============================================================
async function chatWithThinkingMode() {
  console.log("\n" + "=".repeat(60));
  console.log("Example 1: Chat API с Thinking Mode");
  console.log("=".repeat(60));

  const client = new GeminiClient({
    apiKeys: [API_KEY],
    defaultModel: "gemini-2.5-flash"  // Модель с поддержкой thinking
  });

  const chat = client.chats.create({
    model: "gemini-2.5-flash",
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2000,
      // Включаем thinking mode
      thinkingConfig: {
        mode: 'enabled',
        maxThinkingTokens: 1000
      }
    }
  });

  console.log("\nЗадача: Решить сложную математическую задачу");
  console.log("User: У меня есть 100 яблок. Я отдал 20% другу, затем съел 15 яблок, потом купил ещё 30. Сколько у меня яблок?\n");

  const response = await chat.sendMessage(
    'У меня есть 100 яблок. Я отдал 20% другу, затем съел 15 яблок, потом купил ещё 30. Сколько у меня яблок?'
  );

  console.log("AI Response:");
  console.log(response.text());

  // Проверяем метаданные
  if (response.candidates && response.candidates[0]) {
    const candidate = response.candidates[0];
    console.log("\n--- Метаданные ответа ---");
    console.log("Finish Reason:", candidate.finishReason);
    console.log("Token Count:", candidate.tokenCount);
  }
}

// ============================================================
// Example 2: Расширенный API с Thinking Mode
// ============================================================
async function advancedThinkingMode() {
  console.log("\n" + "=".repeat(60));
  console.log("Example 2: Расширенный API с Thinking Mode");
  console.log("=".repeat(60));

  const client = new GeminiClient({
    apiKeys: [API_KEY],
    defaultModel: "gemini-2.5-flash"
  });

  console.log("\nЗадача: Логическая головоломка");
  console.log("User: Три человека идут в ресторан. Счёт составляет 30$. Каждый даёт по 10$. Официант возвращает 5$. Они берут по 1$ себе, а 2$ оставляют официанту. Получается каждый заплатил по 9$, итого 27$, плюс 2$ у официанта = 29$. Куда делся 1$?\n");

  const response = await client.generateContent({
    prompt: 'Три человека идут в ресторан. Счёт составляет 30$. Каждый даёт по 10$. Официант возвращает 5$. Они берут по 1$ себе, а 2$ оставляют официанту. Получается каждый заплатил по 9$, итого 27$, плюс 2$ у официанту = 29$. Куда делся 1$?',
    generationConfig: {
      temperature: 0.8,
      maxOutputTokens: 2000,
      thinkingConfig: {
        mode: 'enabled',
        maxThinkingTokens: 1500
      }
    }
  });

  console.log("AI Response:");
  console.log(response.text());
}

// ============================================================
// Example 3: Сравнение с и без Thinking Mode
// ============================================================
async function comparisonExample() {
  console.log("\n" + "=".repeat(60));
  console.log("Example 3: Сравнение с и без Thinking Mode");
  console.log("=".repeat(60));

  const client = new GeminiClient({
    apiKeys: [API_KEY],
    defaultModel: "gemini-2.5-flash"
  });

  const complexQuestion = "Объясни квантовую запутанность простыми словами, но с научной точностью.";

  // Без thinking mode
  console.log("\n--- БЕЗ Thinking Mode ---");
  console.log(`User: ${complexQuestion}\n`);

  const startWithout = Date.now();
  const responseWithout = await client.generateContent({
    prompt: complexQuestion,
    generationConfig: {
      temperature: 0.7,
      thinkingConfig: {
        mode: 'disabled'
      }
    }
  });
  const timeWithout = Date.now() - startWithout;

  console.log("AI Response:");
  console.log(responseWithout.text());
  console.log(`\nВремя: ${timeWithout}ms`);

  // Задержка
  await new Promise(resolve => setTimeout(resolve, 1000));

  // С thinking mode
  console.log("\n\n--- С Thinking Mode ---");
  console.log(`User: ${complexQuestion}\n`);

  const startWith = Date.now();
  const responseWith = await client.generateContent({
    prompt: complexQuestion,
    generationConfig: {
      temperature: 0.7,
      thinkingConfig: {
        mode: 'enabled',
        maxThinkingTokens: 1000
      }
    }
  });
  const timeWith = Date.now() - startWith;

  console.log("AI Response:");
  console.log(responseWith.text());
  console.log(`\nВремя: ${timeWith}ms`);

  console.log("\n--- Сравнение ---");
  console.log(`Без thinking: ${timeWithout}ms`);
  console.log(`С thinking: ${timeWith}ms`);
  console.log(`Разница: ${timeWith - timeWithout}ms`);
}

// ============================================================
// Example 4: Streaming с Thinking Mode
// ============================================================
async function streamingWithThinking() {
  console.log("\n" + "=".repeat(60));
  console.log("Example 4: Streaming с Thinking Mode");
  console.log("=".repeat(60));

  const client = new GeminiClient({
    apiKeys: [API_KEY],
    defaultModel: "gemini-2.5-flash"
  });

  const chat = client.chats.create({
    model: "gemini-2.5-flash",
    generationConfig: {
      thinkingConfig: {
        mode: 'enabled',
        maxThinkingTokens: 800
      }
    }
  });

  console.log("\nЗадача: Написать алгоритм сортировки");
  console.log("User: Напиши оптимальный алгоритм быстрой сортировки с объяснением\n");
  console.log("AI Response (streaming):");

  const stream = chat.sendMessageStream(
    'Напиши оптимальный алгоритм быстрой сортировки с объяснением'
  );

  for await (const chunk of stream) {
    const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) {
      process.stdout.write(text);
    }
  }

  console.log("\n");
}

// ============================================================
// Example 5: Динамическое управление Thinking Mode
// ============================================================
async function dynamicThinkingControl() {
  console.log("\n" + "=".repeat(60));
  console.log("Example 5: Динамическое управление Thinking Mode");
  console.log("=".repeat(60));

  const client = new GeminiClient({
    apiKeys: [API_KEY],
    defaultModel: "gemini-2.5-flash"
  });

  const chat = client.chats.create({
    model: "gemini-2.5-flash"
  });

  // Простой вопрос - без thinking
  console.log("\n1. Простой вопрос (thinking disabled):");
  console.log("User: Привет!\n");

  chat.setGenerationConfig({
    thinkingConfig: {
      mode: 'disabled'
    }
  });

  const r1 = await chat.sendMessage('Привет!');
  console.log("AI:", r1.text());

  // Сложный вопрос - включаем thinking
  console.log("\n2. Сложный вопрос (thinking enabled):");
  console.log("User: Объясни теорию относительности\n");

  chat.setGenerationConfig({
    thinkingConfig: {
      mode: 'enabled',
      maxThinkingTokens: 1000
    }
  });

  const r2 = await chat.sendMessage('Объясни теорию относительности');
  console.log("AI:", r2.text());
}

// ============================================================
// Run all examples
// ============================================================
async function runAllExamples() {
  try {
    await chatWithThinkingMode();
    await new Promise(resolve => setTimeout(resolve, 2000));

    await advancedThinkingMode();
    await new Promise(resolve => setTimeout(resolve, 2000));

    await comparisonExample();
    await new Promise(resolve => setTimeout(resolve, 2000));

    await streamingWithThinking();
    await new Promise(resolve => setTimeout(resolve, 2000));

    await dynamicThinkingControl();

    console.log("\n" + "=".repeat(60));
    console.log("Все примеры выполнены успешно!");
    console.log("=".repeat(60));
  } catch (error) {
    console.error("\nОшибка:", error.message);
    if (error.statusCode) {
      console.error("Status Code:", error.statusCode);
    }
  }
}

// Запустить все примеры или выбрать конкретный
runAllExamples();

// Раскомментируйте для запуска отдельных примеров:
// chatWithThinkingMode();
// advancedThinkingMode();
// comparisonExample();
// streamingWithThinking();
// dynamicThinkingControl();
