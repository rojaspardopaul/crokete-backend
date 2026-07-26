require("dotenv").config();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const CONFIG = require("../config");
const {
  tokenForVerify,
  generateAccessToken,
  generateRefreshToken,
} = require("../config/auth");
const { sendEmail } = require("../lib/email-sender/sender");
const {
  customerRegisterBody,
} = require("../lib/email-sender/templates/register");
const {
  forgetPasswordEmailBody,
} = require("../lib/email-sender/templates/forget-password");
const { sendVerificationCode } = require("../lib/phone-verification/sender");
const { getPrisma, getPrismaNamespace } = require("../lib/prisma");
const { customerToApi } = require("../lib/prisma/presenters");
const { isUuid } = require("../lib/prisma/helpers");

const customers = () => getPrisma().customer;

/** El correo es único en la base y siempre se guarda en minúsculas. */
const byEmail = (email) => ({ email: String(email || "").toLowerCase() });

/**
 * Nunca se devuelve el hash de la contraseña. Mongoose lo incluía en cada
 * respuesta (`findById` devolvía el documento completo); aquí se excluye en
 * origen para que no pueda escaparse por un endpoint nuevo.
 */
const PUBLIC = { omit: { password: true } };

/**
 * Las rutas de perfil y dirección van bajo `isAuth`, que sólo comprueba que haya
 * una sesión válida — no de quién es el `:id` de la URL. Sin esto, cualquier
 * cliente autenticado podía leer y modificar la ficha de otro: sus datos de
 * contacto, su dirección y, cambiándole el correo, quedarse con la cuenta.
 *
 * El panel usa estos mismos endpoints, así que se permite también al
 * administrador. Clientes y administradores viven en tablas distintas, de modo
 * que un id de cliente nunca casará con una fila de admin.
 */
async function puedeAccederAlCliente(req, customerId) {
  const solicitante = req.user?._id;
  if (!isUuid(solicitante) || !isUuid(customerId)) return false;
  if (solicitante === customerId) return true;

  const admin = await getPrisma().admin.findFirst({
    where: { id: solicitante, status: "activo" },
    select: { id: true },
  });
  return !!admin;
}

/** 404 en vez de 403: no confirma si ese cliente existe. */
const NO_AUTORIZADO = { message: "¡Cliente no encontrado!" };

const verifyEmailAddress = async (req, res) => {
  const isAdded = await customers().findUnique({ where: byEmail(req.body.email) });
  if (isAdded) {
    return res.status(403).send({
      message: "Este correo electrónico ya está registrado.",
    });
  } else {
    const token = tokenForVerify(req.body);
    const option = {
      name: req.body.name,
      email: req.body.email,
      token: token,
    };
    const body = {
      from: CONFIG.EMAIL.FROM,
      to: `${req.body.email}`,
      subject: "Verifica tu Correo Electrónico",
      html: customerRegisterBody(option),
    };

    const message = "¡Por favor, revisa tu correo electrónico para verificar tu cuenta!";
    sendEmail(body, res, message);
  }
};

const verifyPhoneNumber = async (req, res) => {
  const phoneNumber = req.body.phone;

  // Check if phone number is provided and is in the correct format
  if (!phoneNumber) {
    return res.status(400).send({
      message: "El número de teléfono es requerido.",
    });
  }

  try {
    // Check if the phone number is already associated with an existing customer
    // (el teléfono no es único en la base, por eso findFirst y no findUnique).
    const isAdded = await customers().findFirst({ where: { phone: phoneNumber } });

    if (isAdded) {
      return res.status(403).send({
        message: "Este número de teléfono ya está registrado.",
      });
    }

    // Generate a random 6-digit verification code
    const verificationCode = Math.floor(
      100000 + Math.random() * 900000
    ).toString();

    // Send verification code via SMS
    const sent = await sendVerificationCode(phoneNumber, verificationCode);

    if (!sent) {
      return res.status(500).send({
        message: "No se pudo enviar el código de verificación.",
      });
    }

    const message = "¡Revisa tu teléfono para ver el código de verificación!";
    return res.send({ message });
  } catch (err) {
    console.error("Error during phone verification:", err);
    res.status(500).send({
      message: err.message,
    });
  }
};

