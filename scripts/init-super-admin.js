require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Admin = require("../models/Admin");

const initSuperAdmin = async () => {
  try {
    // Connect to MongoDB
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Check if environment variables are set
    const email = process.env.SUPER_ADMIN_EMAIL;
    const password = process.env.SUPER_ADMIN_PASSWORD;
    const name = process.env.SUPER_ADMIN_NAME || "Super Admin";

    if (!email || !password) {
      console.error("❌ ERROR: SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be set in .env file");
      console.log("\nAdd these lines to your .env file:");
      console.log("SUPER_ADMIN_EMAIL=your_email@crokete.com.mx");
      console.log("SUPER_ADMIN_PASSWORD=YourSecurePassword123!");
      console.log("SUPER_ADMIN_NAME=Administrator Name (optional)");
      process.exit(1);
    }

    // Check if a super admin already exists
    const existingSuperAdmin = await Admin.findOne({ role: "super admin" });
    
    if (existingSuperAdmin) {
      console.log("⚠️  A Super Admin already exists:");
      console.log(`   Email: ${existingSuperAdmin.email}`);
      console.log(`   Name: ${existingSuperAdmin.name}`);
      console.log("\n✅ No action needed. Super Admin already initialized.");
      process.exit(0);
    }

    // Check if email is already in use
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      console.error(`❌ ERROR: Email ${email} is already in use by another admin`);
      console.log(`   Existing admin role: ${existingAdmin.role}`);
      console.log("\nIf you want to promote this admin to super admin, please do it manually in the database.");
      process.exit(1);
    }

    // Create the first super admin
    console.log("\n🔐 Creating Super Admin...");
    const superAdmin = new Admin({
      name: { firstName: name, lastName: "" },
      email,
      password: bcrypt.hashSync(password, 10),
      role: "super admin",
      status: "activo",
      phone: "",
      joiningDate: new Date(),
      image: "",
      access_list: [
        'dashboard',
        'products',
        'categories',
        'attributes',
        'coupons',
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
      ],
    });

    await superAdmin.save();

    console.log("\n✅ Super Admin created successfully!");
    console.log("\n📋 Super Admin Details:");
    console.log(`   Email: ${email}`);
    console.log(`   Name: ${name}`);
    console.log(`   Role: super admin`);
    console.log(`   Status: activo`);
    console.log("\n🔑 You can now login with these credentials at:");
    console.log(`   ${process.env.ADMIN_URL || 'http://localhost:4100'}`);
    console.log("\n⚠️  IMPORTANT: Keep your credentials secure and delete them from .env after first login!");

  } catch (error) {
    console.error("❌ Error creating Super Admin:", error.message);
    process.exit(1);
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log("\n🔌 MongoDB connection closed");
  }
};

// Run the initialization
initSuperAdmin();
