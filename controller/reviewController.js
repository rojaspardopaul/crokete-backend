// controller/reviewController.js
const { moderateReview, AUTO_APPROVE_THRESHOLD } = require("../lib/ai/reviewModerator");
const { invalidateReviews } = require("../lib/cache/invalidation");
const { getPrisma, getPrismaNamespace } = require("../lib/prisma");
const { reviewToApi } = require("../lib/prisma/presenters");
const { isUuid } = require("../lib/prisma/helpers");

const reviews = () => getPrisma().review;

/** Datos de cliente y producto que acompañan a la reseña en cada vista. */
const USER_SELECT = { id: true, name: true, email: true, image: true };
const PRODUCT_SELECT = { id: true, title: true, image: true, slug: true };

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Recalculate product average_rating and total_reviews using ONLY approved reviews.
 */
const updateProductRating = async (productId) => {
  if (!isUuid(productId)) return;

  const result = await reviews().aggregate({
    where: { productId, status: "approved" },
    _avg: { rating: true },
    _count: { _all: true },
  });

  await getPrisma().product.update({
    where: { id: productId },
    data: {
      averageRating: result._avg.rating ?? 0,
      totalReviews: result._count._all,
    },
  });
};

/** Título multi-idioma → texto para el moderador. */
const productNameOf = (product) => product?.title?.es || product?.title?.en || "";

/**
 * Aplica el veredicto del moderador. Vive aparte porque alta y edición hacen
 * exactamente lo mismo en segundo plano.
 */
const applyModeration = async (reviewId, productId, aiResult) => {
  const data = {
    aiAnalysis: aiResult,
    // El veredicto también se guarda en su propia columna para poder filtrar
    // por él sin tener que abrir el jsonb.
    aiSuggestedAction: aiResult?.suggestedAction || null,
  };

  // Auto-approve if AI is highly confident it's legitimate
  if (
    aiResult.suggestedAction === "approved_suggestion" &&
    aiResult.confidence >= AUTO_APPROVE_THRESHOLD
  ) {
    data.status = "approved";
  }

  await reviews().update({ where: { id: reviewId }, data });

  // Recalculate if auto-approved
  if (data.status === "approved") {
    await updateProductRating(productId);
    invalidateReviews();
  }
};

// ─── Customer-facing ─────────────────────────────────────────────────────────

const addReview = async (req, res) => {
  try {
    const { product, images, rating, comment, title, displayName } = req.body;
    const user = req.user._id;

    if (!isUuid(product)) {
      return res.status(400).json({ error: "Producto no válido" });
    }
    if (!isUuid(user)) {
      return res.status(401).json({ error: "Sesión inválida" });
    }

    const review = await reviews().create({
      data: {
        productId: product,
        images: (images || []).slice(0, 5),
        rating: Number(rating),
        comment,
        title: (title || "").slice(0, 100),
        displayName: (displayName || "").slice(0, 50),
        customerId: user,
        status: "pending",
      },
    });

    // AI moderation — async, never blocks creation
    let productName = "";
    try {
      const prod = await getPrisma().product.findUnique({
        where: { id: product },
        select: { title: true },
      });
      productName = productNameOf(prod);
    } catch (_) { /* ignore */ }

    moderateReview({ title, comment, rating, productName })
      .then((aiResult) => applyModeration(review.id, product, aiResult))
      .catch((err) => {
        console.error("⚠️ AI moderation background error:", err.message);
      });

    invalidateReviews();
    res.status(201).json(reviewToApi(review));
  } catch (error) {
    // Una reseña por cliente y producto: el índice único lo garantiza ahora en
    // la base, y se traduce a un mensaje entendible en vez de un error crudo.
    if (error.code === "P2002") {
      return res.status(409).json({ error: "Ya has reseñado este producto." });
    }
    res.status(400).json({ error: error.message });
  }
};

