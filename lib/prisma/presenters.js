/**
 * Presentadores Prisma → forma de API heredada.
 *
 * El esquema de Postgres quedó normalizado (columnas planas, `id` UUID,
 * Decimal para dinero), pero la API pública debe seguir devolviendo exactamente
 * lo que ya consumen crokete-admin y crokete-store: `_id`, `prices` anidado y
 * números en vez de Decimal. Hay ~1.100 referencias a `_id` entre los dos
 * frontends, así que traducir aquí es mucho más barato y seguro que reescribir
 * ambos clientes.
 *
 * Regla: el modelo de datos se mantiene limpio; la compatibilidad vive en esta
 * frontera y sólo aquí.
 */

/** Prisma devuelve Decimal.js; sin esto el JSON saldría como string u objeto. */
function isDecimal(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof value.toNumber === "function" &&
    typeof value.toFixed === "function"
  );
}

/**
 * Normaliza recursivamente: Decimal → number y `id` → `_id` (se conservan
 * ambos, porque parte del código nuevo ya usa `id`).
 */
function toApi(value) {
  if (value === null || value === undefined) return value;
  if (isDecimal(value)) return value.toNumber();
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(toApi);
  if (typeof value !== "object") return value;

  const out = {};
  for (const [key, val] of Object.entries(value)) {
    out[key] = toApi(val);
  }
  if (out.id !== undefined && out._id === undefined) out._id = out.id;
  return out;
}

