/**
 * ETL de corte único: MongoDB Atlas → Supabase PostgreSQL.
 *
 * Migra el catálogo y la configuración reales. NO migra datos transaccionales
 * de prueba (pedidos, clientes y todo lo que cuelga de ellos): en el momento del
 * corte no existían clientes reales, sólo cuentas del equipo, así que arrancar
 * limpio evita heredar estados inválidos — la colección `orders` mezclaba
 * valores viejos (`delivered`, `pendiente`, `procesando`) con el enum vigente,
 * algo que el enum nativo de Postgres ya no permite.
 *
 * Las imágenes se copian de Cloudinary a Supabase Storage sobre la marcha y las
 * URLs se reescriben en el destino, de forma que Postgres nunca queda apuntando
 * a Cloudinary.
 *
 * Es idempotente: vacía las tablas destino antes de insertar, así que puede
 * re-ejecutarse durante la preparación del corte.
 *
 * Uso:
 *   node scripts/migrate-mongo-to-postgres.js [--dry-run] [--skip-images]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { getPrisma, disconnectPrisma } = require("../lib/prisma");
const { uploadImage } = require("../lib/storage/uploader");

const DRY_RUN = process.argv.includes("--dry-run");
const SKIP_IMAGES = process.argv.includes("--skip-images");

const prisma = DRY_RUN ? null : getPrisma();

// ─── Utilidades ──────────────────────────────────────────────────────────────

const log = (...args) => console.log(...args);

/** Los precios llegaban como número o como string ("120.00") según la antigüedad del registro. */
function toDecimal(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const n = typeof value === "number" ? value : parseFloat(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : fallback;
}

function toInt(value, fallback = 0) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

/** Normaliza a las claves del enum de Prisma (que no admiten espacios). */
function toEnum(value, allowed, fallback) {
  if (value === null || value === undefined) return fallback;
  const key = String(value).trim().toLowerCase().replace(/[\s-]+/g, "_");
  return allowed.includes(key) ? key : fallback;
}

/** Conserva sólo los valores del enum conocidos y descarta el resto. */
function filterEnums(values, allowed) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((v) => String(v).trim().toLowerCase().replace(/[\s-]+/g, "_")))].filter(
    (v) => allowed.includes(v)
  );
}

const VISIBILITY = ["show", "hide"];
const ACTIVE = ["active", "inactive"];

// ─── Migración de imágenes ───────────────────────────────────────────────────

const imageCache = new Map();
const imageStats = { migrated: 0, reused: 0, failed: 0, skipped: 0 };

/**
 * Copia una imagen externa al bucket y devuelve la URL nueva. Ante un fallo de
 * descarga conserva la URL original: perder el vínculo a la imagen sería peor
 * que seguir sirviéndola desde el origen anterior.
 */
