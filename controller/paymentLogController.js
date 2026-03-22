const PaymentLog = require("../models/PaymentLog");

const getPaymentLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      event,
      status,
      startDate,
      endDate,
      search,
    } = req.query;

    const filter = {};

    if (event) filter.event = event;
    if (status) filter.status = status;

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    if (search) {
      filter.$or = [
        { userEmail: { $regex: search, $options: "i" } },
        { stripePaymentIntentId: { $regex: search, $options: "i" } },
      ];
    }

    const pages = Number(page);
    const limits = Number(limit);
    const skip = (pages - 1) * limits;

    const [logs, totalDoc] = await Promise.all([
      PaymentLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limits)
        .lean(),
      PaymentLog.countDocuments(filter),
    ]);

    res.send({ logs, totalDoc, page: pages, limit: limits });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

const getPaymentLogsByOrder = async (req, res) => {
  try {
    const logs = await PaymentLog.find({ orderId: req.params.orderId })
      .sort({ createdAt: -1 })
      .lean();
    res.send(logs);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

module.exports = { getPaymentLogs, getPaymentLogsByOrder };
