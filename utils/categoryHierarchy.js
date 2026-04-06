/**
 * Coerce a simple value (string, ObjectId) to string. Returns null if falsy.
 */
const normalizeId = (value) => {
  if (!value) return null;
  return String(value);
};

/**
 * Robustly extract a string ID from any shape:
 *   string | ObjectId | populated doc { _id } | BSON extended JSON { $oid }
 * Returns null if not extractable.
 *
 * NOTE: Mongoose/BSON ObjectId instances have a `_id` getter that returns
 * `this`, so we must detect them BEFORE accessing `_id` to avoid infinite
 * recursion.
 */
const normalizeEntityId = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    // Detect Mongoose/BSON ObjectId — they expose toHexString() or their
    // constructor name matches ObjectId. Convert directly, never via ._id.
    if (
      typeof value.toHexString === "function" ||
      (value.constructor && /ObjectI[dD]/.test(value.constructor.name))
    ) {
      return String(value);
    }
    // BSON extended JSON
    if (value.$oid) return String(value.$oid);
    // Populated Mongoose document with a nested _id
    if (value._id !== undefined) return normalizeEntityId(value._id);
  }
  return String(value);
};

/**
 * Mongoose filter that matches documents with status "show" or legacy
 * documents that have no status field at all.
 */
const VISIBLE_STATUS_FILTER = {
  $or: [{ status: "show" }, { status: { $exists: false } }],
};

const buildCategoryTree = (categories, parentId = null, _visited = new Set()) => {
  const normalizedParentId = normalizeId(parentId);

  return categories
    .filter((category) => {
      const currentParentId = normalizeId(category.parentId);

      if (!normalizedParentId) {
        return !currentParentId;
      }

      return currentParentId === normalizedParentId;
    })
    .filter((category) => {
      // Guard against circular parentId references (e.g. A→B→A) that would
      // cause infinite recursion. Skip any category whose _id is already an
      // ancestor in the current branch.
      const id = normalizeId(category._id);
      return id && !_visited.has(id);
    })
    .map((category) => {
      const id = normalizeId(category._id);
      const nextVisited = new Set(_visited);
      nextVisited.add(id);
      return {
        _id: category._id,
        name: category.name,
        parentId: category.parentId,
        parentName: category.parentName,
        description: category.description,
        slug: category.slug,
        icon: category.icon,
        status: category.status,
        children: buildCategoryTree(categories, category._id, nextVisited),
      };
    });
};

const findDescendantCategoryIds = (categories, categoryId) => {
  const normalizedCategoryId = normalizeId(categoryId);

  if (!normalizedCategoryId) {
    return [];
  }

  const discoveredIds = new Set([normalizedCategoryId]);
  const pendingIds = [normalizedCategoryId];

  while (pendingIds.length > 0) {
    const currentId = pendingIds.pop();

    for (const category of categories) {
      const parentId = normalizeId(category.parentId);
      const childId = normalizeId(category._id);

      if (parentId === currentId && childId && !discoveredIds.has(childId)) {
        discoveredIds.add(childId);
        pendingIds.push(childId);
      }
    }
  }

  return Array.from(discoveredIds);
};

module.exports = {
  normalizeId,
  normalizeEntityId,
  buildCategoryTree,
  findDescendantCategoryIds,
  VISIBLE_STATUS_FILTER,
};