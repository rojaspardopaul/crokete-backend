require("dotenv").config();
const bcrypt = require("bcryptjs");
const { getPrisma, disconnectPrisma } = require("../lib/prisma");

const ACCESS_LIST = [
  "dashboard",
  "products",
  "categories",
  "attributes",
  "coupons",
  "customers",
  "orders",
  "our-staff",
  "settings",
  "languages",
  "currencies",
  "store",
  "customization",
  "store-settings",
  "product",
  "order",
  "edit-profile",
  "customer-order",
  "notifications",
  "coming-soon",
];

const initSuperAdmin = async () => {
  const prisma = getPrisma();

  try {
    console.log("🔌 Conectando a Postgres...");
    await prisma.$queryRaw`SELECT 1`;
    console.log("✅ Conectado");

    // Check if environment variables are set
    const email = process.env.SUPER_ADMIN_EMAIL;
    const password = process.env.SUPER_ADMIN_PASSWORD;
    const name = process.env.SUPER_ADMIN_NAME || "Super Admin";

    if (!email || !password) {
      console.error("❌ ERROR: SUPER_ADMIN_EMAIL y SUPER_ADMIN_PASSWORD deben estar definidos en .env");
      console.log("\nAgrega estas líneas a tu archivo .env:");
      console.log("SUPER_ADMIN_EMAIL=tu_correo@crokete.com.mx");
      console.log("SUPER_ADMIN_PASSWORD=TuContraseñaSegura123!");
      console.log("SUPER_ADMIN_NAME=Nombre del administrador (opcional)");
      process.exit(1);
    }

    const normalizedEmail = String(email).toLowerCase();

    // El enum de Postgres no admite espacios: el rol se guarda como super_admin
    // y los presentadores lo devuelven como "super admin" a la API.
    const existingSuperAdmin = await prisma.admin.findFirst({
      where: { role: "super_admin" },
    });

    if (existingSuperAdmin) {
      console.log("⚠️  Ya existe un Super Admin:");
      console.log(`   Correo: ${existingSuperAdmin.email}`);
      console.log(`   Nombre: ${JSON.stringify(existingSuperAdmin.name)}`);
      console.log("\n✅ No hay nada que hacer.");
      return;
    }

    const existingAdmin = await prisma.admin.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingAdmin) {
      console.error(`❌ ERROR: el correo ${email} ya lo usa otro administrador`);
      console.log(`   Rol del administrador existente: ${existingAdmin.role}`);
      console.log("\nSi quieres promoverlo a super admin, hazlo manualmente en la base de datos.");
      process.exit(1);
    }

    console.log("\n🔐 Creando Super Admin...");
    await prisma.admin.create({
      data: {
        name: { firstName: name, lastName: "" },
        email: normalizedEmail,
        password: bcrypt.hashSync(password, 10),
        role: "super_admin",
        status: "activo",
        phone: "",
        joiningDate: new Date(),
        image: "",
        accessList: ACCESS_LIST,
      },
    });

    console.log("\n✅ ¡Super Admin creado!");
    console.log("\n📋 Datos:");
    console.log(`   Correo: ${email}`);
    console.log(`   Nombre: ${name}`);
    console.log(`   Rol: super admin`);
    console.log(`   Estado: activo`);
    console.log("\n🔑 Ya puedes iniciar sesión en:");
    console.log(`   ${process.env.ADMIN_URL || "http://localhost:4100"}`);
    console.log("\n⚠️  IMPORTANTE: borra las credenciales del .env tras el primer acceso.");
  } catch (error) {
    console.error("❌ Error al crear el Super Admin:", error.message);
    process.exit(1);
  } finally {
    await disconnectPrisma();
    console.log("\n🔌 Conexión cerrada");
  }
};

// Run the initialization
initSuperAdmin();
