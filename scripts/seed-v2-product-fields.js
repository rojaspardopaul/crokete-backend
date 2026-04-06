/**
 * seed-v2-product-fields.js
 *
 * Actualiza TODOS los productos existentes con datos de ejemplo para los nuevos
 * campos v2 (productType, petCompatibility, quickInfo, packageInfo, etc.)
 * para poder visualizar los cambios en el frontend.
 *
 * Uso:  node scripts/seed-v2-product-fields.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("../models/Product");
require("../models/Category");  // register schema for populate

// ─── helpers ───────────────────────────────────────────────────────────────────

/** Devuelve un elemento aleatorio del array */
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/** Devuelve N elementos aleatorios sin repetir */
const pickN = (arr, n) => {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, n);
};

// ─── plantillas de datos v2 ────────────────────────────────────────────────────

const FOOD_TEMPLATES = [
  {
    quickInfo: { pet: "Perro", age: "Adulto", size: "Mediano", weightRange: "11-25 kg", highlight: "Control de peso" },
    packageInfo: { weight: 13, unit: "kg", servings: 65 },
    petCompatibility: {
      petType: ["dog"],
      ageRange: ["adult"],
      size: ["medium"],
      breed: [],
      specialNeeds: ["weight_control"],
    },
    benefits: { es: "• Peso óptimo\n• Piel y pelo saludable\n• Digestión fácil\n• Refuerzo inmunológico" },
    features: { es: "• Proteína de pollo deshidratada\n• Fibra natural\n• Omega 3 y 6\n• Antioxidantes naturales" },
    ingredients: { es: "Harina de pollo, arroz, maíz, grasa animal, pulpa de remolacha, aceite de pescado, minerales, vitaminas, L-carnitina." },
    nutritionTable: {
      guaranteedAnalysis: [
        { nutrient: "Proteína cruda", value: "25", unit: "%" },
        { nutrient: "Grasa cruda", value: "14", unit: "%" },
        { nutrient: "Fibra cruda", value: "3.5", unit: "%" },
        { nutrient: "Humedad", value: "10", unit: "%" },
        { nutrient: "Ceniza", value: "6.5", unit: "%" },
      ],
      calories: "3,500 kcal/kg",
    },
    feedingGuide: { es: "Peso 11-15kg: 155-195g/día\nPeso 15-20kg: 195-245g/día\nPeso 20-25kg: 245-290g/día\n\nDividir en 2 comidas al día. Ajustar según actividad física." },
    consumptionGuide: [
      { petWeight: 5, dailyAmount: 85, durationDays: 152 },
      { petWeight: 10, dailyAmount: 145, durationDays: 89 },
      { petWeight: 15, dailyAmount: 195, durationDays: 66 },
      { petWeight: 20, dailyAmount: 245, durationDays: 53 },
      { petWeight: 30, dailyAmount: 325, durationDays: 40 },
    ],
    productHighlights: ["Fórmula control de peso", "Con L-Carnitina", "Omega 3 y 6", "Sin colorantes artificiales"],
    keyFacts: [
      { label: "Proteína", value: "25%" },
      { label: "Grasa", value: "14%" },
      { label: "Fibra", value: "3.5%" },
      { label: "Calorías", value: "3,500 kcal/kg" },
    ],
    visualTags: ["bestseller", "vet_recommended"],
    iconTags: ["weight_control", "natural", "skin_coat"],
    recommendedFor: { es: "Perros adultos de raza mediana (11-25 kg) con tendencia al sobrepeso" },
  },
  {
    quickInfo: { pet: "Gato", age: "Adulto", size: "Todos", weightRange: "3-7 kg", highlight: "Indoor" },
    packageInfo: { weight: 7.5, unit: "kg", servings: 50 },
    petCompatibility: {
      petType: ["cat"],
      ageRange: ["adult"],
      size: ["all"],
      breed: [],
      specialNeeds: ["weight_control", "dental"],
    },
    benefits: { es: "• Reduce bolas de pelo\n• Salud urinaria\n• Dientes fuertes\n• Peso ideal" },
    features: { es: "• Fibra de psyllium\n• pH urinario controlado\n• Minerales quelados\n• Proteína de pollo premium" },
    ingredients: { es: "Proteína de pollo deshidratada, arroz, maíz, gluten de trigo, fibra vegetal, grasa animal, pulpa de remolacha, aceite de soya, minerales." },
    nutritionTable: {
      guaranteedAnalysis: [
        { nutrient: "Proteína cruda", value: "27", unit: "%" },
        { nutrient: "Grasa cruda", value: "13", unit: "%" },
        { nutrient: "Fibra cruda", value: "5", unit: "%" },
        { nutrient: "Humedad", value: "9", unit: "%" },
      ],
      calories: "3,300 kcal/kg",
    },
    feedingGuide: { es: "Peso 3kg: 40g/día\nPeso 4kg: 50g/día\nPeso 5kg: 55g/día\nPeso 6kg: 65g/día\nPeso 7kg: 70g/día" },
    consumptionGuide: [
      { petWeight: 3, dailyAmount: 40, durationDays: 187 },
      { petWeight: 5, dailyAmount: 55, durationDays: 136 },
      { petWeight: 7, dailyAmount: 70, durationDays: 107 },
    ],
    productHighlights: ["Reduce bolas de pelo", "Salud urinaria", "Fórmula Indoor", "Dientes limpios"],
    keyFacts: [
      { label: "Proteína", value: "27%" },
      { label: "Grasa", value: "13%" },
      { label: "Fibra", value: "5%" },
      { label: "Calorías", value: "3,300 kcal/kg" },
    ],
    visualTags: ["bestseller"],
    iconTags: ["dental_care", "weight_control", "natural"],
    recommendedFor: { es: "Gatos adultos de interior (1-7 años)" },
  },
  {
    quickInfo: { pet: "Perro", age: "Cachorro", size: "Pequeño", weightRange: "1-10 kg", highlight: "Crecimiento óptimo" },
    packageInfo: { weight: 3, unit: "kg", servings: 30 },
    petCompatibility: {
      petType: ["dog"],
      ageRange: ["puppy"],
      size: ["small", "mini"],
      breed: [],
      specialNeeds: ["sensitive_stomach"],
    },
    benefits: { es: "• Desarrollo cerebral (DHA)\n• Huesos fuertes\n• Digestión suave\n• Sistema inmune fuerte" },
    features: { es: "• DHA de aceite de pescado\n• Calcio y fósforo balanceados\n• Probióticos naturales\n• Croqueta de tamaño mini" },
    ingredients: { es: "Proteína de pollo, arroz, avena, aceite de pescado (fuente de DHA), minerales, vitaminas, probióticos, antioxidantes naturales." },
    nutritionTable: {
      guaranteedAnalysis: [
        { nutrient: "Proteína cruda", value: "30", unit: "%" },
        { nutrient: "Grasa cruda", value: "20", unit: "%" },
        { nutrient: "Fibra cruda", value: "2.5", unit: "%" },
        { nutrient: "DHA", value: "0.1", unit: "%" },
      ],
      calories: "3,800 kcal/kg",
    },
    feedingGuide: { es: "2-4 meses: 55-100g/día\n4-6 meses: 85-120g/día\n6-10 meses: 75-100g/día\n\n3 comidas al día hasta los 6 meses, luego 2." },
    consumptionGuide: [
      { petWeight: 2, dailyAmount: 55, durationDays: 54 },
      { petWeight: 5, dailyAmount: 85, durationDays: 35 },
      { petWeight: 8, dailyAmount: 100, durationDays: 30 },
    ],
    productHighlights: ["Con DHA para el cerebro", "Croqueta mini", "Digestión suave", "Inmunidad reforzada"],
    keyFacts: [
      { label: "Proteína", value: "30%" },
      { label: "Grasa", value: "20%" },
      { label: "DHA", value: "0.1%" },
      { label: "Calorías", value: "3,800 kcal/kg" },
    ],
    visualTags: ["new", "vet_recommended"],
    iconTags: ["sensitive_stomach", "puppy_formula", "high_protein"],
    recommendedFor: { es: "Cachorros de raza pequeña y mini (hasta 10 kg adulto)" },
  },
];

