require("dotenv").config();
const mongoose = require("mongoose");

const Category = require("../models/Category");
const Brand = require("../models/Brand");
const Product = require("../models/Product");

const MIGRATIONS = [
  {
    parentCategoryName: "Croquetas Naturales",
    mistakenCategoryNames: ["Diamonds Naturals", "Diamond Naturals"],
    brandName: "Diamond Naturals",
  },
  {
    parentCategoryName: "Croquetas Premium",
    mistakenCategoryNames: ["Diamond"],
    brandName: "Diamond",
  },
  {
    parentCategoryName: "Croquetas Premium",
    mistakenCategoryNames: ["Royal Canin"],
    brandName: "Royal Canin",
  },
];

const normalizeText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const matchesName = (documentName, expectedName) => {
  const expected = normalizeText(expectedName);

  if (!expected) {
    return false;
  }

  if (typeof documentName === "string") {
    return normalizeText(documentName) === expected;
  }

  return Object.values(documentName || {}).some(
    (value) => normalizeText(value) === expected
  );
};

const ensureBrand = async (brandName) => {
  let brand = await Brand.findOne({
    $or: [
      { "name.es": brandName },
      { "name.en": brandName },
    ],
  });

  if (!brand) {
    brand = await Brand.create({
      name: {
        es: brandName,
        en: brandName,
      },
      status: "show",
    });
    console.log(`+ Marca creada: ${brandName}`);
  }

  return brand;
};

const updateProductsForMistakenCategory = async ({
  mistakenCategory,
  parentCategory,
  brand,
}) => {
  const products = await Product.find({
    $or: [
      { category: mistakenCategory._id },
      { categories: mistakenCategory._id },
    ],
  });

  for (const product of products) {
    const nextCategories = [
      ...new Set(
        [...(product.categories || []), parentCategory._id]
          .map((value) => String(value))
          .filter((value) => value !== String(mistakenCategory._id))
      ),
    ].map((value) => new mongoose.Types.ObjectId(value));

    const nextPrimaryCategory =
      String(product.category) === String(mistakenCategory._id)
        ? parentCategory._id
        : product.category;

    await Product.updateOne(
      { _id: product._id },
      {
        $set: {
          categories: nextCategories,
          category: nextPrimaryCategory,
          brand: brand._id,
        },
      }
    );
    console.log(`  - Producto actualizado: ${product.slug}`);
  }

  return products.length;
};

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI no está definido en el entorno.");
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("mongodb connection success!");

  let totalUpdatedProducts = 0;
  let totalDeletedCategories = 0;

  for (const migration of MIGRATIONS) {
    const parentCategory = await Category.findOne({
      $or: [
        { "name.es": migration.parentCategoryName },
        { "name.en": migration.parentCategoryName },
      ],
    });

    if (!parentCategory) {
      console.log(`! Categoría padre no encontrada: ${migration.parentCategoryName}`);
      continue;
    }

    const brand = await ensureBrand(migration.brandName);

    const mistakenCategories = await Category.find({
      parentId: String(parentCategory._id),
    });

    const matchedMistakenCategories = mistakenCategories.filter((category) =>
      migration.mistakenCategoryNames.some((name) => matchesName(category.name, name))
    );

    for (const mistakenCategory of matchedMistakenCategories) {
      console.log(
        `> Migrando ${migration.parentCategoryName} / ${migration.brandName} desde categoría errónea ${Object.values(mistakenCategory.name || {})[0] || mistakenCategory._id}`
      );

      totalUpdatedProducts += await updateProductsForMistakenCategory({
        mistakenCategory,
        parentCategory,
        brand,
      });

      await Category.deleteOne({ _id: mistakenCategory._id });
      totalDeletedCategories += 1;
      console.log(`  - Categoría eliminada: ${mistakenCategory._id}`);
    }
  }

  console.log(`Migración completada. Productos actualizados: ${totalUpdatedProducts}. Categorías eliminadas: ${totalDeletedCategories}.`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("Error ejecutando la migración:", error);
  await mongoose.disconnect();
  process.exit(1);
});