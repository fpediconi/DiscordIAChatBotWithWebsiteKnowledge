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
      "Solo si se proporciona un link a la fuente integrala en el mensaje.",
      ""
    ].join("\n");

    // 2. Contexto: agrupar por fuente
    const bySource = fragments.reduce((acc, f) => {
      const key = f.metadata.source;
      if (!acc[key]) acc[key] = [];
      acc[key].push({
        text: f.text.trim(),
        url: f.metadata.url || null
      });
      return acc;
    }, {});

    // Mapeo de nombres 
    const sectionTitles = {
      wiki: "Wiki",
      offgame: "Off-game (lore/staff)",
      events: "Eventos recientes",
      stats: "Estadísticas",
      
    };

    // Generar dinámicamente cada bloque de contexto
    const contextSections = Object.entries(bySource).map(([source, items]) => {
      // Título amigable o fallback al nombre del source
      const title = sectionTitles[source] 
        || source.charAt(0).toUpperCase() + source.slice(1);

      // Cada línea con texto y URL opcional
      const lines = items.map(item =>
        item.url
          ? `• ${item.text}\n  URL: ${item.url}`
          : `• ${item.text}`
      );

      return `=== ${title} ===\n${lines.join("\n")}`;
    });

    const context = ["[CONTEXT]", ...contextSections, ""].join("\n");

    // 3. Consulta del usuario
    const user = [
      "[USER INFO]",
      `Nombre: ${userName}`,
      `Mensaje: ${userQuery.trim()}`
    ].join("\n");

    // Ensamblar prompt completo
    return [system, context, user].join("\n");
  }
}
