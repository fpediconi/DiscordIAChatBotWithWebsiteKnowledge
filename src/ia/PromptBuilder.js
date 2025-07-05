export class PromptBuilder {
  /**
   * Genera un prompt estructurado en secciones claramente delimitadas
   * para maximizar la eficiencia y claridad de comprensión.
   */
  buildPrompt(userMessage, entry) {
    // Sección 1: Consulta del usuario
    const sectionQuery = [
      '### Consulta del usuario',
      `"${userMessage.trim()}"`
    ].join('\n');

    // Sección 2: Contexto (wiki o fallback)
    const sectionContext = entry
      ? [
          '### Contexto de la wiki',
          `**Título**: ${entry.titulo}`,
          `**Categoría**: ${entry.categoria}`,
          entry.contenido.trim(),
          `Fuente: ${entry.url}`
        ].join('\n')
      : [`### Contexto de la wiki`, 'No se encontró información. Recomienda visitar https://fsao.com.ar/wiki'].join('\n');

    // Sección 3: Instrucciones para el modelo
    const sectionInstructions = [
      '### Instrucciones para el modelo',
      '- Usa exclusivamente la información proporcionada en el contexto.',
      '- No inventes datos; si falta información, indícalo claramente.',
      '- Responde en español con acento rioplatense.',
      '- Sé claro, concreto y directo.',
      '- Omite saludos y despedidas.'
    ].join('\n');

    // Combinar secciones con un separador uniforme
    return [sectionQuery, sectionContext, sectionInstructions].join('\n\n---\n\n');
  }
}
