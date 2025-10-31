const { GeminiClient, APIKeyExpiredError, APIKeyInvalidError, APIKeyError } = require('../dist/index');

/**
 * Демонстрация обработки ошибок API ключей
 *
 * Этот пример показывает:
 * 1. Автоматическое распознавание expired/invalid ключей
 * 2. Переключение на следующий валидный ключ
 * 3. Детальное логирование ошибок
 */

// ============================================================
// Пример 1: Обработка истекшего API ключа
// ============================================================
async function expiredKeyExample() {
  console.log("\n" + "=".repeat(60));
  console.log("Пример 1: Обработка истекшего API ключа");
  console.log("=".repeat(60));

  // Симуляция: первый ключ истёк, второй валидный
  const client = new GeminiClient({
    apiKeys: [
      'EXPIRED_KEY_XXXXXXXXX',           // Истекший ключ
      process.env.GEMINI_API_KEY         // Валидный ключ
    ],
    debugMode: true
  });

  try {
    console.log("\nПопытка использовать истекший ключ...\n");

    const response = await client.generateContent({
      prompt: 'Привет!'
    });

    console.log("\n✅ Успешно получен ответ после переключения ключа:");
    console.log(response.text());

  } catch (error) {
    if (error instanceof APIKeyExpiredError) {
      console.error("\n❌ Все ключи истекли!");
      console.error("Сообщение:", error.message);
    } else {
      console.error("\n❌ Ошибка:", error.message);
    }
  }
}

// ============================================================
// Пример 2: Обработка невалидного API ключа
// ============================================================
async function invalidKeyExample() {
  console.log("\n" + "=".repeat(60));
  console.log("Пример 2: Обработка невалидного API ключа");
  console.log("=".repeat(60));

  // Симуляция: первый ключ невалиден, второй валидный
  const client = new GeminiClient({
    apiKeys: [
      'INVALID_KEY_XXXXXXXXX',           // Невалидный ключ
      process.env.GEMINI_API_KEY         // Валидный ключ
    ],
    debugMode: true
  });

  try {
    console.log("\nПопытка использовать невалидный ключ...\n");

    const response = await client.generateContent({
      prompt: 'Тест'
    });

    console.log("\n✅ Успешно получен ответ после переключения ключа:");
    console.log(response.text());

  } catch (error) {
    if (error instanceof APIKeyInvalidError) {
      console.error("\n❌ Все ключи невалидны!");
      console.error("Сообщение:", error.message);
    } else {
      console.error("\n❌ Ошибка:", error.message);
    }
  }
}

// ============================================================
// Пример 3: Множественные невалидные ключи
// ============================================================
async function multipleInvalidKeysExample() {
  console.log("\n" + "=".repeat(60));
  console.log("Пример 3: Множественные невалидные ключи");
  console.log("=".repeat(60));

  // Все ключи невалидны
  const client = new GeminiClient({
    apiKeys: [
      'INVALID_KEY_1',
      'EXPIRED_KEY_2',
      'INVALID_KEY_3'
    ],
    debugMode: true
  });

  try {
    console.log("\nПопытка использовать только невалидные ключи...\n");

    await client.generateContent({
      prompt: 'Привет'
    });

  } catch (error) {
    console.error("\n❌ Все API ключи исчерпаны!");
    console.error("Тип ошибки:", error.constructor.name);
    console.error("Сообщение:", error.message);

    if (error.details) {
      console.error("\nДетали ошибки:");
      console.error(JSON.stringify(error.details, null, 2));
    }
  }
}

// ============================================================
// Пример 4: Chat API с автоматическим переключением ключей
// ============================================================
async function chatApiKeyHandling() {
  console.log("\n" + "=".repeat(60));
  console.log("Пример 4: Chat API с обработкой ключей");
  console.log("=".repeat(60));

  const client = new GeminiClient({
    apiKeys: [
      'EXPIRED_KEY',
      process.env.GEMINI_API_KEY
    ],
    debugMode: false  // Отключаем debug для более чистого вывода
  });

  try {
    const chat = client.chats.create({
      model: 'gemini-2.5-flash'
    });

    console.log("\nОтправка сообщения (первый ключ истёк)...");
    const response = await chat.sendMessage('Привет!');

    console.log("\n✅ Ответ получен после автоматического переключения:");
    console.log(response.text());

  } catch (error) {
    console.error("\n❌ Ошибка:", error.message);
  }
}

// ============================================================
// Пример 5: Правильная обработка в приложении
// ============================================================
async function properErrorHandling() {
  console.log("\n" + "=".repeat(60));
  console.log("Пример 5: Правильная обработка ошибок");
  console.log("=".repeat(60));

  const client = new GeminiClient({
    apiKeys: [process.env.GEMINI_API_KEY || 'INVALID_KEY'],
    debugMode: true
  });

  try {
    const response = await client.generateContent({
      prompt: 'Тест'
    });

    console.log("\n✅ Успешный ответ:");
    console.log(response.text());

  } catch (error) {
    // Специфичная обработка разных типов ошибок
    if (error instanceof APIKeyExpiredError) {
      console.error("\n⚠️  API ключ истёк!");
      console.error("Действие: Обновите API ключ в настройках");
      console.error("Детали:", error.message);

      // Здесь можно отправить уведомление админу
      // notifyAdmin('API key expired', error.details);

    } else if (error instanceof APIKeyInvalidError) {
      console.error("\n⚠️  API ключ невалиден!");
      console.error("Действие: Проверьте правильность API ключа");
      console.error("Детали:", error.message);

      // Логирование для отладки
      // logger.error('Invalid API key', { error: error.details });

    } else if (error instanceof APIKeyError) {
      console.error("\n⚠️  Проблема с API ключом!");
      console.error("Детали:", error.message);

    } else {
      console.error("\n❌ Общая ошибка:");
      console.error(error.message);
    }

    // Можно вернуть fallback ответ пользователю
    return {
      success: false,
      error: error.message,
      fallbackMessage: "Извините, сервис временно недоступен. Попробуйте позже."
    };
  }
}

// ============================================================
// Запуск примеров
// ============================================================
async function runExamples() {
  console.log("\n");
  console.log("╔" + "═".repeat(58) + "╗");
  console.log("║" + " ".repeat(10) + "ОБРАБОТКА ОШИБОК API КЛЮЧЕЙ" + " ".repeat(20) + "║");
  console.log("╚" + "═".repeat(58) + "╝");

  try {
    // Раскомментируйте нужные примеры:

    // await expiredKeyExample();
    // await new Promise(resolve => setTimeout(resolve, 1000));

    // await invalidKeyExample();
    // await new Promise(resolve => setTimeout(resolve, 1000));

    // await multipleInvalidKeysExample();
    // await new Promise(resolve => setTimeout(resolve, 1000));

    // await chatApiKeyHandling();
    // await new Promise(resolve => setTimeout(resolve, 1000));

    await properErrorHandling();

    console.log("\n" + "=".repeat(60));
    console.log("Примеры завершены");
    console.log("=".repeat(60) + "\n");

  } catch (error) {
    console.error("\nКритическая ошибка:", error);
  }
}

runExamples();

// Для тестирования с конкретными ключами:
// node apiKeyErrorHandling.js
