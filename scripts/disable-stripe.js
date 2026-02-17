require("dotenv").config();
const mongoose = require("mongoose");
const Setting = require("../models/Setting");

const disableStripe = async () => {
  try {
    console.log("🔌 Conectando a MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Conexión a MongoDB exitosa!");

    console.log("\n🔄 Deshabilitando Stripe temporalmente...");
    
    const result = await Setting.findOneAndUpdate(
      { name: "storeSetting" },
      {
        $set: {
          "setting.stripe_key": "",
          "setting.stripe_status": false
        }
      },
      { new: true }
    );

    if (result) {
      console.log("✅ Stripe deshabilitado exitosamente");
      console.log("   - El store ya no intentará cargar Stripe");
      console.log("   - Solo estará disponible el pago contra entrega (COD)");
    }

    console.log("\n📋 Para habilitar Stripe nuevamente:");
    console.log("1. Obtén tus claves de Stripe en https://dashboard.stripe.com/test/apikeys");
    console.log("2. Configura las variables de entorno en backend/.env:");
    console.log("   STRIPE_KEY=pk_test_... (clave PÚBLICA)");
    console.log("   STRIPE_SECRET=sk_test_... (clave SECRETA)");
    console.log("3. Ejecuta: node scripts/fix-stripe-config.js");

  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await mongoose.connection.close();
    console.log("\n🔌 Conexión a MongoDB cerrada");
  }
};

disableStripe();