const registerCustomer = async (req, res) => {
  const token = req.params.token;
  try {
    // Verificar firma ANTES de usar el payload — previene tokens forjados
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET_FOR_VERIFY);
    } catch {
      return res.status(401).send({
        message: "El enlace de verificación ha expirado o es inválido. Por favor, regístrate de nuevo.",
      });
    }

    const { name, email, password, phone } = decoded;

    // Si el usuario ya existe, devolver sesión sin exponer la contraseña
    const existing = await customers().findUnique({ where: byEmail(email), ...PUBLIC });
    if (existing) {
      const existingUser = customerToApi(existing);
      const accessToken = generateAccessToken(existingUser);
      const refreshToken = generateRefreshToken(existingUser);
      return res.send({
        refreshToken,
        token: accessToken,
        _id: existingUser._id,
        name: existingUser.name,
        email: existingUser.email,
        phone: existingUser.phone,
        message: "¡Correo electrónico ya verificado!",
      });
    }

    const newUser = customerToApi(
      await customers().create({
        data: {
          name,
          ...byEmail(email),
          phone,
          password: bcrypt.hashSync(password),
        },
        ...PUBLIC,
      })
    );

    const accessToken = generateAccessToken(newUser);
    const refreshToken = generateRefreshToken(newUser);

    res.send({
      refreshToken,
      token: accessToken,
      _id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      phone: newUser.phone,
      message: "¡Correo verificado! Por favor, inicia sesión ahora.",
    });
  } catch (error) {
    console.error("Error during email verification:", error);
    res.status(500).send({
      message: "Error interno del servidor. Por favor, inténtalo más tarde.",
    });
  }
};

/**
 * Carga masiva de clientes (sólo super admin). En Mongo se borraba la colección
 * entera; en Postgres los pedidos y reseñas referencian al cliente, así que un
 * borrado a ciegas dejaría la base inconsistente. Se conserva la semántica de
 * "reemplazar" pero limitada a los clientes sin historial: los que tienen
 * pedidos, reseñas o mascotas se mantienen.
 */
const addAllCustomers = async (req, res) => {
  try {
    const incoming = Array.isArray(req.body) ? req.body : [];

    const data = incoming.map((c) => ({
      name: c.name,
      ...byEmail(c.email),
      phone: c.phone || null,
      password: c.password ? bcrypt.hashSync(c.password) : null,
      image: c.image || null,
      address: c.address || null,
      country: c.country || null,
      city: c.city || null,
      shippingAddress: c.shippingAddress || undefined,
    }));

    await getPrisma().$transaction([
      getPrisma().customer.deleteMany({
        where: {
          orders: { none: {} },
          reviews: { none: {} },
          pets: { none: {} },
          vetAppointments: { none: {} },
          pointTransactions: { none: {} },
          loyaltyRewards: { none: {} },
        },
      }),
      getPrisma().customer.createMany({ data, skipDuplicates: true }),
    ]);

    res.send({
      message: "¡Clientes agregados correctamente!",
    });
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

const loginCustomer = async (req, res) => {
  try {
    const row = await customers().findUnique({ where: byEmail(req.body.email) });

    if (
      row &&
      row.password &&
      bcrypt.compareSync(req.body.password, row.password)
    ) {
      const customer = customerToApi(row);
      const accessToken = generateAccessToken(customer);
      const refreshToken = generateRefreshToken(customer);
      const { exp } = jwt.decode(accessToken);
      const expiresIn = exp - Math.floor(Date.now() / 1000);

      res.send({
        refreshToken,
        token: accessToken,
        expiresIn,
        _id: customer._id,
        name: customer.name,
        email: customer.email,
        address: customer.address,
        phone: customer.phone,
        image: customer.image,
      });
    } else {
      res.status(401).send({
        message: "¡Usuario o contraseña inválidos!",
        error: "¡Usuario o contraseña inválidos!",
      });
    }
  } catch (err) {
    res.status(500).send({
      message: err.message,
      error: "¡Usuario o contraseña inválidos!",
    });
  }
};

const refreshToken = async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({ message: "Se requiere el token de actualización" });
  }

  try {
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    // Un refresh token emitido antes de la migración lleva un ObjectId de Mongo,
    // que Postgres rechazaría como uuid inválido (500). Se trata como sesión
    // inválida para que el cliente vuelva a iniciar sesión.
    if (!isUuid(decoded.id)) {
      return res.status(401).json({ message: "Token de actualización no válido" });
    }

    const row = await customers().findUnique({ where: { id: decoded.id }, ...PUBLIC });
    if (!row) return res.status(401).json({ message: "Usuario no encontrado" });
    const user = customerToApi(row);

    // Issue new access token
    const accessToken = generateAccessToken(user);
    const { exp } = jwt.decode(accessToken);
    const expiresIn = exp - Math.floor(Date.now() / 1000);

    res.json({
      accessToken,
      expiresIn,
      refreshToken, // reuse old, or generateRefreshToken(user) for rotation
    });
  } catch (err) {
    return res.status(401).json({ message: "Token de actualización no válido" });
  }
};

