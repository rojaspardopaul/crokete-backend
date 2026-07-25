const { getPrisma } = require("../lib/prisma");
const { currencyToApi } = require("../lib/prisma/presenters");
const { isUuid, uuidList, fail, notFound } = require("../lib/prisma/helpers");

const prisma = () => getPrisma().currency;

/** El panel envía `live_exchange_rates`; en la base la columna es camelCase. */
function toRow(body) {
  const row = {};
  if (body.name !== undefined) row.name = body.name;
  if (body.symbol !== undefined) row.symbol = body.symbol;
  if (body.status !== undefined) row.status = body.status;
  if (body.live_exchange_rates !== undefined) {
    row.liveExchangeRates = body.live_exchange_rates;
  }
  return row;
}

const addCurrency = async (req, res) => {
  try {
    await prisma().create({ data: toRow(req.body) });
    res.send({ message: "¡Moneda agregada correctamente!" });
  } catch (err) {
    fail(res, err);
  }
};

const addAllCurrency = async (req, res) => {
  try {
    await prisma().createMany({ data: (req.body || []).map(toRow) });
    res.send({ message: "¡Monedas agregadas correctamente!" });
  } catch (err) {
    fail(res, err);
  }
};

const getAllCurrency = async (req, res) => {
  try {
    const rows = await prisma().findMany();
    res.send(rows.map(currencyToApi));
  } catch (err) {
    fail(res, err);
  }
};

const getShowingCurrency = async (req, res) => {
  try {
    const rows = await prisma().findMany({
      where: { status: "show" },
      orderBy: { createdAt: "desc" },
    });
    res.send(rows.map(currencyToApi));
  } catch (err) {
    fail(res, err);
  }
};

const getCurrencyById = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return notFound(res, "Moneda no encontrada.");
    const row = await prisma().findUnique({ where: { id: req.params.id } });
    if (!row) return notFound(res, "Moneda no encontrada.");
    res.send(currencyToApi(row));
  } catch (err) {
    fail(res, err);
  }
};

const updateCurrency = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return notFound(res, "Moneda no encontrada.");
    await prisma().update({ where: { id: req.params.id }, data: toRow(req.body) });
    res.send({ message: "¡Moneda actualizada correctamente!" });
  } catch (err) {
    fail(res, err);
  }
};

const updateManyCurrency = async (req, res) => {
  try {
    const data = {};
    if (req.body.status !== undefined) data.status = req.body.status;
    if (req.body.live_exchange_rates !== undefined) {
      data.liveExchangeRates = req.body.live_exchange_rates;
    }
    await prisma().updateMany({ where: { id: { in: uuidList(req.body.ids) } }, data });
    res.send({ message: "¡Monedas actualizadas correctamente!" });
  } catch (err) {
    fail(res, err);
  }
};

const updateEnabledStatus = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return notFound(res, "Moneda no encontrada.");
    const status = req.body.status;
    await prisma().update({ where: { id: req.params.id }, data: { status } });
    res.status(200).send({
      message: `Moneda ${status === "show" ? "publicada" : "ocultada"} correctamente!`,
    });
  } catch (err) {
    fail(res, err);
  }
};

const updateLiveExchangeRateStatus = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return notFound(res, "Moneda no encontrada.");
    const status = req.body.live_exchange_rates;
    await prisma().update({
      where: { id: req.params.id },
      data: { liveExchangeRates: status },
    });
    res.status(200).send({
      message: `Moneda ${status === "show" ? "publicada" : "ocultada"} correctamente!`,
    });
  } catch (err) {
    fail(res, err);
  }
};

const deleteCurrency = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return notFound(res, "Moneda no encontrada.");
    await prisma().delete({ where: { id: req.params.id } });
    res.send({ message: "¡Moneda eliminada correctamente!" });
  } catch (err) {
    fail(res, err);
  }
};

const deleteManyCurrency = async (req, res) => {
  try {
    await prisma().deleteMany({ where: { id: { in: uuidList(req.body.ids) } } });
    res.send({ message: "¡Moneda eliminada correctamente!" });
  } catch (err) {
    fail(res, err);
  }
};

module.exports = {
  addCurrency,
  addAllCurrency,
  getAllCurrency,
  getShowingCurrency,
  getCurrencyById,
  updateCurrency,
  updateManyCurrency,
  updateEnabledStatus,
  updateLiveExchangeRateStatus,
  deleteCurrency,
  deleteManyCurrency,
};
