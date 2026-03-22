/**
 * Script to update super admin permissions with all available routes.
 * Run: node scripts/update-admin-perms.js
 */
require("dotenv").config();
const mongoose = require("mongoose");
const Admin = require("../models/Admin");

const ALL_PERMISSIONS = [
  "dashboard",
  "products",
  "product",
  "categories",
  "attributes",
  "coupons",
  "pets",
  "brands",
  "loyalty",
  "vet-settings",
  "vet-appointments",
  "orders",
  "order",
  "our-staff",
  "settings",
  "languages",
  "currencies",
  "store",
  "customization",
  "store-settings",
  "notifications",
  "edit-profile",
  "coming-soon",
  "customers",
  "customer-order",
];

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  const result = await Admin.updateMany(
    { role: "super admin" },
    { $set: { access_list: ALL_PERMISSIONS } }
  );

  console.log(`Updated ${result.modifiedCount} super admin(s)`);

  const admins = await Admin.find({ role: "super admin" }).select(
    "email access_list"
  );
  admins.forEach((a) => {
    console.log(`  ${a.email}: [${a.access_list.join(", ")}]`);
  });

  await mongoose.disconnect();
  console.log("Done!");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