const forgetPassword = async (req, res) => {
  const found = await customers().findUnique({ where: byEmail(req.body.email), ...PUBLIC });
  if (!found) {
    return res.status(404).send({
      message: "No se encontró un usuario con ese correo electrónico.",
    });
  } else {
    const isAdded = customerToApi(found);
    const token = tokenForVerify(isAdded);
    const option = {
      name: isAdded.name,
      email: isAdded.email,
      token: token,
    };

    const body = {
      from: CONFIG.EMAIL.FROM,
      to: `${req.body.email}`,
      subject: "Restablecer Contraseña",
      html: forgetPasswordEmailBody(option),
    };

    const message = "¡Revisa tu correo electrónico para restablecer tu contraseña!";
    sendEmail(body, res, message);
  }
};

const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return res.status(400).send({ message: "Token y nueva contraseña son requeridos." });
  }
  try {
    // Verificar firma PRIMERO — previene bypass con tokens forjados
    const decoded = jwt.verify(token, process.env.JWT_SECRET_FOR_VERIFY);
    const { email } = decoded;

    const customer = await customers().findUnique({ where: byEmail(email) });
    if (!customer) {
      return res.status(404).send({ message: "Usuario no encontrado." });
    }

    await customers().update({
      where: { id: customer.id },
      data: { password: bcrypt.hashSync(newPassword) },
    });
    res.send({ message: "¡Tu contraseña ha sido cambiada exitosamente! Ahora puedes iniciar sesión." });
  } catch {
    return res.status(401).send({ message: "El enlace ha expirado o es inválido. Por favor, solicita uno nuevo." });
  }
};