async function migrateImage(url, folder, square = true) {
  if (!url || typeof url !== "string" || !/^https?:\/\//i.test(url)) return url;
  if (url.includes("supabase.co")) return url;
  if (SKIP_IMAGES) {
    imageStats.skipped++;
    return url;
  }
  if (imageCache.has(url)) {
    imageStats.reused++;
    return imageCache.get(url);
  }

  try {
    const isSvg = /\.svg(\?|$)/i.test(url);
    const newUrl = await uploadImage(url, { folder, square, isSvg });
    imageCache.set(url, newUrl);
    imageStats.migrated++;
    return newUrl;
  } catch (err) {
    imageStats.failed++;
    log(`   ⚠️  imagen no migrada (${err.message}): ${url.slice(0, 80)}`);
    return url;
  }
}

/** Reescribe recursivamente toda URL de imagen dentro de un objeto de settings. */
async function migrateImagesDeep(value, folder) {
  if (typeof value === "string") {
    return /^https?:\/\/.*\.(jpe?g|png|webp|svg|gif)(\?|$)/i.test(value)
      ? migrateImage(value, folder, false)
      : value;
  }
  if (Array.isArray(value)) {
    const out = [];
    for (const item of value) out.push(await migrateImagesDeep(item, folder));
    return out;
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = await migrateImagesDeep(v, folder);
    return out;
  }
  return value;
}

// ─── ETL ─────────────────────────────────────────────────────────────────────

async function main() {
  log(DRY_RUN ? "🔍 DRY RUN — no se escribe nada\n" : "🚀 Migración Mongo → Postgres\n");

  await mongoose.connect(process.env.MONGO_URI);
  const mongo = mongoose.connection.db;
  log("✅ Conectado a MongoDB Atlas");

  const read = (col) => mongo.collection(col).find({}).toArray();

  const [
    mCategories, mBrands, mPets, mProducts, mAttributes,
    mCoupons, mCurrencies, mLanguages, mSettings, mAdmins,
    mLoyaltyConfigs, mVetConfigs, mVeterinarians,
  ] = await Promise.all([
    read("categories"), read("brands"), read("pets"), read("products"), read("attributes"),
    read("coupons"), read("currencies"), read("languages"), read("settings"), read("admins"),
    read("loyaltyconfigs"), read("vetconfigs"), read("veterinarians"),
  ]);

  // ── Selección de categorías reales ──
  // 21 de las 25 son restos de la plantilla de abarrotes (Tuna, Apple, Bath…):
  // ningún producto las referencia y su parentId apunta a documentos que ya no
  // existen. Se conservan las usadas por productos y sus ancestros.
  const catById = new Map(mCategories.map((c) => [String(c._id), c]));
  const keepCats = new Set();
  for (const p of mProducts) {
    const ids = [p.category, ...(p.categories || [])].filter(Boolean).map(String);
    for (const id of ids) {
      let cur = catById.get(id);
      while (cur && !keepCats.has(String(cur._id))) {
        keepCats.add(String(cur._id));
        cur = cur.parentId ? catById.get(String(cur.parentId)) : null;
      }
    }
  }
  const categories = mCategories.filter((c) => keepCats.has(String(c._id)));

  log(`\n📊 A migrar:`);
  log(`   categorías ${categories.length}/${mCategories.length} (se descartan ${mCategories.length - categories.length} de la plantilla demo)`);
  log(`   marcas ${mBrands.length} · mascotas ${mPets.length} · productos ${mProducts.length}`);
  log(`   atributos ${mAttributes.length} · cupones ${mCoupons.length} · monedas ${mCurrencies.length} · idiomas ${mLanguages.length}`);
  log(`   settings ${mSettings.length} · admins ${mAdmins.length} · vets ${mVeterinarians.length}`);
  log(`   ❌ excluidos: pedidos, clientes, reseñas, mascotas de cliente, puntos, recompensas, citas, notificaciones, logs\n`);

  if (DRY_RUN) {
    await mongoose.disconnect();
    return;
  }

  // ── Limpieza del destino (orden inverso a las FK) ──
  log("🧹 Vaciando tablas destino…");
  await prisma.$transaction([
    prisma.auditLog.deleteMany(), prisma.loginAttempt.deleteMany(),
    prisma.paymentLog.deleteMany(), prisma.notification.deleteMany(),
    prisma.pointTransaction.deleteMany(), prisma.loyaltyReward.deleteMany(),
    prisma.orderItem.deleteMany(), prisma.order.deleteMany(),
    prisma.vetAppointment.deleteMany(), prisma.customerPet.deleteMany(),
    prisma.review.deleteMany(), prisma.customer.deleteMany(),
    prisma.productCategory.deleteMany(), prisma.productVariant.deleteMany(),
    prisma.product.deleteMany(), prisma.attributeValue.deleteMany(),
    prisma.attribute.deleteMany(), prisma.category.deleteMany(),
    prisma.brand.deleteMany(), prisma.pet.deleteMany(),
    prisma.coupon.deleteMany(), prisma.currency.deleteMany(),
    prisma.language.deleteMany(), prisma.setting.deleteMany(),
    prisma.admin.deleteMany(), prisma.veterinarian.deleteMany(),
    prisma.loyaltyConfig.deleteMany(), prisma.vetConfig.deleteMany(),
  ]);

  // Mongo ObjectId → UUID de Postgres.
  const idMap = { category: new Map(), brand: new Map(), pet: new Map(), product: new Map(), attribute: new Map(), attributeValue: new Map() };

  // ── Categorías (padres antes que hijos, por la FK del árbol) ──
  const ordered = [];
  const pending = [...categories];
  const done = new Set();
  while (pending.length) {
    const before = pending.length;
    for (let i = pending.length - 1; i >= 0; i--) {
      const c = pending[i];
      const parent = c.parentId ? String(c.parentId) : null;
      if (!parent || !keepCats.has(parent) || done.has(parent)) {
        ordered.push(c);
        done.add(String(c._id));
        pending.splice(i, 1);
      }
    }
    if (pending.length === before) { ordered.push(...pending); break; } // ciclo: se aplana
  }

  for (const c of ordered) {
    const parentId = c.parentId && idMap.category.get(String(c.parentId));
    const created = await prisma.category.create({
      data: {
        name: c.name || {},
        description: c.description || undefined,
        slug: c.slug || null,
        icon: await migrateImage(c.icon, "categorias", false),
        status: toEnum(c.status, VISIBILITY, "show"),
        parentId: parentId || null,
        createdAt: c.createdAt || undefined,
      },
    });
    idMap.category.set(String(c._id), created.id);
  }
  log(`✅ categorías: ${ordered.length}`);

  // ── Marcas ──
  for (const b of mBrands) {
    const created = await prisma.brand.create({
      data: {
        name: b.name || {},
        image: await migrateImage(b.image, "marcas", false),
        status: toEnum(b.status, VISIBILITY, "show"),
        createdAt: b.createdAt || undefined,
      },
    });
    idMap.brand.set(String(b._id), created.id);
  }
  log(`✅ marcas: ${mBrands.length}`);

  // ── Mascotas (especie del catálogo) ──
  for (const p of mPets) {
    const created = await prisma.pet.create({
      data: {
        name: p.name || {},
        icon: await migrateImage(p.icon, "mascotas", false),
        status: toEnum(p.status, VISIBILITY, "show"),
        createdAt: p.createdAt || undefined,
      },
    });
    idMap.pet.set(String(p._id), created.id);
  }
  log(`✅ mascotas: ${mPets.length}`);

  // ── Atributos y sus valores ──
  let valueCount = 0;
  for (const a of mAttributes) {
    const created = await prisma.attribute.create({
      data: {
        title: a.title || {},
        name: a.name || {},
        option: toEnum(a.option, ["dropdown", "radio", "checkbox"], "radio"),
        type: toEnum(a.type, ["attribute", "extra"], "attribute"),
        status: toEnum(a.status, VISIBILITY, "show"),
        createdAt: a.createdAt || undefined,
      },
    });
    idMap.attribute.set(String(a._id), created.id);

    for (const v of a.variants || []) {
      const val = await prisma.attributeValue.create({
        data: {
          attributeId: created.id,
          name: v.name || undefined,
          status: toEnum(v.status, VISIBILITY, "show"),
        },
      });
      idMap.attributeValue.set(String(v._id), val.id);
      valueCount++;
    }
  }
  log(`✅ atributos: ${mAttributes.length} (${valueCount} valores)`);

  // ── Productos ──
  const PET_TYPES = ["dog", "cat", "both"];
  const AGES = ["puppy", "adult", "senior", "all"];
  const SIZES = ["mini", "small", "medium", "large", "giant", "all"];
  const NEEDS = ["sensitive_stomach", "weight_control", "urinary", "dental", "skin_coat", "joint", "hypoallergenic"];
  const UNITS = ["kg", "g", "mg", "l", "ml", "lb", "oz", "pieza"];
  const VTAGS = ["new", "bestseller", "organic", "grain_free", "prescription", "eco", "limited_edition", "vet_recommended", "sale"];
  const ITAGS = ["grain_free", "high_protein", "vet_recommended", "natural", "hypoallergenic", "low_fat", "organic", "no_artificial", "prebiotics", "omega_3_6", "gluten_free", "sugar_free", "sensitive_stomach", "joint_support", "skin_coat", "dental_care", "weight_control", "puppy_formula", "pregnant_dog", "newborn_puppy"];

  let variantCount = 0;
  for (const p of mProducts) {
    const categoryId = idMap.category.get(String(p.category));
    if (!categoryId) {
      log(`   ⚠️  producto sin categoría válida, se omite: ${JSON.stringify(p.title)}`);
      continue;
    }

    const images = [];
    for (const img of p.image || []) images.push(await migrateImage(img, "productos", true));

    const pc = p.petCompatibility || {};
    const pkg = p.packageInfo || {};

    const created = await prisma.product.create({
      data: {
        refCode: p.productId || null,
        sku: p.sku || null,
        barcode: p.barcode || null,
        title: p.title || {},
        description: p.description || undefined,
        slug: p.slug,
        categoryId,
        petId: idMap.pet.get(String(p.pet)) || null,
        brandId: idMap.brand.get(String(p.brand)) || null,
        image: images,
        tag: (p.tag || []).map(String),
        stock: toInt(p.stock, 0),
        sales: toInt(p.sales, 0),
        originalPrice: toDecimal(p.prices?.originalPrice),
        price: toDecimal(p.prices?.price),
        discount: p.prices?.discount != null ? toDecimal(p.prices.discount) : null,
        isCombination: !!p.isCombination,
        status: toEnum(p.status, VISIBILITY, "show"),
        productType: toEnum(p.productType, ["food", "medicine", "accessory", "general"], "general"),
        averageRating: toDecimal(p.average_rating, 0),
        totalReviews: toInt(p.total_reviews, 0),
        petCompatPetType: filterEnums(pc.petType, PET_TYPES),
        petCompatAgeRange: filterEnums(pc.ageRange, AGES),
        petCompatSize: filterEnums(pc.size, SIZES),
        petCompatBreed: (pc.breed || []).map(String),
        petCompatSpecialNeeds: filterEnums(pc.specialNeeds, NEEDS),
        packageWeight: pkg.weight != null ? toDecimal(pkg.weight) : null,
        packageUnit: pkg.unit ? toEnum(pkg.unit, UNITS, null) : null,
        packageServings: pkg.servings != null ? toInt(pkg.servings) : null,
        quickInfo: p.quickInfo || undefined,
        benefits: p.benefits || undefined,
        features: p.features || undefined,
        ingredients: p.ingredients || undefined,
        feedingGuide: p.feedingGuide || undefined,
        indications: p.indications || undefined,
        warnings: p.warnings || undefined,
        dosage: p.dosage || undefined,
        recommendedFor: p.recommendedFor || undefined,
        brandInfo: p.brandInfo || undefined,
        nutritionTable: p.nutritionTable || undefined,
        technicalSpecs: p.technicalSpecs || undefined,
        consumptionGuide: p.consumptionGuide || undefined,
        keyFacts: p.keyFacts || undefined,
        productHighlights: (p.productHighlights || []).map(String),
        visualTags: filterEnums(p.visualTags, VTAGS),
        iconTags: filterEnums(p.iconTags, ITAGS),
        createdAt: p.createdAt || undefined,
      },
    });
    idMap.product.set(String(p._id), created.id);

    // Categorías N:M
    const catIds = [...new Set([...(p.categories || []), p.category].filter(Boolean).map(String))]
      .map((id) => idMap.category.get(id))
      .filter(Boolean);
    for (const cid of catIds) {
      await prisma.productCategory.create({ data: { productId: created.id, categoryId: cid } });
    }

    // Variantes: las claves dinámicas eran <attributeId>: <attributeValueId> en
    // ObjectIds de Mongo, así que hay que traducirlas a los UUID nuevos o
    // quedarían apuntando a identificadores inexistentes.
    const KNOWN = new Set(["originalPrice", "price", "quantity", "discount", "productId", "barcode", "sku", "image", "_id"]);
    for (const v of p.variants || []) {
      const attributes = {};
      for (const [k, val] of Object.entries(v)) {
        if (KNOWN.has(k)) continue;
        const newAttrId = idMap.attribute.get(String(k)) || k;
        const newValId = idMap.attributeValue.get(String(val)) || val;
        attributes[newAttrId] = newValId;
      }

      await prisma.productVariant.create({
        data: {
          productId: created.id,
          attributes,
          sku: v.sku || null,
          barcode: v.barcode || null,
          refCode: v.productId || null,
          image: await migrateImage(v.image, "productos", true),
          originalPrice: toDecimal(v.originalPrice),
          price: toDecimal(v.price),
          discount: v.discount != null ? toDecimal(v.discount) : null,
          quantity: toInt(v.quantity, 0),
        },
      });
      variantCount++;
    }
  }
  log(`✅ productos: ${idMap.product.size} (${variantCount} variantes)`);

  // ── Cupones ──
  for (const c of mCoupons) {
    await prisma.coupon.create({
      data: {
        title: c.title || {},
        logo: await migrateImage(c.logo, "cupones", false),
        couponCode: c.couponCode,
        startTime: c.startTime || null,
        endTime: c.endTime,
        discountType: c.discountType || undefined,
        minimumAmount: toDecimal(c.minimumAmount),
        productType: c.productType || null,
        status: toEnum(c.status, VISIBILITY, "show"),
        createdAt: c.createdAt || undefined,
      },
    });
  }
  log(`✅ cupones: ${mCoupons.length}`);

  // ── Monedas e idiomas ──
  for (const c of mCurrencies) {
    await prisma.currency.create({
      data: {
        name: c.name,
        symbol: c.symbol || null,
        status: toEnum(c.status, VISIBILITY, "show"),
        liveExchangeRates: toEnum(c.live_exchange_rates, VISIBILITY, "show"),
        createdAt: c.createdAt || undefined,
      },
    });
  }
  for (const l of mLanguages) {
    await prisma.language.create({
      data: {
        name: l.name,
        code: String(l.code).toLowerCase(),
        flag: l.flag || null,
        status: toEnum(l.status, VISIBILITY, "show"),
        createdAt: l.createdAt || undefined,
      },
    });
  }
  log(`✅ monedas: ${mCurrencies.length} · idiomas: ${mLanguages.length}`);

  // ── Settings (incluye logo, banners y sliders de la tienda) ──
  for (const s of mSettings) {
    await prisma.setting.create({
      data: {
        name: s.name,
        setting: await migrateImagesDeep(s.setting || {}, "tienda"),
        createdAt: s.createdAt || undefined,
      },
    });
  }
  log(`✅ settings: ${mSettings.length}`);

  // ── Admins (el hash de bcrypt se conserva: las contraseñas siguen sirviendo) ──
  const ROLES = ["admin", "super_admin", "cashier", "manager", "ceo", "driver", "security_guard", "accountant"];
  for (const a of mAdmins) {
    await prisma.admin.create({
      data: {
        name: a.name || {},
        email: String(a.email).toLowerCase(),
        phone: a.phone || null,
        password: a.password,
        image: await migrateImage(a.image, "admin", false),
        address: a.address || null,
        country: a.country || null,
        city: a.city || null,
        status: toEnum(a.status, ["activo", "inactivo"], "activo"),
        role: toEnum(a.role, ROLES, "admin"),
        accessList: (a.access_list || []).map(String),
        joiningDate: a.joiningData || null,
        createdAt: a.createdAt || undefined,
      },
    });
  }
  log(`✅ admins: ${mAdmins.length}`);

  // ── Veterinarios y configuración ──
  for (const v of mVeterinarians) {
    await prisma.veterinarian.create({
      data: {
        name: v.name,
        email: String(v.email).toLowerCase(),
        phone: v.phone || null,
        specialties: (v.specialties || []).map(String),
        image: await migrateImage(v.image, "vet", false),
        bio: v.bio || "",
        licenseNumber: v.licenseNumber || null,
        availability: (v.availability || []).map((s) => ({ dayOfWeek: s.dayOfWeek, start: s.start, end: s.end })),
        status: toEnum(v.status, ACTIVE, "active"),
        createdAt: v.createdAt || undefined,
      },
    });
  }

  for (const c of mLoyaltyConfigs) {
    await prisma.loyaltyConfig.create({
      data: {
        pointsPerDollar: toDecimal(c.pointsPerDollar, 1),
        pointValue: toDecimal(c.pointValue, 0.1),
        pointsExpireDays: toInt(c.pointsExpireDays, 365),
        minRedeemPoints: toInt(c.minRedeemPoints, 100),
        maxRedeemPercent: toInt(c.maxRedeemPercent, 50),
        milestones: (c.milestones || []).map((m) => ({
          orderCount: m.orderCount, discountPercent: m.discountPercent, label: m.label,
        })),
        tierThresholdFrecuente: toInt(c.tierThresholds?.frecuente, 3),
        tierThresholdVip: toInt(c.tierThresholds?.vip, 10),
        enabled: c.enabled !== false,
        createdAt: c.createdAt || undefined,
      },
    });
  }

  for (const c of mVetConfigs) {
    await prisma.vetConfig.create({
      data: {
        enabled: !!c.enabled,
        durations: (c.durations || []).map((d) => ({ minutes: d.minutes, label: d.label, price: d.price })),
        discountTiers: (c.discountTiers || []).map((d) => ({ minSpent: d.minSpent, discountPercent: d.discountPercent, label: d.label })),
        freeThreshold: toDecimal(c.freeThreshold, 0),
        advanceBookingDays: toInt(c.advanceBookingDays, 30),
        minBookingHoursAhead: toInt(c.minBookingHoursAhead, 24),
        videoPlatform: toEnum(c.videoPlatform, ["google_meet", "jitsi"], "jitsi"),
        workingHoursStart: c.workingHours?.start || "09:00",
        workingHoursEnd: c.workingHours?.end || "18:00",
        workingDays: (c.workingDays || [1, 2, 3, 4, 5]).map(Number),
        cancellationHoursLimit: toInt(c.cancellationHoursLimit, 12),
        maxDailyConsultations: toInt(c.maxDailyConsultations, 20),
        customerInstructions: c.customerInstructions || "",
        createdAt: c.createdAt || undefined,
      },
    });
  }
  log(`✅ veterinarios: ${mVeterinarians.length} · config lealtad: ${mLoyaltyConfigs.length} · config vet: ${mVetConfigs.length}`);

  log(`\n🖼️  Imágenes → migradas ${imageStats.migrated} · reutilizadas ${imageStats.reused} · fallidas ${imageStats.failed} · omitidas ${imageStats.skipped}`);
  log("\n🎉 Migración completada");

  await mongoose.disconnect();
  await disconnectPrisma();
}

main().catch(async (err) => {
  console.error("\n❌ Error en la migración:", err);
  await mongoose.disconnect().catch(() => {});
  await disconnectPrisma().catch(() => {});
  process.exit(1);
});
