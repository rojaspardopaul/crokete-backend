const { getPrisma } = require("../lib/prisma");
const { toApi } = require("../lib/prisma/presenters");
const { isUuid, uuidList, fail, notFound } = require("../lib/prisma/helpers");

const prisma = () => getPrisma().coupon;

function toRow(body) {
  const row = {};
  if (body.title !== undefined) row.title = body.title;
  if (body.logo !== undefined) row.logo = body.logo;
  if (body.couponCode !== undefined) row.couponCode = body.couponCode;
  if (body.startTime !== undefined) row.startTime = body.startTime ? new Date(body.startTime) : null;
  if (body.endTime !== undefined) row.endTime = new Date(body.endTime);
  if (body.discountType !== undefined) row.discountType = body.discountType;
  if (body.minimumAmount !== undefined) row.minimumAmount = Number(body.minimumAmount) || 0;
  if (body.productType !== undefined) row.productType = body.productType;
  if (body.status !== undefined) row.status = body.status;
  return row;
}

const addCoupon = async (req, res) => {
  try {
    await prisma().create({ data: toRow(req.body) });
    res.send({ message: "¡Cupón agregado correctamente!" });
  } catch (err) {
    fail(res, err);
  }
};

const addAllCoupon = async (req, res) => {
  try {
    await prisma().deleteMany();
    await prisma().createMany({ data: (req.body || []).map(toRow) });
    res.status(200).send({ message: "¡Cupón agregado correctamente!" });
  } catch (err) {
    fail(res, err);
  }
};

const getAllCoupons = async (req, res) => {
  try {
    // `status` es un enum: coincidencia exacta en vez del regex que usaba Mongo.
    const { status } = req.query;
    const where = status === "show" || status === "hide" ? { status } : {};
    const rows = await prisma().findMany({ where, orderBy: { createdAt: "desc" } });
    res.send(rows.map(toApi));
  } catch (err) {
    fail(res, err);
  }
};

const getShowingCoupons = async (req, res) => {
  try {
    const rows = await prisma().findMany({
      where: { status: "show" },
      orderBy: { createdAt: "desc" },
    });
    res.send(rows.map(toApi));
  } catch (err) {
    fail(res, err);
  }
};

const getCouponById = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return notFound(res, "¡Cupón no encontrado!");
    const row = await prisma().findUnique({ where: { id: req.params.id } });
    if (!row) return notFound(res, "¡Cupón no encontrado!");
    res.send(toApi(row));
  } catch (err) {
    fail(res, err);
  }
};

const updateCoupon = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return notFound(res, "¡Cupón no encontrado!");
    const current = await prisma().findUnique({ where: { id: req.params.id } });
    if (!current) return notFound(res, "¡Cupón no encontrado!");

    const data = toRow(req.body);
    if (req.body.title !== undefined) {
      data.title = { ...(current.title || {}), ...(req.body.title || {}) };
    }

    await prisma().update({ where: { id: req.params.id }, data });
    res.send({ message: "¡Cupón actualizado correctamente!" });
  } catch (err) {
    fail(res, err, 404);
  }
};

const updateManyCoupons = async (req, res) => {
  try {
    const data = {};
    if (req.body.status !== undefined) data.status = req.body.status;
    if (req.body.startTime !== undefined) {
      data.startTime = req.body.startTime ? new Date(req.body.startTime) : null;
    }
    if (req.body.endTime !== undefined) data.endTime = new Date(req.body.endTime);

    await prisma().updateMany({ where: { id: { in: uuidList(req.body.ids) } }, data });
    res.send({ message: "¡Cupones actualizados correctamente!" });
  } catch (err) {
    fail(res, err);
  }
};

const updateStatus = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return notFound(res, "¡Cupón no encontrado!");
    const status = req.body.status;
    await prisma().update({ where: { id: req.params.id }, data: { status } });
    res.status(200).send({
      message: `Cupón ${status === "show" ? "publicado" : "ocultado"} correctamente!`,
    });
  } catch (err) {
    fail(res, err);
  }
};

const deleteCoupon = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return notFound(res, "¡Cupón no encontrado!");
    await prisma().delete({ where: { id: req.params.id } });
    res.status(200).send({ message: "¡Cupón eliminado correctamente!" });
  } catch (err) {
    fail(res, err);
  }
};

const deleteManyCoupons = async (req, res) => {
  try {
    await prisma().deleteMany({ where: { id: { in: uuidList(req.body.ids) } } });
    res.send({ message: "¡Cupones eliminados correctamente!" });
  } catch (err) {
    fail(res, err);
  }
};

module.exports = {
  addCoupon,
  addAllCoupon,
  getAllCoupons,
  getShowingCoupons,
  getCouponById,
  updateCoupon,
  updateStatus,
  deleteCoupon,
  updateManyCoupons,
  deleteManyCoupons,
};
