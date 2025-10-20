const { GeminiClient, SchemaType } = require('../dist/index');
require('dotenv').config();

async function runOrderExchangeBot() {
    const apiKey = process.env.GOOGLE_API_KEYS || "YOUR_API_KEY";
    if (apiKey === "YOUR_API_KEY") {
        console.error("Пожалуйста, укажите ваш GOOGLE_API_KEY в .env файле или напрямую в коде.");
        return;
    }

    const client = new GeminiClient({
        apiKeys: [apiKey],
        defaultModel: "gemini-2.5-flash",
        debugMode: false
    });

    const availableSkills = ['python', 'javascript', 'react', 'sql'];

    // 1. Определяем схему для одного заказа
    const taskSchema = {
        type: SchemaType.OBJECT,
        properties: {
            'Название': { type: SchemaType.STRING, description: "Краткое и ясное название задачи" },
            'Описание': { type: SchemaType.STRING, description: "Подробное описание задачи" },
            'Сложность': { type: SchemaType.STRING, description: "Оценка сложности: Легкая, Средняя, Сложная" },
            'Навыки': {
                type: SchemaType.ARRAY,
                items: { type: SchemaType.STRING },
                description: "Список требуемых навыков из предложенного списка"
            },
            'Фио/Компания заказчика': { type: SchemaType.STRING, description: "Вымышленное имя или компания заказчика" },
            'Цена': { type: SchemaType.NUMBER, description: "Вознаграждение за выполнение в USD" },
            'Срок': { type: SchemaType.INTEGER, description: "Срок выполнения в днях (целое число от 1 до 10)" }
        },
        required: ["Название", "Описание", "Сложность", "Навыки", "Фио/Компания заказчика", "Цена", "Срок"]
    };

    const orderListSchema = {
        type: SchemaType.OBJECT,
        properties: {
            orders: {
                type: SchemaType.ARRAY,
                description: "Список сгенерированных заказов",
                items: taskSchema
            }
        },
        required: ["orders"]
    };


    const systemInstructionText = `Ты — бот, имитирующий IT-биржу заказов.
Твоя задача — сгенерировать список из 5-7 вымышленных заказов.
Используй только следующие навыки: ${availableSkills.join(', ')}.
Срок выполнения для каждого заказа должен быть целым числом от 1 до 10.
Ты ДОЛЖЕН предоставить ответ СТРОГО в формате JSON, который соответствует предоставленной схеме. Не добавляй никакого текста, кроме самого JSON.`;

    const userRequest = "Сгенерируй, пожалуйста, новые заказы для биржи.";

    try {
        const response = await client.generateContent({
            prompt: userRequest,
            systemInstruction: {
                role: 'system',
                parts: [{ text: systemInstructionText }]
            },
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: orderListSchema,
                temperature: 0.8
            }
        });

        console.log("\n--- Результат (JSON) ---");
        const jsonData = response.json();
        console.log(JSON.stringify(jsonData, null, 2));

    } catch (error) {
        console.error("Произошла ошибка при вызове API:", error);
    }
}

runOrderExchangeBot().catch(console.error);