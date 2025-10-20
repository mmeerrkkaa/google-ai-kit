const { GeminiClient } = require('../dist/index');
require('dotenv').config();

const client = new GeminiClient({
  apiKeys: [""],
  defaultModel: 'gemini-2.5-flash'
});

async function testCountTokens() {
  console.log('=== Тест 1: Простой текст (строка) ===');
  try {
    const result1 = await client.countTokens('The quick brown fox jumps over the lazy dog.');
    console.log('Результат:', result1);
    console.log('Количество токенов:', result1.totalTokens);
  } catch (error) {
    console.error('Ошибка:', error.message);
  }

  console.log('\n=== Тест 2: Content объект ===');
  try {
    const result2 = await client.countTokens({
      contents: [
        {
          role: 'user',
          parts: [{ text: 'Hello, how are you?' }]
        }
      ]
    });
    console.log('Результат:', result2);
    console.log('Количество токенов:', result2.totalTokens);
  } catch (error) {
    console.error('Ошибка:', error.message);
  }

  console.log('\n=== Тест 3: С указанием модели ===');
  try {
    const result3 = await client.countTokens('This is a test message.', 'gemini-2.5-pro');
    console.log('Результат:', result3);
    console.log('Количество токенов:', result3.totalTokens);
  } catch (error) {
    console.error('Ошибка:', error.message);
  }

  console.log('\n=== Тест 4: Длинный текст ===');
  try {
    const longText = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(50);
    const result4 = await client.countTokens(longText);
    console.log('Результат:', result4);
    console.log('Количество токенов:', result4.totalTokens);
  } catch (error) {
    console.error('Ошибка:', error.message);
  }

  console.log('\n=== Тест 5: Несколько сообщений ===');
  try {
    const result5 = await client.countTokens({
      contents: [
        { role: 'user', parts: [{ text: 'What is the weather today?' }] },
        { role: 'model', parts: [{ text: 'I don\'t have access to real-time information.' }] },
        { role: 'user', parts: [{ text: 'Okay, thanks!' }] }
      ]
    });
    console.log('Результат:', result5);
    console.log('Количество токенов:', result5.totalTokens);
    if (result5.promptTokensDetails) {
      console.log('Детали токенов по модальности:', result5.promptTokensDetails);
    }
  } catch (error) {
    console.error('Ошибка:', error.message);
  }
}

testCountTokens().catch(console.error);
