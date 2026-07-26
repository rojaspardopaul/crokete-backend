-- El folio del pedido es el número que el cliente ve en su correo y en su
-- factura. En Mongo lo llevaba mongoose-sequence empezando en 10000 y llegó
-- hasta 10036; los pedidos no se migraron, así que la secuencia nativa
-- arrancaría de nuevo en 1 y los folios nuevos repetirían los ya emitidos.
--
-- Se continúa la numeración donde la dejó la tienda anterior.
SELECT setval('orders_invoice_seq', 10036, true);