const MEDICINE_TEMPLATE = {
  quickInfo: { pet: "Perro y Gato", age: "Todas las edades", size: "Todos", weightRange: "", highlight: "Antiparasitario" },
  packageInfo: { weight: 50, unit: "g", servings: 1 },
  petCompatibility: {
    petType: ["both"],
    ageRange: ["adult", "puppy", "senior"],
    size: ["all"],
    breed: [],
    specialNeeds: [],
  },
  benefits: { es: "• Eliminación rápida de parásitos intestinales\n• Fácil administración\n• Amplio espectro\n• Acción de 24 horas" },
  features: { es: "• Tableta masticable sabor carne\n• Efectivo contra 6 tipos de parásitos\n• No requiere ayuno previo" },
  indications: { es: "Tratamiento y prevención de infestaciones por parásitos gastrointestinales en perros y gatos.\n\nActivo contra:\n• Toxocara (gusanos redondos)\n• Ancylostoma (gusanos gancho)\n• Dipylidium (tenia)\n• Trichuris (gusanos látigo)" },
  warnings: { es: "⚠️ No administrar a cachorros menores de 2 semanas.\n⚠️ No usar en animales gestantes sin consulta veterinaria.\n⚠️ Mantener fuera del alcance de los niños.\n⚠️ Consulte a su veterinario si persisten los síntomas." },
  dosage: { es: "Perros: 1 tableta por cada 10 kg de peso.\nGatos: ½ tableta por cada 4 kg de peso.\n\nAdministrar con alimento. Repetir cada 3 meses como prevención." },
  productHighlights: ["Amplio espectro", "Sabor carne", "Sin ayuno previo", "Efecto en 24h"],
  keyFacts: [
    { label: "Tipo", value: "Tableta masticable" },
    { label: "Dosis", value: "1 tab/10kg" },
    { label: "Frecuencia", value: "Cada 3 meses" },
  ],
  visualTags: ["vet_recommended"],
  iconTags: ["natural"],
  recommendedFor: { es: "Perros y gatos a partir de 2 semanas de edad" },
};

