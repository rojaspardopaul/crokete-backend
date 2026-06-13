/**
 * Read-side helpers ported from utils/escapeRegex.js and utils/categoryHierarchy.js.
 * Self-contained so the module has no dependency on the legacy JS tree.
 */

/** Escapes regex metacharacters in user input before using it in $regex. */
export function escapeRegex(str: unknown): string {
  if (typeof str !== "string") return "";
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const normalizeId = (value: unknown): string | null =>
  value ? String(value) : null;

/**
 * BFS over a flat category list to collect a category and all its descendants.
 * Used to filter products by a category subtree.
 */
export function findDescendantCategoryIds(
  categories: { _id: unknown; parentId?: unknown }[],
  categoryId: unknown
): string[] {
  const root = normalizeId(categoryId);
  if (!root) return [];

  const discovered = new Set<string>([root]);
  const pending = [root];

  while (pending.length > 0) {
    const current = pending.pop();
    for (const c of categories) {
      const parentId = normalizeId(c.parentId);
      const childId = normalizeId(c._id);
      if (parentId === current && childId && !discovered.has(childId)) {
        discovered.add(childId);
        pending.push(childId);
      }
    }
  }
  return Array.from(discovered);
}

/**
 * Locale codes searched in multi-language title/description fields. Crokete
 * ships es/en; the SaaS injects the tenant's configured locales. Kept small on
 * purpose — the legacy 130-entry ISO list was almost entirely unused.
 */
export const SEARCHABLE_LOCALES = [
  "es", "en", "fr", "de", "pt", "it", "zh", "ar", "ru", "ja",
];
