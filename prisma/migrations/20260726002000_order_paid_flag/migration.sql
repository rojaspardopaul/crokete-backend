-- El agregado Order del módulo DDD usa `paid` como guarda de idempotencia del
-- pago (un webhook repetido no debe descontar stock ni otorgar puntos dos
-- veces), pero no existía columna donde persistirla: sólo vivía en memoria.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "paid" BOOLEAN NOT NULL DEFAULT false;
