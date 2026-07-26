const { getPrisma } = require("../prisma");
const { readSetting } = require("../prisma/settings");
const { isUuid } = require("../prisma/helpers");
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
  const orderId = order?._id || order?.id;
  // `user` es el cliente ya poblado o su id suelto, según de dónde venga el pedido.
  const customerId = order?.user?._id || order?.user?.id || order?.user || order?.customerId;

  // 1. Loyalty coupon restore on cancel / un-cancel (synchronous to avoid races)
  if (newStatus === "cancelado" || previousStatus === "cancelado") {
    try {
      const rewards = getPrisma().loyaltyReward;

      if (newStatus === "cancelado" && isUuid(orderId)) {
        // El cupón vuelve a estar disponible: se libera el que se había gastado
        // en este pedido. `updateMany` porque el filtro no es la clave única.
        await rewards.updateMany({
          where: { orderId, used: true },
          data: { used: false, usedAt: null, orderId: null },
        });
      } else if (previousStatus === "cancelado" && order.loyaltyCouponCode) {
        // Se reactiva el pedido: el cupón se vuelve a marcar como usado, pero
        // sólo si sigue libre y sin caducar.
        await rewards.updateMany({
          where: {
            couponCode: order.loyaltyCouponCode,
            ...(isUuid(customerId) ? { customerId } : {}),
            used: false,
            expiresAt: { gt: new Date() },
          },
          data: {
            used: true,
            usedAt: new Date(),
            orderId: isUuid(orderId) ? orderId : null,
          },
        });
      }
    } catch (loyaltyErr) {
      console.error("[Order] Coupon restore error:", loyaltyErr.message);
    }
  }

  // 2. Loyalty points hook (async, non-blocking)
  processOrderLoyalty(String(orderId), newStatus, previousStatus).catch((err) =>
    console.error("[Loyalty] Hook error:", err.message)
  );

  // 3. Status-change email for key transitions (async, non-blocking)
  const EMAIL_STATUSES = ["en_reparto", "entregado"];
  if (EMAIL_STATUSES.includes(newStatus) && order.user_info?.email) {
    (async () => {
      try {
        const setting = await readSetting("storeSetting");
        const currency = setting?.default_currency || "$";
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