const ACCESSORY_TEMPLATE = {
  quickInfo: { pet: "Perro", age: "Todas las edades", size: "Mediano", weightRange: "", highlight: "Resistente" },
  packageInfo: { weight: 0.5, unit: "kg", servings: "" },
  petCompatibility: {
    petType: ["dog"],
    ageRange: ["all"],
    size: ["medium", "large"],
    breed: [],
    specialNeeds: [],
  },
  benefits: { es: "• Diseño ergonómico\n• Material resistente a mordidas\n• Fácil de limpiar\n• Colores vibrantes" },
  features: { es: "• Material: Nylon reforzado\n• Costura doble\n• Herrajes de acero inoxidable\n• Acolchado interno" },
  technicalSpecs: [
    { key: { es: "Material" }, value: { es: "Nylon reforzado 1200D" } },
    { key: { es: "Tamaño ajustable" }, value: { es: "35-55 cm" } },
    { key: { es: "Ancho de cinta" }, value: { es: "2.5 cm" } },
    { key: { es: "Color" }, value: { es: "Azul / Rojo / Negro" } },
    { key: { es: "Lavable" }, value: { es: "Sí, a máquina" } },
  ],
  productHighlights: ["Nylon reforzado", "Herrajes inoxidables", "Acolchado", "Lavable a máquina"],
  keyFacts: [
    { label: "Material", value: "Nylon 1200D" },
    { label: "Rango", value: "35-55 cm" },
    { label: "Peso", value: "120g" },
  ],
  visualTags: ["new"],
  iconTags: [],
  recommendedFor: { es: "Perros de raza mediana y grande con paseos frecuentes" },
};