const changePassword = async (req, res) => {
  try {
    // req.user viene de isAuth middleware — no se acepta email del body
    if (!isUuid(req.user._id)) {
      return res.status(404).send({ message: "Usuario no encontrado." });
    }
    const customer = await customers().findUnique({ where: { id: req.user._id } });
    if (!customer) {
      return res.status(404).send({ message: "Usuario no encontrado." });
    }
    if (!customer.password) {
      return res.status(403).send({
        message: "Para cambiar la contraseña, necesitas una cuenta con email y contraseña.",
      });
    }
    if (!bcrypt.compareSync(req.body.currentPassword, customer.password)) {
      return res.status(401).send({ message: "Contraseña actual incorrecta." });
    }
    await customers().update({
      where: { id: customer.id },
      data: { password: bcrypt.hashSync(req.body.newPassword) },
    });
    res.send({ message: "¡Contraseña cambiada exitosamente!" });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

const signUpWithOauthProvider = async (req, res) => {
  try {
    // El proveedor OAuth ya verificó el correo: si la cuenta existe se reutiliza
    // y si no se crea. Un upsert evita la carrera de dos accesos simultáneos.
    const user = customerToApi(
      await customers().upsert({
        where: byEmail(req.body.email),
        update: {},
        create: {
          name: req.body.name,
          ...byEmail(req.body.email),
          image: req.body.image,
        },
        ...PUBLIC,
      })
    );

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    const { exp } = jwt.decode(accessToken);
    const expiresIn = exp - Math.floor(Date.now() / 1000);

    res.send({
      refreshToken,
      token: accessToken,
      expiresIn,
      _id: user._id,
      name: user.name,
      email: user.email,
      image: user.image,
    });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

const getAllCustomers = async (req, res) => {
  try {
    const rows = await customers().findMany({
      orderBy: { createdAt: "desc" },
      ...PUBLIC,
    });
    res.send(rows.map(customerToApi));
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

const getCustomerById = async (req, res) => {
  try {
    if (!(await puedeAccederAlCliente(req, req.params.id))) {
      return res.status(404).send(NO_AUTORIZADO);
    }
    const row = await customers().findUnique({ where: { id: req.params.id }, ...PUBLIC });
    if (!row) {
      return res.status(404).send({ message: "¡Cliente no encontrado!" });
    }
    res.send(customerToApi(row));
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

// Shipping address create or update
const addShippingAddress = async (req, res) => {
  try {
    const customerId = req.params.id;
    const newShippingAddress = req.body;

    if (!(await puedeAccederAlCliente(req, customerId))) {
      return res.status(404).send({ message: "Cliente no encontrado." });
    }

    // Build update: save shippingAddress + phone from contact
    const data = { shippingAddress: newShippingAddress };
    if (newShippingAddress.contact) {
      data.phone = newShippingAddress.contact;
    }

    // Mongo hacía `upsert: true`, que podía crear un cliente fantasma sólo con
    // el id. En Postgres `name` y `email` son obligatorios, así que si no existe
    // se responde 404 en vez de inventar un registro incompleto.
    const updated = await customers().updateMany({ where: { id: customerId }, data });

    if (updated.count === 0) {
      return res.status(404).send({ message: "Cliente no encontrado." });
    }

    return res.send({
      message: "¡Dirección de envío guardada correctamente!",
    });
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

const getShippingAddress = async (req, res) => {
  try {
    const customerId = req.params.id;

    if (!(await puedeAccederAlCliente(req, customerId))) {
      return res.send({ shippingAddress: undefined });
    }

    const customer = await customers().findUnique({
      where: { id: customerId },
      select: { shippingAddress: true },
    });
    res.send({ shippingAddress: customer?.shippingAddress ?? undefined });
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

/**
 * PUT y DELETE de dirección de envío.
 *
 * La versión heredada usaba `req.activeDB`, una propiedad que ningún middleware
 * define, así que ambas rutas respondían siempre 500. El cliente guarda una
 * única dirección de envío (así estaba embebida en Mongo y así quedó en la
 * columna jsonb), de modo que actualizar es reemplazarla y eliminar es dejarla
 * vacía; el `:shippingId` de la ruta se mantiene por compatibilidad de firma.
 */
const updateShippingAddress = async (req, res) => {
  try {
    const customerId = req.params.userId || req.params.id;
    if (!(await puedeAccederAlCliente(req, customerId))) {
      return res.status(404).send({ message: "Cliente no encontrado." });
    }

    const updated = await customers().updateMany({
      where: { id: customerId },
      data: { shippingAddress: req.body },
    });
    if (updated.count === 0) {
      return res.status(404).send({ message: "Cliente no encontrado." });
    }

    res.send({ message: "¡Listo!" });
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

const deleteShippingAddress = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!(await puedeAccederAlCliente(req, userId))) {
      return res.status(404).send({ message: "Cliente no encontrado." });
    }

    // `DbNull` escribe NULL en la columna; `null` a secas Prisma lo rechaza en
    // un campo Json para evitar la ambigüedad con el JSON `null`.
    const updated = await customers().updateMany({
      where: { id: userId },
      data: { shippingAddress: getPrismaNamespace().DbNull },
    });
    if (updated.count === 0) {
      return res.status(404).send({ message: "Cliente no encontrado." });
    }

    res.send({ message: "¡Dirección de envío eliminada correctamente!" });
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

const updateCustomer = async (req, res) => {
  try {
    const { name, email, address, phone, image } = req.body;

    if (!(await puedeAccederAlCliente(req, req.params.id))) {
      return res.status(404).send(NO_AUTORIZADO);
    }
    const customer = await customers().findUnique({ where: { id: req.params.id } });
    if (!customer) {
      return res.status(404).send({ message: "¡Cliente no encontrado!" });
    }

    if (email) {
      const existingCustomer = await customers().findUnique({ where: byEmail(email) });
      if (existingCustomer && existingCustomer.id !== customer.id) {
        return res.status(400).send({ message: "El correo electrónico ya está registrado." });
      }
    }

    // Sólo se escriben los campos presentes: Mongoose ignoraba las asignaciones
    // `undefined`, mientras que Prisma las escribiría como NULL.
    const data = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) Object.assign(data, byEmail(email));
    if (address !== undefined) data.address = address;
    if (phone !== undefined) data.phone = phone;
    if (image !== undefined) data.image = image;

    const updated = customerToApi(
      await customers().update({ where: { id: customer.id }, data, ...PUBLIC })
    );

    const accessToken = generateAccessToken(updated);
    const refreshToken = generateRefreshToken(updated);

    res.send({
      refreshToken,
      token: accessToken,
      _id: updated._id,
      name: updated.name,
      email: updated.email,
      address: updated.address,
      phone: updated.phone,
      image: updated.image,
      message: "¡Cliente actualizado correctamente!",
    });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

const deleteCustomer = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) {
      return res.status(404).send({ message: "Usuario no encontrado" });
    }

    const found = await customers().findUnique({ where: { id: req.params.id } });
    if (!found) {
      return res.status(404).send({ message: "Usuario no encontrado" });
    }

    // Los pedidos referencian al cliente y son un histórico contable: no se
    // borran en cascada. Mongo permitía dejar pedidos huérfanos; Postgres lo
    // impide, así que se explica el motivo en vez de devolver el error crudo.
    const orderCount = await getPrisma().order.count({ where: { customerId: found.id } });
    if (orderCount > 0) {
      return res.status(409).send({
        message:
          "No se puede eliminar un cliente con pedidos registrados. Los pedidos son un histórico de la tienda.",
      });
    }

    await customers().delete({ where: { id: found.id } });

    res.status(200).send({
      message: "¡Usuario eliminado correctamente!",
    });
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

module.exports = {
  loginCustomer,
  refreshToken,
  verifyPhoneNumber,
  registerCustomer,
  addAllCustomers,
  signUpWithOauthProvider,
  verifyEmailAddress,
  forgetPassword,
  changePassword,
  resetPassword,
  getAllCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
  addShippingAddress,
  getShippingAddress,
  updateShippingAddress,
  deleteShippingAddress,
};
