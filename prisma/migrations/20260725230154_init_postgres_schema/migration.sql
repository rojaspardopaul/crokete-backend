-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('show', 'hide');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('food', 'medicine', 'accessory', 'general');

-- CreateEnum
CREATE TYPE "PetTypeTag" AS ENUM ('dog', 'cat', 'both');

-- CreateEnum
CREATE TYPE "AgeRange" AS ENUM ('puppy', 'adult', 'senior', 'all');

-- CreateEnum
CREATE TYPE "PetSize" AS ENUM ('mini', 'small', 'medium', 'large', 'giant', 'all');

-- CreateEnum
CREATE TYPE "SpecialNeed" AS ENUM ('sensitive_stomach', 'weight_control', 'urinary', 'dental', 'skin_coat', 'joint', 'hypoallergenic');

-- CreateEnum
CREATE TYPE "PackageUnit" AS ENUM ('kg', 'g', 'mg', 'l', 'ml', 'lb', 'oz', 'pieza');

-- CreateEnum
CREATE TYPE "VisualTag" AS ENUM ('new', 'bestseller', 'organic', 'grain_free', 'prescription', 'eco', 'limited_edition', 'vet_recommended', 'sale');

-- CreateEnum
CREATE TYPE "IconTag" AS ENUM ('grain_free', 'high_protein', 'vet_recommended', 'natural', 'hypoallergenic', 'low_fat', 'organic', 'no_artificial', 'prebiotics', 'omega_3_6', 'gluten_free', 'sugar_free', 'sensitive_stomach', 'joint_support', 'skin_coat', 'dental_care', 'weight_control', 'puppy_formula', 'pregnant_dog', 'newborn_puppy');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('pedido', 'empaquetado', 'en_reparto', 'entregado', 'cancelado');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('admin', 'super_admin', 'cashier', 'manager', 'ceo', 'driver', 'security_guard', 'accountant');

-- CreateEnum
CREATE TYPE "AdminStatus" AS ENUM ('activo', 'inactivo');

-- CreateEnum
CREATE TYPE "LoyaltyTier" AS ENUM ('nuevo', 'frecuente', 'vip');

-- CreateEnum
CREATE TYPE "AttributeOption" AS ENUM ('dropdown', 'radio', 'checkbox');

-- CreateEnum
CREATE TYPE "AttributeKind" AS ENUM ('attribute', 'extra');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "AiSuggestedAction" AS ENUM ('approved_suggestion', 'needs_review', 'spam', 'offensive', 'fake_review');

-- CreateEnum
CREATE TYPE "PetSpecies" AS ENUM ('perro', 'gato', 'otro');

-- CreateEnum
CREATE TYPE "PetGender" AS ENUM ('macho', 'hembra');

-- CreateEnum
CREATE TYPE "ActiveStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "VetAppointmentStatus" AS ENUM ('requested', 'approved', 'confirmed', 'in_progress', 'completed', 'rejected', 'cancelled', 'no_show');

-- CreateEnum
CREATE TYPE "MeetingPlatform" AS ENUM ('google_meet', 'jitsi');

-- CreateEnum
CREATE TYPE "CancelledBy" AS ENUM ('customer', 'admin', 'vet');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'CREATE_ADMIN', 'UPDATE_ADMIN', 'DELETE_ADMIN', 'UPDATE_STATUS', 'UPDATE_ROLE', 'UPDATE_PROFILE', 'PASSWORD_RESET', 'PASSWORD_CHANGE');

-- CreateEnum
CREATE TYPE "AuditStatus" AS ENUM ('success', 'failure');

-- CreateEnum
CREATE TYPE "PaymentEvent" AS ENUM ('PAYMENT_INTENT_CREATED', 'PAYMENT_INTENT_UPDATED', 'PAYMENT_SUCCEEDED', 'PAYMENT_FAILED', 'ORDER_CREATED', 'ORDER_CREATION_FAILED', 'WEBHOOK_RECEIVED', 'REFUND_INITIATED');

-- CreateEnum
CREATE TYPE "PaymentLogStatus" AS ENUM ('success', 'error', 'pending');

-- CreateEnum
CREATE TYPE "PointTransactionType" AS ENUM ('earned', 'redeemed', 'expired', 'adjusted', 'milestone_bonus');