// ─── lógica de asignación de tipo ──────────────────────────────────────────────

/**
 * Intenta inferir el productType basándose en el título y categorías.
 * Si no se puede inferir, asigna "food" por defecto (es el producto más común
 * en un ecommerce de mascotas).
 */
function inferProductType(product) {
  const title = (
    (product.title?.es || product.title?.en || "") +
    " " +
    (product.description?.es || product.description?.en || "")
  ).toLowerCase();

  const catNames = (product.categories || [])
    .map((c) => (c?.name?.es || c?.name?.en || c?.name || "").toLowerCase())
    .join(" ");

  const combined = title + " " + catNames;

  // medicine keywords
  if (
    /antiparasit|desparasit|medicamento|farmacia|veterinar|tableta|jarabe|vacuna|antibiot|antifungic|spray medicado|pomada/.test(
      combined
    )
  ) {
    return "medicine";
  }

  // accessory keywords
  if (
    /collar|correa|arnés|arnes|cama|plato|comedero|bebedero|juguete|transportadora|rascador|jaula|hueso de nylon|accesorio|mochila|bolsa/.test(
      combined
    )
  ) {
    return "accessory";
  }

  // food keywords (default for pet ecommerce)
  if (
    /croqueta|alimento|comida|snack|premio|treat|lata|húmedo|humedo|sobrecito|pouch|proteín|grain free|pienso/.test(
      combined
    )
  ) {
    return "food";
  }

  // default to food (most common product type)
  return "food";
}

// ─── main ──────────────────────────────────────────────────────────────────────

async function main() {
  try {
    console.log("🔌 Conectando a MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Conectado a MongoDB\n");

    const products = await Product.find({}).populate("category categories");
    console.log(`📦 Encontrados ${products.length} productos\n`);

    if (products.length === 0) {
      console.log("⚠️  No hay productos en la base de datos.");
      process.exit(0);
    }

    let foodCount = 0;
    let medicineCount = 0;
    let accessoryCount = 0;
    let generalCount = 0;

    for (const product of products) {
      const type = inferProductType(product);
      let updateData = {};

      switch (type) {
        case "food": {
          const template = FOOD_TEMPLATES[foodCount % FOOD_TEMPLATES.length];
          updateData = {
            productType: "food",
            ...template,
          };
          foodCount++;
          break;
        }
        case "medicine": {
          updateData = {
            productType: "medicine",
            ...MEDICINE_TEMPLATE,
          };
          medicineCount++;
          break;
        }
        case "accessory": {
          updateData = {
            productType: "accessory",
            ...ACCESSORY_TEMPLATE,
          };
          accessoryCount++;
          break;
        }
        default: {
          // general — gets food template as fallback
          const template = FOOD_TEMPLATES[generalCount % FOOD_TEMPLATES.length];
          updateData = {
            productType: "food",
            ...template,
          };
          generalCount++;
          break;
        }
      }

      await Product.findByIdAndUpdate(product._id, { $set: updateData });

      const titleStr =
        product.title?.es || product.title?.en || product._id;
      console.log(
        `  ✅ ${type.padEnd(10)} → ${titleStr}`
      );
    }

    console.log(`\n📊 Resumen:`);
    console.log(`  🍖 Food:      ${foodCount}`);
    console.log(`  💊 Medicine:  ${medicineCount}`);
    console.log(`  🎾 Accessory: ${accessoryCount}`);
    console.log(`  📦 General:   ${generalCount}`);
    console.log(`  📦 Total:     ${products.length}`);
    console.log(`\n✅ ¡Todos los productos actualizados con datos v2!`);

    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

main();
