require("dotenv").config();
const mongoose = require("mongoose");
const Admin = require("../models/Admin");

const MONGODB_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/crokete_db_prod";

const allAccessList = [
  'dashboard',
  'products',
  'categories',
  'attributes',
  'coupons',
  'pets',
  'brands',
  'reviews',
  'loyalty',
  'vet-settings',
  'vet-appointments',
  'payment-logs',
  'customers',
  'orders',
  'our-staff',
  'settings',
  'languages',
  'currencies',
  'store',
  'customization',
  'store-settings',
  'product',
  'order',
  'edit-profile',
  'customer-order',
  'notifications',
  'coming-soon',
];

async function updateSuperAdminAccess() {
  try {
    console.log("\n🔄 Conectando a MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Conexión exitosa!");

    // Find all super admins
    const superAdmins = await Admin.find({ role: "super admin" });

    if (superAdmins.length === 0) {
      console.log("\n⚠️  No se encontraron super administradores en la base de datos.");
      console.log("   Ejecuta primero: npm run init:admin");
      process.exit(0);
    }

    console.log(`\n📋 Se encontraron ${superAdmins.length} super administrador(es):`);
    
    for (const admin of superAdmins) {
      const currentAccess = admin.access_list || [];
      const missingAccess = allAccessList.filter(
        (access) => !currentAccess.includes(access)
      );

      console.log(`\n👤 Super Admin: ${admin.email}`);
      console.log(`   Accesos actuales: ${currentAccess.length}/${allAccessList.length}`);
      
      if (missingAccess.length > 0) {
        console.log(`   Accesos faltantes: ${missingAccess.join(", ")}`);
        
        // Update the admin with all access
        admin.access_list = allAccessList;
        await admin.save();
        
        console.log(`   ✅ Actualizado con ${allAccessList.length} accesos completos`);
      } else {
        console.log(`   ✅ Ya tiene todos los accesos completos`);
      }
    }

    console.log("\n✅ Actualización completada exitosamente!");
    console.log("\n📝 Accesos completos del sistema:");
    allAccessList.forEach((access, index) => {
      console.log(`   ${index + 1}. ${access}`);
    });

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  }
}

updateSuperAdminAccess();
