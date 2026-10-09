/**
 * Set curado de emojis para el compositor de WhatsApp — a propósito sin una
 * librería de picker completa (base Unicode + búsqueda + tonos de piel):
 * esto es para darle color a una conversación de atención al cliente, no un
 * editor de emojis; un grid chico y fijo alcanza y pesa cero KB extra.
 */
export const EMOJI_LIST: string[] = [
  "😀", "😂", "🙂", "😉", "😍", "🥳", "😢", "😡", "😮", "🤔",
  "👍", "👎", "🙏", "👋", "💪", "✌️",
  "❤️", "💙", "💚", "💛", "🧡", "💜",
  "🚗", "🔑", "📄", "💳", "💵", "📍", "📅", "🕐", "✅", "❌",
  "⚠️", "📞", "📧", "📷", "🎉", "🙌", "☀️", "🌧️", "🔥", "💯",
];
