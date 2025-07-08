// src/ia/PromptBuilder.js
export class PromptBuilder {
  /**
   * Genera un prompt RAG con secciones dinámicas según los fragments recibidos.
   * Ahora incluye en cada sección la URL de origen de la información.
   * @param {string} userQuery
   * @param {Array<{ text: string, score: number, metadata: { source: string, url?: string } }>} fragments
   * @param {string} userName
   */
  buildPrompt(userQuery, fragments, userName) {
    // 1. Instrucciones al sistema
    const system = [
      "[SYSTEM]",
      "Eres Furia, el asistente de FuriusAO en chat de Discord.",
      "Usa únicamente la información provista en CONTEXT; no inventes datos.",
      "No converses con el usuario ni salgas del rol, tu tarea es responder preguntas y nada más.",
      "Si se proporciona un link a la fuente integrala en el mensaje.",
      ""
    ].join("\n");

    // 2. Contexto: agrupar por fuente y renderizar solo las secciones presentes
    const bySource = fragments.reduce((acc, f) => {
      acc[f.metadata.source] = acc[f.metadata.source] || [];
      acc[f.metadata.source].push({
        text: f.text.trim(),
        url: f.metadata.url || null
      });
      return acc;
    }, {});

    const contextSections = [];

    if (bySource.wiki) {
      contextSections.push(
        "=== Wiki ===\n" +
        bySource.wiki
          .map(item => {
            if (item.url) {
              return `• ${item.text}\n  URL: ${item.url}`;
            }
            return `• ${item.text}`;
          })
          .join("\n")
      );
    }
    if (bySource.offgame) {
      contextSections.push(
        "=== Off-game (lore/staff) ===\n" +
        bySource.offgame
          .map(item => {
            if (item.url) {
              return `• ${item.text}\n  URL: ${item.url}`;
            }
            return `• ${item.text}`;
          })
          .join("\n")
      );
    }
    if (bySource.events) {
      contextSections.push(
        "=== Eventos recientes ===\n" +
        bySource.events
          .map(item => {
            if (item.url) {
              return `• ${item.text}\n  URL: ${item.url}`;
            }
            return `• ${item.text}`;
          })
          .join("\n")
      );
    }

    const context = ["[CONTEXT]", ...contextSections, ""].join("\n");

    // 3. Consulta del usuario
    const user = [
      "[USER INFO]",
      `Nombre: ${userName}`,
      `Mensaje: ${userQuery.trim()}`
    ].join("\n");

    // Ensamblar prompt
    return [system, context, user].join("\n");
  }
}
