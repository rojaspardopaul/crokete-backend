/**
 * Prompt builder for AI product generation.
 * Builds a structured prompt with the Product schema and
 * product-type-specific instructions for the AI model.
 */

// ─── Base schema definition (tells the AI what fields exist) ─────────────────

const PRODUCT_SCHEMA_INSTRUCTIONS = `
Genera un JSON con los siguientes campos para un producto de tienda de mascotas.
Todos los campos de texto multilingual deben ser objetos con clave "es" (español).

CAMPOS OBLIGATORIOS:
- "title": { "es": "Nombre del producto" }
- "description": { "es": "Descripción detallada del producto (2-4 oraciones)" }
- "slug": "nombre-del-producto-en-slug" (todo minúsculas, sin acentos, separado por guiones)
- "prices": { "originalPrice": number, "price": number, "discount": number }
- "stock": number (entre 10 y 200)
- "isCombination": boolean (true si tiene variantes, false si no)
- "status": "show"

CAMPOS DE CLASIFICACIÓN:
- "productType": "food" | "medicine" | "accessory"
- "petCompatibility": {
    "petType": ["dog"] | ["cat"] | ["dog", "cat"],
    "ageRange": ["puppy", "adult", "senior", "all"] (una o más),
    "size": ["mini", "small", "medium", "large", "giant", "all"] (una o más),
    "breed": [] (vacío si aplica a todas las razas),
    "specialNeeds": [] (opciones: "sensitive_stomach", "weight_control", "urinary", "dental", "skin_coat", "joint", "hypoallergenic")
  }

CAMPOS QUICK INFO:
- "quickInfo": { "pet": "Perro/Gato", "age": "Adulto/Cachorro/Senior", "size": "Mediano/Grande/etc", "weightRange": "10-25 kg", "highlight": "Frase corta destacada" }

CAMPOS DE EMPAQUE:
- "packageInfo": { "weight": number, "unit": "kg" | "g" | "lb", "servings": number (aprox) }

CAMPOS DE CONTENIDO (multilingual):
- "benefits": { "es": "Beneficios del producto separados por punto y coma" }
- "features": { "es": "Características separadas por punto y coma" }

CAMPOS DE MARKETING:
- "productHighlights": ["Frase corta 1", "Frase corta 2", "Frase corta 3"] (max 4)
- "keyFacts": [{ "label": "Etiqueta", "value": "Valor" }] (max 5 datos clave)
- "visualTags": array de: "new", "bestseller", "organic", "grain_free", "prescription", "eco", "limited_edition", "vet_recommended", "sale"
- "iconTags": array de: "grain_free", "high_protein", "vet_recommended", "natural", "hypoallergenic", "low_fat", "organic", "no_artificial", "prebiotics", "omega_3_6", "gluten_free", "sugar_free", "sensitive_stomach", "joint_support", "skin_coat", "dental_care", "weight_control", "puppy_formula", "pregnant_dog", "newborn_puppy"

CAMPO DE TAGS:
- "tag": ["tag1", "tag2", "tag3"] (palabras clave para búsqueda, 3-6 tags)
`;

// ─── Food-specific instructions ──────────────────────────────────────────────

const FOOD_INSTRUCTIONS = `
CAMPOS ESPECÍFICOS PARA ALIMENTO (productType = "food"):
- "ingredients": { "es": "Lista de ingredientes separados por coma, del más al menos presente" }
- "nutritionTable": {
    "guaranteedAnalysis": [
      { "nutrient": "Proteína cruda", "value": "26", "unit": "%" },
      { "nutrient": "Grasa cruda", "value": "15", "unit": "%" },
      { "nutrient": "Fibra cruda", "value": "3", "unit": "%" },
      { "nutrient": "Humedad", "value": "10", "unit": "%" },
      { "nutrient": "Ceniza", "value": "7", "unit": "%" }
    ],
    "calories": "3500 kcal/kg",
    "caloriesPerKg": 3500
  }
- "feedingGuide": { "es": "Guía de alimentación según peso del animal" }
- "consumptionGuide": [
    { "petWeight": 5, "dailyAmount": 80, "durationDays": 60 },
    { "petWeight": 10, "dailyAmount": 150, "durationDays": 35 },
    { "petWeight": 20, "dailyAmount": 250, "durationDays": 20 },
    { "petWeight": 30, "dailyAmount": 350, "durationDays": 15 }
  ] (ajustar según el peso del empaque)

VARIANTES DE ALIMENTO:
Si el producto viene en diferentes tamaños de empaque, genera variantes.
El campo "variants" debe ser un array de objetos. Cada variante tiene:
- Un campo dinámico donde la key es el ID del atributo "Peso/Tamaño" y el value es el ID de la opción
- "originalPrice": number
- "price": number  
- "discount": number (originalPrice - price)
- "quantity": number (stock por variante)
- "barcode": "" 
- "sku": ""
- "productId": "variant-0", "variant-1", etc.
- "image": ""

Si NO conoces los IDs de atributos, genera las variantes con el campo especial:
- "_variantLabel": "2 kg", "_variantPrice": 350, "_variantOriginalPrice": 350, "_variantQuantity": 50
Esto será mapeado a IDs reales en el backend.

Genera variantes típicas para croquetas: 2kg, 7kg, 15kg (o según el contexto del producto).
`;

// ─── Medicine-specific instructions ──────────────────────────────────────────

