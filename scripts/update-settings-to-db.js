require("dotenv").config();
const mongoose = require("mongoose");
const Setting = require("../models/Setting");
const settingsData = require("../utils/settings");

const updateSettingsToDatabase = async () => {
  try {
    // Connect to MongoDB
    console.log("🔌 Conectando a MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Conexión a MongoDB exitosa!");

    // Process each setting in the settings.js file
    for (const settingItem of settingsData) {
      const { name, setting } = settingItem;

      console.log(`\n📝 Actualizando configuración: ${name}`);

      // Update or insert (upsert) the setting
      const result = await Setting.findOneAndUpdate(
        { name: name },
        { 
          name: name,
          setting: setting 
        },
        { 
          new: true, 
          upsert: true // Create if doesn't exist
        }
      );

      if (result) {
        console.log(`✅ ${name} actualizado exitosamente`);
        
        // Show some key information based on the setting type
        if (name === "globalSetting") {
          console.log(`   - Nombre de tienda: ${setting.shop_name}`);
          console.log(`   - Empresa: ${setting.company_name}`);
          console.log(`   - Email: ${setting.email}`);
        } else if (name === "storeCustomizationSetting") {
          console.log(`   - Idioma predeterminado: ${setting.default_language || 'N/A'}`);
          if (setting.global) {
            console.log(`   - Nombre de tienda: ${setting.global.shop_name || 'N/A'}`);
          }
        }
      }
    }

    console.log("\n🎉 ¡Todas las configuraciones se han actualizado exitosamente en la base de datos!");
    console.log("\n📊 Resumen:");
    console.log(`   - Total de configuraciones actualizadas: ${settingsData.length}`);
    
    // List all settings in database
    const allSettings = await Setting.find({}, { name: 1 });
    console.log(`   - Configuraciones en la base de datos:`);
    allSettings.forEach(s => console.log(`     • ${s.name}`));

  } catch (error) {
    console.error("❌ Error al actualizar las configuraciones:", error.message);
    console.error(error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log("\n🔌 Conexión a MongoDB cerrada");
  }
};

// Execute the update
updateSettingsToDatabase();
