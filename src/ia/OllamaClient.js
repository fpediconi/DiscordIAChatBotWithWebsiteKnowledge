import { config } from '../config/config.js';
import axios from 'axios';

export class OllamaClient {
  constructor() {
    this.baseUrl = config.ollamaUrl || 'http://localhost:11434';
    this.model = config.ollamaModel || 'llama3';
    this.temperature = config.ollamaTemperature ?? 0.35; // bajo para evitar inventos
    this.top_p = config.ollamaTopP ?? 0.9;
    this.max_tokens = config.ollamaMaxTokens ?? 300;
  }

  /**
   * Consulta a Ollama local con parámetros ideales para bot de soporte.
   * @param {string} prompt - Prompt generado por PromptBuilder.js
   * @returns {Promise<string>}
   */
  async getCompletion(prompt) {
    const startTime = Date.now();
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/generate`,
        {
          model: this.model,
          prompt: prompt,
          stream: false,
          temperature: this.temperature,
          top_p: this.top_p,
          max_tokens: this.max_tokens,
        },
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
      const elapsed = Date.now() - startTime;
      console.log(`⏱️ Ollama response time: ${elapsed} ms`);
      return response.data.response;
    } catch (error) {
      const elapsed = Date.now() - startTime;
      console.error(`⏱️ Ollama error after ${elapsed} ms:`, error.response?.data || error.message);
      return 'Lo siento, hubo un error al procesar tu solicitud localmente.';
    }
  }
}
