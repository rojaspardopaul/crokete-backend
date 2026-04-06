/**
 * Escapa metacaracteres de regex en strings de usuario
 * para prevenir inyección de regex en queries MongoDB $regex.
 *
 * Uso: { $regex: escapeRegex(userInput), $options: "i" }
 */
const escapeRegex = (str) => {
  if (typeof str !== "string") return "";
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

module.exports = escapeRegex;
