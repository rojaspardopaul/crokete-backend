require("dotenv").config();
const mongoose = require("mongoose");
const Setting = require("../models/Setting");

const fixStripeConfig = async () => {
  try {
    console.log("🔌 Conectando a MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Conexión a MongoDB exitosa!");

    // Get current Stripe keys from environment (if they exist)
    const stripePublishableKey = process.env.STRIPE_KEY || "";
    const stripeSecretKey = process.env.STRIPE_SECRET || "";

    console.log("\n📝 Configuración de Stripe detectada:");
    console.log(`   - Clave pública (STRIPE_KEY): ${stripePublishableKey ? stripePublishableKey.substring(0, 10) + '...' : 'NO CONFIGURADA'}`);
    console.log(`   - Clave secreta (STRIPE_SECRET): ${stripeSecretKey ? stripeSecretKey.substring(0, 10) + '...' : 'NO CONFIGURADA'}`);

    // Validate keys
    if (stripePublishableKey && !stripePublishableKey.startsWith('pk_')) {
      console.warn("\n⚠️  ADVERTENCIA: STRIPE_KEY no parece ser una clave pública (debería empezar con 'pk_')");
      console.warn("   La clave pública es necesaria para el frontend (Stripe.js)");
    }

    if (stripeSecretKey && !stripeSecretKey.startsWith('sk_')) {
      console.warn("\n⚠️  ADVERTENCIA: STRIPE_SECRET no parece ser una clave secreta (debería empezar con 'sk_')");
      console.warn("   La clave secreta solo debe usarse en el backend");
    }

    // Update storeSetting in database
    console.log("\n🔄 Actualizando configuración de Stripe en la base de datos...");
    
    const result = await Setting.findOneAndUpdate(
      { name: "storeSetting" },
      {
        $set: {
          "setting.stripe_key": stripePublishableKey,
          "setting.stripe_secret": stripeSecretKey,
          "setting.stripe_status": stripePublishableKey ? true : false
        }
      },
      { new: true }
    );

    if (result) {
      console.log("✅ Configuración de Stripe actualizada exitosamente en la base de datos");
      console.log(`   - stripe_key: ${result.setting.stripe_key ? result.setting.stripe_key.substring(0, 15) + '...' : 'vacío'}`);
      console.log(`   - stripe_status: ${result.setting.stripe_status}`);
    } else {
      console.log("❌ No se encontró storeSetting en la base de datos");
    }

    console.log("\n📋 INSTRUCCIONES:");
    console.log("1. Crea un archivo .env en la raíz del proyecto backend si no existe");
    console.log("2. Agrega tus claves de Stripe:");
    console.log("   STRIPE_KEY=pk_test_... (tu clave PÚBLICA de Stripe)");
    console.log("   STRIPE_SECRET=sk_test_... (tu clave SECRETA de Stripe)");
    console.log("3. Ejecuta nuevamente este script: node scripts/fix-stripe-config.js");
    console.log("\n💡 Puedes obtener tus claves en: https://dashboard.stripe.com/test/apikeys");

  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await mongoose.connection.close();
    console.log("\n🔌 Conexión a MongoDB cerrada");
  }
};

fixStripeConfig();