const getUserPurchasedProducts = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 30 } = req.query;
    const halfLimit = Math.floor(parseInt(limit) / 2);
    const skipReviewed = (parseInt(page) - 1) * halfLimit;
    const skipNotReviewed = skipReviewed;

    if (!isUuid(userId)) {
      return res.status(401).json({ success: false, message: "Sesión inválida" });
    }

    // Sólo se puede reseñar lo que se recibió. Las líneas del pedido ya son
    // filas, así que la lista de productos comprados sale de una sola consulta.
    const items = await getPrisma().orderItem.findMany({
      where: {
        productId: { not: null },
        order: { customerId: userId, status: "entregado" },
      },
      select: {
        productId: true,
        title: true,
        image: true,
        order: { select: { createdAt: true } },
      },
      orderBy: { order: { createdAt: "desc" } },
    });

    const uniqueItemsMap = new Map();
    for (const item of items) {
      if (!uniqueItemsMap.has(item.productId)) {
        uniqueItemsMap.set(item.productId, {
          _id: item.productId,
          title: item.title,
          image: item.image,
        });
      }
    }
    const uniqueItems = Array.from(uniqueItemsMap.values());

    const productIds = uniqueItems.map((item) => item._id);
    const userReviews = await reviews().findMany({
      where: { customerId: userId, productId: { in: productIds } },
      select: {
        id: true,
        productId: true,
        rating: true,
        comment: true,
        title: true,
        displayName: true,
        status: true,
        createdAt: true,
      },
    });

    const reviewMap = new Map();
    for (const r of userReviews) {
      reviewMap.set(r.productId, reviewToApi(r));
    }

    const reviewedList = [];
    const notReviewedList = [];
    for (const item of uniqueItems) {
      const review = reviewMap.get(item._id) || null;
      const fullItem = { ...item, review };
      if (review) reviewedList.push(fullItem);
      else notReviewedList.push(fullItem);
    }

    res.status(200).json({
      success: true,
      page: parseInt(page),
      limit: parseInt(limit),
      reviewed: reviewedList.slice(skipReviewed, skipReviewed + halfLimit),
      notReviewed: notReviewedList.slice(skipNotReviewed, skipNotReviewed + halfLimit),
      totalReviewed: reviewedList.length,
      totalNotReviewed: notReviewedList.length,
    });
  } catch (error) {
    console.error("Error fetching purchased products:", error.message);
    res.status(500).json({ success: false, message: "Error del servidor" });
  }
};

/**
 * Public endpoint — returns ONLY approved reviews for a product.
 */
const getReviewsByProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    if (!isUuid(productId)) return res.json([]);

    const rows = await reviews().findMany({
      where: { productId, status: "approved" },
      include: { customer: { select: { id: true, name: true, image: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(rows.map(reviewToApi));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateReview = async (req, res) => {
  try {
    const { rating, images, comment, reviewId, title, displayName } = req.body;
    const user = req.user._id;

    if (!isUuid(reviewId) || !isUuid(user)) {
      return res.status(404).json({ error: "Reseña no encontrada" });
    }

    // La condición incluye al dueño: nadie puede editar la reseña de otro.
    const updated = await reviews().updateMany({
      where: { id: reviewId, customerId: user },
      data: {
        rating: Number(rating),
        comment,
        title: (title || "").slice(0, 100),
        displayName: (displayName || "").slice(0, 50),
        images: (images || []).slice(0, 5),
        status: "pending", // re-queue for moderation
        // Se borra el análisis anterior: la reseña vuelve a la cola.
        aiAnalysis: getPrismaNamespace().DbNull,
        aiSuggestedAction: null,
      },
    });
    if (updated.count === 0) {
      return res.status(404).json({ error: "Reseña no encontrada" });
    }

    const review = await reviews().findUnique({ where: { id: reviewId } });

    // Re-run AI moderation in background
    let productName = "";
    try {
      const prod = await getPrisma().product.findUnique({
        where: { id: review.productId },
        select: { title: true },
      });
      productName = productNameOf(prod);
    } catch (_) { /* ignore */ }

    moderateReview({ title, comment, rating, productName })
      .then((aiResult) => applyModeration(review.id, review.productId, aiResult))
      .catch(() => {});

    await updateProductRating(review.productId);
    invalidateReviews();
    res.json(reviewToApi(review));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const deleteReview = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user._id;

    if (!isUuid(id) || !isUuid(user)) {
      return res.status(404).json({ error: "Reseña no encontrada" });
    }

    const review = await reviews().findUnique({ where: { id } });
    if (!review || review.customerId !== user) {
      return res.status(404).json({ error: "Reseña no encontrada" });
    }

    await reviews().delete({ where: { id } });

    await updateProductRating(review.productId);
    invalidateReviews();
    res.json({ message: "Reseña eliminada" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const toggleHelpful = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return res.status(404).json({ error: "Reseña no encontrada" });

    const review = await reviews().update({
      where: { id },
      data: { helpfulVotes: { increment: 1 } },
    });
    res.json({ helpfulVotes: review.helpfulVotes });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Reseña no encontrada" });
    }
    res.status(500).json({ error: error.message });
  }
};

// ─── Admin ───────────────────────────────────────────────────────────────────

/** Columnas por las que el panel puede ordenar. */
const SORTABLE = ["createdAt", "updatedAt", "rating", "helpfulVotes", "status"];

/**
 * Paginated review list with filters for admin moderation panel.
 */
const getAdminReviews = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      rating,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const where = {};

    if (status && status !== "all") {
      where.status = status;
    }
    if (rating) {
      where.rating = parseInt(rating);
    }
    if (search) {
      where.OR = [
        { comment: { contains: search, mode: "insensitive" } },
        { title: { contains: search, mode: "insensitive" } },
        { displayName: { contains: search, mode: "insensitive" } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const orderBy = {
      [SORTABLE.includes(sortBy) ? sortBy : "createdAt"]:
        sortOrder === "asc" ? "asc" : "desc",
    };

    const [rows, totalDoc] = await Promise.all([
      reviews().findMany({
        where,
        include: {
          customer: { select: USER_SELECT },
          product: { select: PRODUCT_SELECT },
        },
        orderBy,
        skip,
        take: limitNum,
      }),
      reviews().count({ where }),
    ]);

    res.json({
      reviews: rows.map(reviewToApi),
      totalDoc,
      limits: limitNum,
      pages: Math.ceil(totalDoc / limitNum),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Aprobar y rechazar sólo se diferencian en el estado resultante y en cuándo
 * se guarda la nota: al aprobar se acepta vaciarla, al rechazar sólo se escribe
 * si trae texto (comportamiento heredado).
 */
const setReviewStatus = (status, keepEmptyNote) => async (req, res) => {
  try {
    const { id } = req.params;
    const { adminNote } = req.body;
    const writeNote = keepEmptyNote ? adminNote !== undefined : !!adminNote;

    if (!isUuid(id)) return res.status(404).json({ error: "Reseña no encontrada" });

    const review = await reviews().update({
      where: { id },
      data: {
        status,
        ...(writeNote && { adminNote }),
      },
    });

    await updateProductRating(review.productId);
    invalidateReviews();
    res.json(reviewToApi(review));
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Reseña no encontrada" });
    }
    res.status(500).json({ error: error.message });
  }
};

const approveReview = setReviewStatus("approved", true);
const rejectReview = setReviewStatus("rejected", false);

/**
 * Review statistics for admin dashboard.
 */
const getReviewStats = async (req, res) => {
  try {
    const [statusCounts, ratingDistribution, recentPending] = await Promise.all([
      reviews().groupBy({ by: ["status"], _count: { _all: true } }),
      reviews().groupBy({
        by: ["rating"],
        where: { status: "approved" },
        _count: { _all: true },
        orderBy: { rating: "desc" },
      }),
      reviews().count({ where: { status: "pending" } }),
    ]);

    const byStatus = {};
    for (const s of statusCounts) {
      byStatus[s.status] = s._count._all;
    }

    const byRating = {};
    for (const r of ratingDistribution) {
      byRating[r.rating] = r._count._all;
    }

    res.json({
      byStatus: {
        pending: byStatus.pending || 0,
        approved: byStatus.approved || 0,
        rejected: byStatus.rejected || 0,
      },
      byRating,
      recentPending,
      total: (byStatus.pending || 0) + (byStatus.approved || 0) + (byStatus.rejected || 0),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  addReview,
  updateReview,
  deleteReview,
  getReviewsByProduct,
  getUserPurchasedProducts,
  toggleHelpful,
  getAdminReviews,
  approveReview,
  rejectReview,
  getReviewStats,
};
