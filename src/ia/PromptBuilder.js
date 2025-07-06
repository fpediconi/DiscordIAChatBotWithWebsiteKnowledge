// src/ia/PromptBuilder.js
export class PromptBuilder {
  /**
   * Genera un prompt RAG con secciones dinámicas según los fragments recibidos.
   * @param {string} userQuery
   * @param {Array<{ text: string, score: number, metadata: { source: string } }>} fragments
   */
  buildPrompt(userQuery, fragments) {
    // 1. Instrucciones al sistema
    const system = [
      "[SYSTEM]",
      "Eres Furia, el asistente de FuriusAO en Discord.",
      "Usa únicamente la información provista en CONTEXT; no inventes datos.",
      "Si no hay suficiente información, indícalo claramente.",
      ""
    ].join("\n");

    // 2. Contexto: agrupar por fuente y renderizar solo las secciones presentes
    const bySource = fragments.reduce((acc, f) => {
      acc[f.metadata.source] = acc[f.metadata.source] || [];
      acc[f.metadata.source].push(f.text);
      return acc;
    }, {});

    const contextSections = [];
    if (bySource.wiki) {
      contextSections.push(
        "=== Wiki ===\n" +
        bySource.wiki.map(t => `• ${t}`).join("\n")
      );
    }
    if (bySource.offgame) {
      contextSections.push(
        "=== Off-game (lore/staff) ===\n" +
        bySource.offgame.map(t => `• ${t}`).join("\n")
      );
    }
    if (bySource.events) {
      contextSections.push(
        "=== Eventos recientes ===\n" +
        bySource.events.map(t => `• ${t}`).join("\n")
      );
    }
    const context = ["[CONTEXT]", ...contextSections, ""].join("\n");

    // 3. Consulta del usuario
    const user = `[USER MESSAGE]\n${userQuery.trim()}`;

    // Ensamblar prompt
    return [system, context, user].join("\n");
  }
}
