require("dotenv").config();
const mongoose = require("mongoose");
const Setting = require("../models/Setting");

const checkImageUrls = async () => {
  try {
    console.log("🔌 Conectando a MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Conexión a MongoDB exitosa!\n");

    const storeCustomization = await Setting.findOne({ name: "storeCustomizationSetting" });

    if (!storeCustomization) {
      console.log("❌ No se encontró storeCustomizationSetting");
      return;
    }

    const setting = storeCustomization.setting;
    const imageUrls = [];

    // Function to recursively find image URLs
    const findImageUrls = (obj, path = "") => {
      for (const key in obj) {
        const value = obj[key];
        const currentPath = path ? `${path}.${key}` : key;

        if (typeof value === "string" && 
            (value.includes("cloudinary.com") || 
             value.includes(".jpg") || 
             value.includes(".png") || 
             value.includes(".svg") || 
             value.includes(".webp"))) {
          imageUrls.push({
            path: currentPath,
            url: value,
            isEmpty: value === ""
          });
        } else if (typeof value === "object" && value !== null) {
          findImageUrls(value, currentPath);
        }
      }
    };

    findImageUrls(setting);

    console.log("📸 URLs de Imágenes encontradas en la configuración:\n");
    console.log("=" .repeat(80));

    const emptyImages = imageUrls.filter(img => img.isEmpty);
    const externalImages = imageUrls.filter(img => !img.isEmpty);

    if (externalImages.length > 0) {
      console.log("\n🔗 Imágenes externas (Cloudinary u otras):");
      console.log("-".repeat(80));
      externalImages.forEach((img, index) => {
        const isOldCloudinary = img.url.includes("ahossain") || img.url.includes("dr397rg7u");
        const marker = isOldCloudinary ? "⚠️ " : "✅ ";
        console.log(`${marker}${index + 1}. ${img.path}`);
        console.log(`   URL: ${img.url.substring(0, 80)}${img.url.length > 80 ? "..." : ""}`);
        console.log();
      });
    }

    if (emptyImages.length > 0) {
      console.log("\n📭 Imágenes vacías (necesitan configurarse):");
      console.log("-".repeat(80));
      emptyImages.forEach((img, index) => {
        console.log(`${index + 1}. ${img.path}`);
      });
      console.log();
    }

    console.log("=" .repeat(80));
    console.log("\n📊 Resumen:");
    console.log(`   Total de campos de imagen: ${imageUrls.length}`);
    console.log(`   Imágenes configuradas: ${externalImages.length}`);
    console.log(`   Imágenes vacías: ${emptyImages.length}`);
    console.log(`   ⚠️  Imágenes de cuentas antiguas: ${externalImages.filter(img => img.url.includes("ahossain") || img.url.includes("dr397rg7u")).length}`);

    console.log("\n💡 Recomendaciones:");
    console.log("1. Crea una cuenta en Cloudinary: https://cloudinary.com/");
    console.log("2. Sube tus propias imágenes (logo, banners, sliders, etc.)");
    console.log("3. Reemplaza las URLs en utils/settings.js");
    console.log("4. Ejecuta: node scripts/update-settings-to-db.js");
    console.log("\nO usa el panel de administración para subir imágenes desde la interfaz web.");

  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await mongoose.connection.close();
    console.log("\n🔌 Conexión a MongoDB cerrada");
  }
};

checkImageUrls();
