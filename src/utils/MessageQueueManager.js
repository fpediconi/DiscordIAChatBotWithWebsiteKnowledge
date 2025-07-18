export class MessageQueueManager {
  /**
   * @param {Object} options
   * @param {function} options.onValidMessage
   * @param {number} [options.messagesPerUserPerMinute]
   * @param {number} [options.maxQueueLength]
   * @param {number} [options.cooldownMs]
   * @param {number} [options.banDurationMs] - tiempo de ban en ms (default 60s)
   */
  constructor({
    onValidMessage,
    messagesPerUserPerMinute = 5,
    maxQueueLength = 100,
    cooldownMs = 5000,
    banDurationMs = 60000 // 1 minuto por default
  }) {
    this.onValidMessage = onValidMessage;
    this.messagesPerUserPerMinute = messagesPerUserPerMinute;
    this.maxQueueLength = maxQueueLength;
    this.cooldownMs = cooldownMs;
    this.banDurationMs = banDurationMs;
    this.queue = [];
    this.userTimestamps = new Map();
    this.lastMessageTime = new Map();
    this.processing = false;
    this.spammerThreshold = 10;
    this.ignoredUsers = new Map(); // Cambia a Map para guardar el timestamp de ban
  }

  /** Agrega mensaje a la cola y dispara procesamiento */
  enqueue(message, senderId, userName, replyCallback, isEdit = false) {
    const now = Date.now();

    // Ban temporal: Si está baneado, revisá si ya cumplió el tiempo
    if (this.ignoredUsers.has(senderId)) {
      const banTime = this.ignoredUsers.get(senderId);
      if (now - banTime >= this.banDurationMs) {
        // Se cumple el tiempo de ban, desbanea
        this.ignoredUsers.delete(senderId);
        console.log(`[UNBAN] ${userName} (${senderId}) fue desbaneado automáticamente.`);
      } else {
        const waitSec = Math.ceil((this.banDurationMs - (now - banTime)) / 1000);
        if (replyCallback) replyCallback(`🚫 Has sido bloqueado por spam. Podrás escribir en ${waitSec} segundo${waitSec > 1 ? 's' : ''}.`);
        console.log(`[SPAM] Ignorado (baneado temporal) ${userName} (${senderId})`);
        return;
      }
    }

    // Filtro: mensaje editado (si no querés permitirlo)
    if (isEdit) {
      console.log(`[EDITADO] Ignorado mensaje editado de ${userName} (${senderId})`);
      return;
    }

    // Cooldown ANTIMASH por usuario
    const lastTime = this.lastMessageTime.get(senderId) || 0;
    if (now - lastTime < this.cooldownMs) {
      const waitSec = Math.ceil((this.cooldownMs - (now - lastTime)) / 1000);
      if (replyCallback) replyCallback(`⏳ Esperá ${waitSec} segundo${waitSec > 1 ? 's' : ''} antes de enviar otro mensaje.`);
      console.log(`[COOLDOWN] ${userName} (${senderId}) intentó enviar mensaje antes de los ${this.cooldownMs / 1000}s.`);
      return;
    }
    this.lastMessageTime.set(senderId, now);

    // Filtro: flood/spam (rate limit)
    let timestamps = this.userTimestamps.get(senderId) || [];
    timestamps = timestamps.filter(ts => now - ts < 60000); // últimos 60s
    if (timestamps.length >= this.spammerThreshold) {
      this.ignoredUsers.set(senderId, now); // ahora es un MAP, guardás el tiempo del ban
      if (replyCallback) replyCallback(`🚫 Has sido bloqueado por spam. Podrás escribir en 60 segundos.`);
      console.log(`[BANEADO x SPAM] ${userName} (${senderId})`);
      return;
    }
    if (timestamps.length >= this.messagesPerUserPerMinute) {
      if (replyCallback) replyCallback(`🚫 Solo se permiten ${this.messagesPerUserPerMinute} mensajes por minuto.`);
      console.log(`[RATE LIMIT] ${userName} (${senderId})`);
      return;
    }
    // Registrar timestamp del mensaje entrante ANTES de encolar
    timestamps.push(now);
    this.userTimestamps.set(senderId, timestamps);

    // Encolar
    if (this.queue.length >= this.maxQueueLength) {
      if (replyCallback) replyCallback(`⏳ Hay muchos mensajes pendientes, intentá de nuevo en unos segundos.`);
      console.log(`[COLA LLENA] Mensaje descartado de ${userName}`);
      return;
    }
    this.queue.push({ message, senderId, userName, replyCallback, isEdit });
    this._processQueue();
  }

  async _processQueue() {
    if (this.processing) return;
    this.processing = true;
    while (this.queue.length > 0) {
      const { message, senderId, userName, replyCallback, isEdit } = this.queue.shift();
      try {
        await this.onValidMessage(message, senderId, userName, replyCallback, isEdit);
      } catch (err) {
        if (replyCallback) replyCallback('Ocurrió un error inesperado.');
        console.error('Error procesando mensaje:', err);
      }
      await new Promise(res => setTimeout(res, 1000));
    }

    this.processing = false;
  }
}