-- CreateEnum
CREATE TYPE "LoyaltyRewardType" AS ENUM ('milestone', 'points_redemption');

-- CreateEnum
CREATE TYPE "DiscountKind" AS ENUM ('percentage', 'fixed');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('read', 'unread');

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "name" JSONB NOT NULL,
    "description" JSONB,
    "slug" TEXT,
    "icon" TEXT,
    "status" "Visibility" NOT NULL DEFAULT 'show',
    "parentId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" UUID NOT NULL,
    "name" JSONB NOT NULL,
    "image" TEXT,
    "status" "Visibility" NOT NULL DEFAULT 'show',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pets" (
    "id" UUID NOT NULL,
    "name" JSONB NOT NULL,
    "icon" TEXT,
    "status" "Visibility" NOT NULL DEFAULT 'show',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "refCode" TEXT,
    "sku" TEXT,
    "barcode" TEXT,
    "title" JSONB NOT NULL,
    "description" JSONB,
    "slug" TEXT NOT NULL,
    "categoryId" UUID NOT NULL,
    "petId" UUID,
    "brandId" UUID,
    "image" TEXT[],
    "tag" TEXT[],
    "stock" INTEGER NOT NULL DEFAULT 0,
    "sales" INTEGER NOT NULL DEFAULT 0,
    "originalPrice" DECIMAL(10,2) NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "discount" DECIMAL(10,2),
    "isCombination" BOOLEAN NOT NULL DEFAULT false,
    "status" "Visibility" NOT NULL DEFAULT 'show',
    "productType" "ProductType" NOT NULL DEFAULT 'general',
    "averageRating" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "totalReviews" INTEGER NOT NULL DEFAULT 0,
    "petCompatPetType" "PetTypeTag"[],
    "petCompatAgeRange" "AgeRange"[],
    "petCompatSize" "PetSize"[],
    "petCompatBreed" TEXT[],
    "petCompatSpecialNeeds" "SpecialNeed"[],
    "packageWeight" DECIMAL(10,3),
    "packageUnit" "PackageUnit",
    "packageServings" INTEGER,
    "quickInfo" JSONB,
    "benefits" JSONB,
    "features" JSONB,
    "ingredients" JSONB,
    "feedingGuide" JSONB,
    "indications" JSONB,
    "warnings" JSONB,
    "dosage" JSONB,
    "recommendedFor" JSONB,
    "brandInfo" JSONB,
    "nutritionTable" JSONB,
    "technicalSpecs" JSONB,
    "consumptionGuide" JSONB,
    "keyFacts" JSONB,
    "productHighlights" TEXT[],
    "visualTags" "VisualTag"[],
    "iconTags" "IconTag"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_categories" (
    "productId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("productId","categoryId")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "sku" TEXT,
    "barcode" TEXT,
    "refCode" TEXT,
    "image" TEXT,
    "originalPrice" DECIMAL(10,2) NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "discount" DECIMAL(10,2),
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attributes" (
    "id" UUID NOT NULL,
    "title" JSONB NOT NULL,
    "name" JSONB NOT NULL,
    "option" "AttributeOption" NOT NULL DEFAULT 'radio',
    "type" "AttributeKind" NOT NULL DEFAULT 'attribute',
    "status" "Visibility" NOT NULL DEFAULT 'show',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attributes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attribute_values" (
    "id" UUID NOT NULL,
    "attributeId" UUID NOT NULL,
    "name" JSONB,
    "status" "Visibility" NOT NULL DEFAULT 'show',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attribute_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" UUID NOT NULL,
    "title" JSONB NOT NULL,
    "logo" TEXT,
    "couponCode" TEXT NOT NULL,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3) NOT NULL,
    "discountType" JSONB,
    "minimumAmount" DECIMAL(10,2) NOT NULL,
    "productType" TEXT,
    "status" "Visibility" NOT NULL DEFAULT 'show',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password" TEXT,
    "image" TEXT,
    "address" TEXT,
    "country" TEXT,
    "city" TEXT,
    "shippingAddress" JSONB,
    "loyaltyPoints" INTEGER NOT NULL DEFAULT 0,
    "loyaltyTotalPoints" INTEGER NOT NULL DEFAULT 0,
    "loyaltyTotalSpent" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "loyaltyOrderCount" INTEGER NOT NULL DEFAULT 0,
    "loyaltyTier" "LoyaltyTier" NOT NULL DEFAULT 'nuevo',
    "loyaltyJoinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "invoice" SERIAL NOT NULL,
    "customerId" UUID NOT NULL,
    "userInfo" JSONB NOT NULL,
    "subTotal" DECIMAL(10,2) NOT NULL,
    "shippingCost" DECIMAL(10,2) NOT NULL,
    "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 16,
    "taxAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL,
    "shippingOption" TEXT,
    "paymentMethod" TEXT NOT NULL,
    "stripePaymentIntentId" TEXT,
    "loyaltyCouponCode" TEXT,
    "cardInfo" JSONB,
    "status" "OrderStatus" NOT NULL DEFAULT 'pedido',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "productId" UUID,
    "variantId" UUID,
    "title" TEXT NOT NULL,
    "image" TEXT,
    "sku" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "itemTotal" DECIMAL(10,2) NOT NULL,
    "snapshot" JSONB,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "comment" TEXT NOT NULL,
    "displayName" TEXT NOT NULL DEFAULT '',
    "images" TEXT[],
    "status" "ReviewStatus" NOT NULL DEFAULT 'pending',
    "aiAnalysis" JSONB,
    "aiSuggestedAction" "AiSuggestedAction",
    "adminNote" TEXT NOT NULL DEFAULT '',
    "helpfulVotes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_configs" (
    "id" UUID NOT NULL,
    "pointsPerDollar" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "pointValue" DECIMAL(10,4) NOT NULL DEFAULT 0.1,
    "pointsExpireDays" INTEGER NOT NULL DEFAULT 365,
    "minRedeemPoints" INTEGER NOT NULL DEFAULT 100,
    "maxRedeemPercent" INTEGER NOT NULL DEFAULT 50,
    "milestones" JSONB NOT NULL DEFAULT '[]',
    "tierThresholdFrecuente" INTEGER NOT NULL DEFAULT 3,
    "tierThresholdVip" INTEGER NOT NULL DEFAULT 10,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyalty_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "point_transactions" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "type" "PointTransactionType" NOT NULL,
    "points" INTEGER NOT NULL,
    "balance" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "orderId" UUID,
    "couponGenerated" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "point_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_rewards" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "type" "LoyaltyRewardType" NOT NULL,
    "couponCode" TEXT NOT NULL,
    "discountType" "DiscountKind" NOT NULL,
    "discountValue" DECIMAL(10,2) NOT NULL,
    "minimumAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "usedAt" TIMESTAMP(3),
    "orderId" UUID,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "pointsSpent" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyalty_rewards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_pets" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "species" "PetSpecies" NOT NULL,
    "breed" TEXT NOT NULL DEFAULT '',
    "age" INTEGER,
    "weight" DECIMAL(6,2),
    "gender" "PetGender",
    "image" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "status" "ActiveStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_pets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "veterinarians" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "specialties" TEXT[],
    "image" TEXT,
    "bio" TEXT NOT NULL DEFAULT '',
    "licenseNumber" TEXT,
    "availability" JSONB NOT NULL DEFAULT '[]',
    "status" "ActiveStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "veterinarians_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vet_appointments" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "veterinarianId" UUID NOT NULL,
    "customerPetId" UUID NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "symptoms" TEXT[],
    "originalPrice" DECIMAL(10,2) NOT NULL,
    "discountPercent" INTEGER NOT NULL DEFAULT 0,
    "finalPrice" DECIMAL(10,2) NOT NULL,
    "status" "VetAppointmentStatus" NOT NULL DEFAULT 'requested',
    "meetingUrl" TEXT NOT NULL DEFAULT '',
    "meetingPlatform" "MeetingPlatform" NOT NULL DEFAULT 'jitsi',
    "adminNotes" TEXT NOT NULL DEFAULT '',
    "clinicalNotes" TEXT NOT NULL DEFAULT '',
    "diagnosis" TEXT NOT NULL DEFAULT '',
    "recommendations" TEXT NOT NULL DEFAULT '',
    "cancelledBy" "CancelledBy",
    "cancellationReason" TEXT NOT NULL DEFAULT '',
    "statusHistory" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vet_appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vet_configs" (
    "id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "durations" JSONB NOT NULL DEFAULT '[]',
    "discountTiers" JSONB NOT NULL DEFAULT '[]',
    "freeThreshold" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "advanceBookingDays" INTEGER NOT NULL DEFAULT 30,
    "minBookingHoursAhead" INTEGER NOT NULL DEFAULT 24,
    "videoPlatform" "MeetingPlatform" NOT NULL DEFAULT 'jitsi',
    "workingHoursStart" TEXT NOT NULL DEFAULT '09:00',
    "workingHoursEnd" TEXT NOT NULL DEFAULT '18:00',
    "workingDays" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5]::INTEGER[],
    "cancellationHoursLimit" INTEGER NOT NULL DEFAULT 12,
    "maxDailyConsultations" INTEGER NOT NULL DEFAULT 20,
    "customerInstructions" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vet_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admins" (
    "id" UUID NOT NULL,
    "name" JSONB NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password" TEXT NOT NULL,
    "image" TEXT,
    "address" TEXT,
    "country" TEXT,
    "city" TEXT,
    "status" "AdminStatus" NOT NULL DEFAULT 'activo',
    "role" "AdminRole" NOT NULL DEFAULT 'admin',
    "accessList" TEXT[],
    "joiningDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "adminId" UUID NOT NULL,
    "adminEmail" TEXT NOT NULL,
    "adminName" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "targetId" UUID,
    "targetEmail" TEXT,
    "targetRole" TEXT,
    "changes" JSONB,
    "ip" TEXT NOT NULL,
    "userAgent" TEXT,
    "status" "AuditStatus" NOT NULL DEFAULT 'success',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_attempts" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "blockedUntil" TIMESTAMP(3),
    "lastAttempt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_logs" (
    "id" UUID NOT NULL,
    "orderId" UUID,
    "customerId" UUID,
    "userEmail" TEXT,
    "event" "PaymentEvent" NOT NULL,
    "stripePaymentIntentId" TEXT,
    "amount" DECIMAL(10,2),
    "currency" TEXT NOT NULL DEFAULT 'mxn',
    "status" "PaymentLogStatus" NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "metadata" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "orderId" UUID,
    "productId" UUID,
    "adminId" UUID,
    "message" TEXT NOT NULL,
    "image" TEXT,
    "status" "NotificationStatus" NOT NULL DEFAULT 'unread',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "setting" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "currencies" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT,
    "status" "Visibility" NOT NULL DEFAULT 'show',
    "liveExchangeRates" "Visibility" NOT NULL DEFAULT 'show',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "languages" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "flag" TEXT,
    "status" "Visibility" NOT NULL DEFAULT 'show',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "languages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "categories_parentId_idx" ON "categories"("parentId");

-- CreateIndex
CREATE INDEX "categories_status_idx" ON "categories"("status");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "brands_status_idx" ON "brands"("status");

-- CreateIndex
CREATE INDEX "pets_status_idx" ON "pets"("status");

-- CreateIndex
CREATE INDEX "products_status_sales_idx" ON "products"("status", "sales" DESC);

-- CreateIndex
CREATE INDEX "products_status_price_idx" ON "products"("status", "price");

-- CreateIndex
CREATE INDEX "products_productType_status_idx" ON "products"("productType", "status");

-- CreateIndex
CREATE INDEX "products_categoryId_status_idx" ON "products"("categoryId", "status");

-- CreateIndex
CREATE INDEX "products_brandId_idx" ON "products"("brandId");

-- CreateIndex
CREATE INDEX "products_petId_idx" ON "products"("petId");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE INDEX "product_categories_categoryId_idx" ON "product_categories"("categoryId");

-- CreateIndex
CREATE INDEX "product_variants_productId_idx" ON "product_variants"("productId");

-- CreateIndex
CREATE INDEX "attributes_status_idx" ON "attributes"("status");

-- CreateIndex
CREATE INDEX "attribute_values_attributeId_idx" ON "attribute_values"("attributeId");

-- CreateIndex
CREATE INDEX "coupons_status_endTime_idx" ON "coupons"("status", "endTime");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_couponCode_key" ON "coupons"("couponCode");

-- CreateIndex
CREATE UNIQUE INDEX "customers_email_key" ON "customers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "orders_invoice_key" ON "orders"("invoice");

-- CreateIndex
CREATE INDEX "orders_customerId_createdAt_idx" ON "orders"("customerId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "orders_status_createdAt_idx" ON "orders"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "orders_createdAt_idx" ON "orders"("createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "orders_stripePaymentIntentId_key" ON "orders"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "order_items_orderId_idx" ON "order_items"("orderId");

-- CreateIndex
CREATE INDEX "order_items_productId_idx" ON "order_items"("productId");

-- CreateIndex
CREATE INDEX "reviews_status_createdAt_idx" ON "reviews"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "reviews_productId_status_idx" ON "reviews"("productId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_productId_customerId_key" ON "reviews"("productId", "customerId");

-- CreateIndex
CREATE INDEX "point_transactions_customerId_createdAt_idx" ON "point_transactions"("customerId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "point_transactions_expiresAt_idx" ON "point_transactions"("expiresAt");

-- CreateIndex
CREATE INDEX "loyalty_rewards_customerId_used_idx" ON "loyalty_rewards"("customerId", "used");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_rewards_couponCode_key" ON "loyalty_rewards"("couponCode");

-- CreateIndex
CREATE INDEX "customer_pets_customerId_status_idx" ON "customer_pets"("customerId", "status");

-- CreateIndex
CREATE INDEX "veterinarians_status_idx" ON "veterinarians"("status");

-- CreateIndex
CREATE INDEX "vet_appointments_date_veterinarianId_idx" ON "vet_appointments"("date", "veterinarianId");

-- CreateIndex
CREATE INDEX "vet_appointments_customerId_status_idx" ON "vet_appointments"("customerId", "status");

-- CreateIndex
CREATE INDEX "vet_appointments_status_date_idx" ON "vet_appointments"("status", "date");

-- CreateIndex
CREATE UNIQUE INDEX "admins_email_key" ON "admins"("email");

-- CreateIndex
CREATE INDEX "audit_logs_adminId_createdAt_idx" ON "audit_logs"("adminId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_targetId_createdAt_idx" ON "audit_logs"("targetId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "login_attempts_blockedUntil_idx" ON "login_attempts"("blockedUntil");

-- CreateIndex
CREATE INDEX "login_attempts_lastAttempt_idx" ON "login_attempts"("lastAttempt");

-- CreateIndex
CREATE UNIQUE INDEX "login_attempts_email_ip_key" ON "login_attempts"("email", "ip");

-- CreateIndex
CREATE INDEX "payment_logs_orderId_createdAt_idx" ON "payment_logs"("orderId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "payment_logs_customerId_createdAt_idx" ON "payment_logs"("customerId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "payment_logs_event_createdAt_idx" ON "payment_logs"("event", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "payment_logs_stripePaymentIntentId_idx" ON "payment_logs"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "payment_logs_status_createdAt_idx" ON "payment_logs"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "notifications_status_createdAt_idx" ON "notifications"("status", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "settings_name_key" ON "settings"("name");

-- CreateIndex
CREATE UNIQUE INDEX "languages_code_key" ON "languages"("code");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_petId_fkey" FOREIGN KEY ("petId") REFERENCES "pets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attribute_values" ADD CONSTRAINT "attribute_values_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "attributes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_rewards" ADD CONSTRAINT "loyalty_rewards_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_rewards" ADD CONSTRAINT "loyalty_rewards_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_pets" ADD CONSTRAINT "customer_pets_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vet_appointments" ADD CONSTRAINT "vet_appointments_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vet_appointments" ADD CONSTRAINT "vet_appointments_veterinarianId_fkey" FOREIGN KEY ("veterinarianId") REFERENCES "veterinarians"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vet_appointments" ADD CONSTRAINT "vet_appointments_customerPetId_fkey" FOREIGN KEY ("customerPetId") REFERENCES "customer_pets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_logs" ADD CONSTRAINT "payment_logs_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_logs" ADD CONSTRAINT "payment_logs_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;
