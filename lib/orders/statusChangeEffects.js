const LoyaltyReward = require("../../models/LoyaltyReward");
const Setting = require("../../models/Setting");
const CONFIG = require("../../config");
const { sendEmailAsync } = require("../email-sender/sender");
const orderStatusUpdateEmailBody = require("../email-sender/templates/order-to-customer/order-status-update");
const { processOrderLoyalty } = require("../../controller/loyaltyController");

/**
 * Side effects of an order status change, extracted verbatim from the legacy
 * orderController.updateOrder so it can be reused by both the legacy controller
 * and the new TypeScript orders module (single source of truth, no divergence).
 *
 * @param {object} order            The order document (pre-update is fine; this
 *                                  logic only reads identity/contact/cart fields
 *                                  and the explicit new/previous status params).
 * @param {string} newStatus
 * @param {string} previousStatus
 */
async function applyStatusChangeEffects(order, newStatus, previousStatus) {
  // 1. Loyalty coupon restore on cancel / un-cancel (synchronous to avoid races)
  if (newStatus === "cancelado" || previousStatus === "cancelado") {
    try {
      if (newStatus === "cancelado") {
        await LoyaltyReward.findOneAndUpdate(
          { orderId: order._id, used: true },
          { $set: { used: false, usedAt: null, orderId: null } }
        );
      } else if (previousStatus === "cancelado" && order.loyaltyCouponCode) {
        await LoyaltyReward.findOneAndUpdate(
          {
            couponCode: order.loyaltyCouponCode,
            customer: order.user,
            used: false,
            expiresAt: { $gt: new Date() },
          },
          { $set: { used: true, usedAt: new Date(), orderId: order._id } }
        );
      }
    } catch (loyaltyErr) {
      console.error("[Order] Coupon restore error:", loyaltyErr.message);
    }
  }

  // 2. Loyalty points hook (async, non-blocking)
  processOrderLoyalty(String(order._id), newStatus, previousStatus).catch((err) =>
    console.error("[Loyalty] Hook error:", err.message)
  );

  // 3. Status-change email for key transitions (async, non-blocking)
  const EMAIL_STATUSES = ["en_reparto", "entregado"];
  if (EMAIL_STATUSES.includes(newStatus) && order.user_info?.email) {
    (async () => {
      try {
        const setting = await Setting.findOne({ name: "storeSetting" }).lean();
        const currency = setting?.setting?.default_currency || "$";
        const user = order.user_info || {};

        let addressStr = "";
        if (user.calle || user.colonia || user.municipio) {
          const street = [
            user.calle,
            user.numExterior,
            user.numInterior ? `Int. ${user.numInterior}` : null,
          ]
            .filter(Boolean)
            .join(" ");
          addressStr = [
            street || null,
            user.colonia ? `Col. ${user.colonia}` : null,
            user.municipio,
            user.postalCode ? `C.P. ${user.postalCode}` : null,
            user.estado,
            user.pais,
          ]
            .filter(Boolean)
            .join(", ");
        } else {
          addressStr = [user.address, user.city, user.country, user.zipCode]
            .filter(Boolean)
            .join(", ");
        }

        const subjectMap = {
          en_reparto: `🚚 Tu pedido #${order.invoice} está en camino - ${CONFIG.COMPANY.NAME}`,
          entregado: `✅ Tu pedido #${order.invoice} fue entregado - ${CONFIG.COMPANY.NAME}`,
        };

        const formattedDate = order.createdAt
          ? new Date(order.createdAt).toLocaleDateString("es-MX", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })
          : "N/D";

        await sendEmailAsync({
          from: CONFIG.EMAIL.FROM,
          to: user.email,
          subject: subjectMap[newStatus],
          html: orderStatusUpdateEmailBody({
            invoice: order.invoice,
            name: user.name,
            email: user.email,
            phone: user.contact,
            address: addressStr,
            date: formattedDate,
            cart: order.cart || [],
            subTotal: (order.cart || []).reduce(
              (acc, item) => acc + (item.originalPrice || item.price) * item.quantity,
              0
            ),
            shipping: order.shippingCost || 0,
            discount: order.discount || 0,
            taxRate: order.taxRate || 0,
            taxAmount: order.taxAmount || 0,
            total: order.total || 0,
            method: order.paymentMethod,
            currency,
            status: newStatus,
          }),
        });
        console.log(`[Order] Status email sent to ${user.email} (${newStatus})`);
      } catch (emailErr) {
        console.error("[Order] Status email error:", emailErr.message);
      }
    })();
  }
}

/** Port-shaped adapter injected into the TS UpdateOrderStatus use-case. */
const orderStatusEffectsPort = {
  onStatusChanged: (order, newStatus, previousStatus) =>
    applyStatusChangeEffects(order, newStatus, previousStatus),
};

module.exports = { applyStatusChangeEffects, orderStatusEffectsPort };
