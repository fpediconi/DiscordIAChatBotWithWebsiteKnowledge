🚀 Discord AI Chat Bot
Un bot de Discord potenciado con IA para responder consultas de tu comunidad. Ideal para juegos de rol, servidores de soporte o cualquier proyecto donde quieras integrar conocimiento estructurado y respuestas generadas dinámicamente.
Se le puede configurar multiples consumos mediante los providers.

📋 Características principales
Conocimiento híbrido: combina datos de una base de datos SQLite (wiki, lore en JSON, tablas, imágenes…) con llamadas a modelos de lenguaje (OpenRouter y Ollama).

Prompt dinámico: usa un PromptBuilder que arma mensajes sistemáticos según contexto (entrada de la DB, historia del juego)

Filtrado de canal: sólo responde en el canal configurado en DISCORD_CHANNEL_ID.

Gestión de stopwords y plurales: limpia consultas comunes (“qué”, “como”, “armaduras” → “armadura”) para mejorar la búsqueda en la DB.

Fragmentación de mensajes: si la respuesta supera el límite de Discord, se divide automáticamente.

Persistencia de historia: guarda contexto breve por usuario para conversaciones más coherentes.

Extensible: fácil de añadir nuevas fuentes de datos, modelos o reglas de negocio.

📄 Licencia
MIT © Francisco Pediconi