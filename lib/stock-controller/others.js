require("dotenv").config();
const { getPrisma } = require("../prisma");
const { isUuid } = require("../prisma/helpers");

/**
 * Descuenta inventario tras confirmarse un pedido.
 *
 * El descuento se hace en una sola sentencia SQL con GREATEST(0, …), de modo que
 * la lectura y la escritura ocurren dentro de la misma operación atómica: dos
 * pedidos simultáneos del mismo producto ya no pueden dejar el stock negativo.
 * Todo el carrito viaja en una transacción, así que o se aplica entero o no se
 * aplica nada — antes cada línea se actualizaba por separado.
 */
const handleProductQuantity = async (cart) => {
  if (!cart?.length) return;

  const prisma = getPrisma();

  try {
    await prisma.$transaction(async (tx) => {
      for (const item of cart) {
        const productId = item?._id || item?.id;
        const quantity = Number(item?.quantity) || 0;
        if (!isUuid(productId) || quantity <= 0) continue;

        await tx.$executeRaw`
          UPDATE products
          SET stock = GREATEST(0, stock - ${quantity}),
              sales = sales + ${quantity}
          WHERE id = ${productId}::uuid`;

        // En productos con combinación se descuenta también la variante concreta,
        // identificada por el código que el carrito arrastra (variant.productId).
        const variantRef = item?.variant?.productId;
        if (item?.isCombination && variantRef) {
          await tx.$executeRaw`
            UPDATE product_variants
            SET quantity = GREATEST(0, quantity - ${quantity})
            WHERE "productId" = ${productId}::uuid
              AND "refCode" = ${String(variantRef)}`;
        }
      }
    });
  } catch (err) {
    console.error("[Stock] Error en handleProductQuantity:", err.message);
  }
};

/**
 * Elimina las variantes que apuntaban a un valor de atributo borrado.
 *
 * Las combinaciones se guardan como {"<attributeId>": "<attributeValueId>"} en
 * la columna jsonb `attributes`, así que basta con borrar las filas cuya clave
 * coincida — el equivalente del $pull sobre el array embebido anterior.
 */
const handleProductAttribute = async (key, value, multi) => {
  const prisma = getPrisma();

  try {
    const valueList = multi ? (Array.isArray(value) ? value : [value]) : [value];
    const wanted = valueList.map(String).filter(Boolean);
    if (!key || wanted.length === 0) return;

    await prisma.$executeRaw`
      DELETE FROM product_variants
      WHERE attributes ->> ${String(key)} = ANY(${wanted})`;
  } catch (err) {
    console.log("err, when delete product variants", err.message);
  }
};

module.exports = {
  handleProductQuantity,
  handleProductAttribute,
};
