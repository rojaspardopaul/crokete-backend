-- Eventos que los controladores de pago emiten desde siempre pero que faltaban
-- en el enum heredado de Mongoose: la validación fallaba y el `.catch()` de
-- logPaymentEvent se tragaba el error, así que los intentos de fraude y los
-- pagos inválidos de Razorpay eran justo los que nunca quedaban registrados.
ALTER TYPE "PaymentEvent" ADD VALUE IF NOT EXISTS 'ORDER_AMOUNT_MISMATCH';
ALTER TYPE "PaymentEvent" ADD VALUE IF NOT EXISTS 'RAZORPAY_SIGNATURE_INVALID';
ALTER TYPE "PaymentEvent" ADD VALUE IF NOT EXISTS 'RAZORPAY_PAYMENT_INVALID';
ALTER TYPE "PaymentEvent" ADD VALUE IF NOT EXISTS 'RAZORPAY_VERIFY_ERROR';
