import { config } from '../config/config.js';
import axios from 'axios';

export class OpenRouterClient {
  constructor() {
    this.apiKey = config.openRouterKey;
    this.model = config.openRouterModel;
  }

  async getCompletion(prompt) {
    const startTime = Date.now();
    try {
      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: this.model,
          messages: [{ role: "user", content: prompt }],
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );
      const elapsed = Date.now() - startTime;
      console.log(`⏱️ OpenRouter response time: ${elapsed} ms`);
      return response.data.choices[0].message.content;
    } catch (error) {
      const elapsed = Date.now() - startTime;
      console.error(`⏱️ OpenRouter error after ${elapsed} ms:`, error.response?.data || error.message);
      return 'Lo siento, hubo un error al procesar tu solicitud.';
    }
  }
}