const MEDICINE_INSTRUCTIONS = `
CAMPOS ESPECÍFICOS PARA FARMACIA VETERINARIA (productType = "medicine"):
- "indications": { "es": "Indicaciones de uso del medicamento. Para qué sirve, qué trata." }
- "warnings": { "es": "Contraindicaciones y advertencias importantes. Efectos secundarios posibles." }
- "dosage": { "es": "Dosificación según peso del animal. Frecuencia. Vía de administración." }
- "recommendedFor": { "es": "Tipo de animales y condiciones para las que se recomienda" }

IMPORTANTE para medicamentos:
- Los precios deben ser realistas para farmacia veterinaria en México (MXN)
- Incluir advertencias de seguridad relevantes
- Incluir "prescription" en visualTags si requiere receta
- Incluir "vet_recommended" en iconTags
- No inventar ingredientes activos si no los conoces, usa genéricos realistas

VARIANTES DE MEDICAMENTO:
Si aplica, genera variantes por presentación (tabletas, jarabe, inyectable) o por concentración/tamaño.
Usa el formato especial para variantes sin IDs:
- "_variantLabel": "30 tabletas", "_variantPrice": 450, "_variantOriginalPrice": 450, "_variantQuantity": 30
`;

// ─── Accessory-specific instructions ─────────────────────────────────────────

const ACCESSORY_INSTRUCTIONS = `
CAMPOS ESPECÍFICOS PARA ACCESORIOS (productType = "accessory"):
- "technicalSpecs": [
    { "key": { "es": "Material" }, "value": { "es": "Nylon reforzado" } },
    { "key": { "es": "Dimensiones" }, "value": { "es": "120 cm x 2.5 cm" } },
    { "key": { "es": "Peso" }, "value": { "es": "150 g" } },
    { "key": { "es": "Color" }, "value": { "es": "Negro, Azul, Rojo" } }
  ]

VARIANTES DE ACCESORIOS:
Si aplica, genera variantes por talla (S, M, L, XL) o por color.
Usa el formato especial para variantes sin IDs:
- "_variantLabel": "Talla M", "_variantPrice": 299, "_variantOriginalPrice": 299, "_variantQuantity": 40
`;

// ─── Build the full prompt ───────────────────────────────────────────────────

/**
 * Build a structured prompt for AI product generation.
 *
 * @param {Object} input
 * @param {string} input.productName - Name or description of the product
 * @param {"food"|"medicine"|"accessory"} input.productType - Product category
 * @param {string} [input.brandName] - Brand name
 * @param {string} [input.categoryName] - Category name
 * @param {string} [input.petType] - "dog", "cat", or "both"
 * @param {string} [input.additionalInfo] - Extra info (ingredients from packaging, etc.)
 * @param {Object} [input.contextData] - Real IDs from DB for categories/brands
 * @returns {string} The complete prompt
 */
function buildProductPrompt(input) {
  const {
    productName,
    productType,
    brandName,
    categoryName,
    petType,
    additionalInfo,
    contextData,
  } = input;

  // Select type-specific instructions
  let typeInstructions = "";
  switch (productType) {
    case "food":
      typeInstructions = FOOD_INSTRUCTIONS;
      break;
    case "medicine":
      typeInstructions = MEDICINE_INSTRUCTIONS;
      break;
    case "accessory":
      typeInstructions = ACCESSORY_INSTRUCTIONS;
      break;
    default:
      typeInstructions = "";
  }

  // Build context section
  let contextSection = `\nCONTEXTO DEL PRODUCTO:\n`;
  contextSection += `- Producto: ${productName}\n`;
  contextSection += `- Tipo: ${productType}\n`;
  if (brandName) contextSection += `- Marca: ${brandName}\n`;
  if (categoryName) contextSection += `- Categoría: ${categoryName}\n`;
  if (petType) contextSection += `- Mascota: ${petType === "dog" ? "Perro" : petType === "cat" ? "Gato" : "Perro y Gato"}\n`;
  if (additionalInfo) {
    contextSection += `\nINFORMACIÓN ADICIONAL DEL USUARIO:\n${additionalInfo}\n`;
  }

  // Add real DB IDs if available
  let idsSection = "";
  if (contextData) {
    if (contextData.categoryId) {
      idsSection += `\nUSA ESTOS IDS REALES (no los inventes):\n`;
      idsSection += `- categoryId: "${contextData.categoryId}"\n`;
      if (contextData.categoryIds) {
        idsSection += `- categoryIds: ${JSON.stringify(contextData.categoryIds)}\n`;
      }
    }
    if (contextData.brandId) {
      idsSection += `- brandId: "${contextData.brandId}"\n`;
    }
    if (contextData.petId) {
      idsSection += `- petId: "${contextData.petId}"\n`;
    }
  }

  const prompt = `${PRODUCT_SCHEMA_INSTRUCTIONS}
${typeInstructions}
${contextSection}
${idsSection}

INSTRUCCIONES FINALES:
1. Genera precios realistas en pesos mexicanos (MXN).
2. Todo texto en español de México.
3. Se creativo pero preciso. Si conoces el producto real, usa datos reales.
4. Si el usuario proporcionó información adicional (ingredientes, tabla nutricional, etc.), úsala como base y completa lo que falte.
5. El slug debe ser el título en minúsculas, sin acentos, separado por guiones.
6. Responde SOLO con el JSON del producto, sin texto adicional.
7. Si generas variantes, pon "isCombination": true. Si no, "isCombination": false.
8. Los precios de variantes deben ser coherentes (empaque más grande = mejor precio por kg pero mayor precio total).

Responde con un JSON válido.`;

  return prompt;
}

module.exports = { buildProductPrompt };