/** Number seguro para Decimal, string o number. */
function num(value, fallback = 0) {
  if (value === null || value === undefined) return fallback;
  if (isDecimal(value)) return value.toNumber();
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Una relación incluida se devuelve como objeto (como hacía `populate`); si no
 * se incluyó, se devuelve el id suelto, igual que Mongoose sin populate.
 */
function relation(entity, fallbackId) {
  if (entity) return toApi(entity);
  return fallbackId || undefined;
}

/**
 * Producto → forma heredada. Reconstruye las estructuras anidadas que el
 * esquema aplanó (`prices`, `petCompatibility`, `packageInfo`) y restituye los
 * nombres en snake_case que el front espera.
 */
function productToApi(p) {
  if (!p) return p;

  const categories = p.categories
    ? p.categories.map((pc) => (pc.category ? toApi(pc.category) : pc.categoryId))
    : undefined;

  return {
    ...toApi({
      id: p.id,
      sku: p.sku,
      barcode: p.barcode,
      title: p.title,
      description: p.description,
      slug: p.slug,
      image: p.image,
      tag: p.tag,
      stock: p.stock,
      sales: p.sales,
      isCombination: p.isCombination,
      status: p.status,
      productType: p.productType,
      quickInfo: p.quickInfo,
      benefits: p.benefits,
      features: p.features,
      ingredients: p.ingredients,
      feedingGuide: p.feedingGuide,
      indications: p.indications,
      warnings: p.warnings,
      dosage: p.dosage,
      recommendedFor: p.recommendedFor,
      brandInfo: p.brandInfo,
      nutritionTable: p.nutritionTable,
      technicalSpecs: p.technicalSpecs,
      consumptionGuide: p.consumptionGuide,
      keyFacts: p.keyFacts,
      productHighlights: p.productHighlights,
      visualTags: p.visualTags,
      iconTags: p.iconTags,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }),

    // `productId` era el código interno editable; en Postgres es `refCode`.
    productId: p.refCode || "",

    prices: {
      originalPrice: num(p.originalPrice),
      price: num(p.price),
      discount: num(p.discount),
    },

    average_rating: num(p.averageRating),
    total_reviews: p.totalReviews ?? 0,

    category: relation(p.category, p.categoryId),
    categories: categories ?? [],
    pet: relation(p.pet, p.petId),
    brand: relation(p.brand, p.brandId),

    petCompatibility: {
      petType: p.petCompatPetType || [],
      ageRange: p.petCompatAgeRange || [],
      size: p.petCompatSize || [],
      breed: p.petCompatBreed || [],
      specialNeeds: p.petCompatSpecialNeeds || [],
    },

    packageInfo: {
      weight: p.packageWeight != null ? num(p.packageWeight) : undefined,
      unit: p.packageUnit || undefined,
      servings: p.packageServings ?? undefined,
    },

    variants: (p.variants || []).map(variantToApi),
  };
}

/**
 * Variante → forma heredada: un objeto plano donde las claves dinámicas son
 * `<attributeId>: <attributeValueId>` junto a los campos fijos.
 */
function variantToApi(v) {
  if (!v) return v;
  return {
    ...(v.attributes || {}),
    _id: v.id,
    id: v.id,
    productId: v.refCode || "",
    sku: v.sku || "",
    barcode: v.barcode || "",
    image: v.image || "",
    originalPrice: num(v.originalPrice),
    price: num(v.price),
    discount: num(v.discount),
    quantity: v.quantity ?? 0,
  };
}

/** Atributo → forma heredada (`variants` en vez de `values`). */
function attributeToApi(a) {
  if (!a) return a;
  const { values, ...rest } = a;
  return {
    ...toApi(rest),
    variants: (values || []).map((v) => toApi(v)),
  };
}

/** Pedido → forma heredada (`cart`, `user`, `user_info`). */
function orderToApi(o) {
  if (!o) return o;
  const { items, customer, userInfo, customerId, ...rest } = o;
  return {
    ...toApi(rest),
    user: relation(customer, customerId),
    user_info: userInfo,
    cart: (items || []).map(orderItemToApi),
  };
}

/**
 * Ítem de pedido → forma heredada. El carrito de Mongo guardaba el documento
 * completo del producto por línea; `snapshot` conserva ese payload, así que se
 * devuelve como base y se le superponen los valores ya normalizados.
 *
 * Sólo se superponen los campos que también son columna. `image` y `productId`
 * se dejan tal como los envió la tienda: `image` viaja como string en el
 * carrito y `productId` es el código interno del producto (refCode), no el
 * uuid — pisarlos con la forma de la base rompería la factura y el detalle del
 * pedido, que son los consumidores de este payload.
 */
function orderItemToApi(i) {
  if (!i) return i;
  const snapshot = i.snapshot || {};
  return {
    ...snapshot,
    _id: i.id,
    id: i.id,
    title: i.title,
    image: snapshot.image !== undefined ? snapshot.image : i.image,
    sku: i.sku || snapshot.sku || "",
    price: num(i.price),
    quantity: i.quantity,
    itemTotal: num(i.itemTotal),
  };
}

/** Cliente → forma heredada (agregados de lealtad re-anidados). */
function customerToApi(c) {
  if (!c) return c;
  const {
    loyaltyPoints, loyaltyTotalPoints, loyaltyTotalSpent,
    loyaltyOrderCount, loyaltyTier, loyaltyJoinedAt, ...rest
  } = c;

  return {
    ...toApi(rest),
    loyalty: {
      points: loyaltyPoints ?? 0,
      totalPoints: loyaltyTotalPoints ?? 0,
      totalSpent: num(loyaltyTotalSpent),
      orderCount: loyaltyOrderCount ?? 0,
      tier: loyaltyTier || "nuevo",
      joinedAt: loyaltyJoinedAt,
    },
  };
}

/**
 * Configuración de lealtad → forma heredada. Los dos umbrales de nivel eran un
 * subdocumento `tierThresholds` y en Postgres son dos columnas; la tienda lee
 * `config.tierThresholds[nivel]`, así que se recompone aquí.
 */
function loyaltyConfigToApi(c) {
  if (!c) return c;
  const { tierThresholdFrecuente, tierThresholdVip, ...rest } = c;
  return {
    ...toApi(rest),
    tierThresholds: {
      frecuente: tierThresholdFrecuente ?? 3,
      vip: tierThresholdVip ?? 10,
    },
  };
}

/**
 * Configuración veterinaria → forma heredada. `workingHours` era un
 * subdocumento y ahora son dos columnas; la tienda y el panel siguen leyendo
 * `config.workingHours.start/end`.
 */
function vetConfigToApi(c) {
  if (!c) return c;
  const { workingHoursStart, workingHoursEnd, ...rest } = c;
  return {
    ...toApi(rest),
    workingHours: {
      start: workingHoursStart || "09:00",
      end: workingHoursEnd || "18:00",
    },
  };
}

/**
 * Cita veterinaria → forma heredada. Los nombres de relación coinciden con los
 * de Mongo (`customer`, `veterinarian`, `customerPet`); sólo el cliente
 * necesita traducción, porque sus agregados de lealtad van anidados.
 */
function vetAppointmentToApi(a) {
  if (!a) return a;
  const { customer, ...rest } = a;
  return {
    ...toApi(rest),
    ...(customer ? { customer: customerToApi(customer) } : {}),
  };
}

/** Reseña → forma heredada (`user` y `product`, poblados o como id suelto). */
function reviewToApi(r) {
  if (!r) return r;
  const { customer, customerId, product, productId, ...rest } = r;
  return {
    ...toApi(rest),
    user: relation(customer, customerId),
    // El panel sólo pinta la miniatura del producto: se devuelve la selección
    // tal cual, sin reconstruir la ficha completa.
    product: relation(product, productId),
  };
}

/**
 * Los roles viajan con espacio en la API ("super admin", "security guard"),
 * pero un enum de Postgres no admite espacios. La traducción vive aquí para
 * que el panel siga enviando y recibiendo exactamente los mismos valores.
 */
function roleToApi(role) {
  return role ? String(role).replace(/_/g, " ") : role;
}

function roleToDb(role) {
  return role ? String(role).trim().toLowerCase().replace(/\s+/g, "_") : role;
}

/**
 * Admin → forma heredada (`access_list`, rol con espacio, sin contraseña).
 * El modelo de Mongo llamaba `joiningData` a la fecha de alta (errata) mientras
 * que la API recibe `joiningDate`; se exponen ambas para no romper al panel.
 */
function adminToApi(a) {
  if (!a) return a;
  const { accessList, password, role, joiningDate, ...rest } = a;
  return {
    ...toApi(rest),
    role: roleToApi(role),
    access_list: accessList || [],
    joiningDate,
    joiningData: joiningDate,
  };
}

/** Moneda → forma heredada (`live_exchange_rates`). */
function currencyToApi(c) {
  if (!c) return c;
  const { liveExchangeRates, ...rest } = c;
  return { ...toApi(rest), live_exchange_rates: liveExchangeRates };
}

module.exports = {
  toApi,
  num,
  isDecimal,
  productToApi,
  variantToApi,
  attributeToApi,
  orderToApi,
  orderItemToApi,
  customerToApi,
  loyaltyConfigToApi,
  vetConfigToApi,
  vetAppointmentToApi,
  reviewToApi,
  adminToApi,
  roleToApi,
  roleToDb,
  currencyToApi,
};
