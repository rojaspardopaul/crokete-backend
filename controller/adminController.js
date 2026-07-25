const bcrypt = require("bcryptjs");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
dayjs.extend(utc);
const jwt = require("jsonwebtoken");
const CONFIG = require("../config");
const {
  signInToken,
  tokenForVerify,
  handleEncryptData,
} = require("../config/auth");
const { sendEmail } = require("../lib/email-sender/sender");
const { 
  recordFailedAttempt, 
  resetLoginAttempts 
} = require("../lib/security/rateLimiter");
const { 
  logAction, 
  getIpFromRequest, 
  getUserAgentFromRequest,
  getChanges 
} = require("../lib/security/auditLogger");
const { getPrisma } = require("../lib/prisma");
const { adminToApi, roleToDb, roleToApi } = require("../lib/prisma/presenters");
const { isUuid } = require("../lib/prisma/helpers");

const admins = () => getPrisma().admin;

/** El email es único en la base y siempre se guarda en minúsculas. */
const byEmail = (email) => ({ email: String(email || "").toLowerCase() });

const registerAdmin = async (req, res) => {
  try {
    const isAdded = await admins().findUnique({ where: byEmail(req.body.email) });
    if (isAdded) {
      return res.status(403).send({
        message: "Este correo electrónico ya está registrado",
      });
    }

    const staff = await admins().create({
      data: {
        name: req.body.name,
        ...byEmail(req.body.email),
        role: roleToDb(req.body.role) || "admin",
        password: bcrypt.hashSync(req.body.password),
        // Todo administrador necesita al menos un permiso; sin ninguno no
        // podría siquiera entrar al panel.
        accessList:
          req.body.access_list?.length > 0
            ? req.body.access_list
            : ["dashboard", "edit-profile"],
      },
    });

    const presented = adminToApi(staff);
    const token = signInToken(presented);
    res.send({
      token,
      _id: presented._id,
      name: presented.name,
      email: presented.email,
      role: presented.role,
      joiningData: Date.now(),
      access_list: presented.access_list,
    });
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const ip = getIpFromRequest(req);
    const userAgent = getUserAgentFromRequest(req);

    const row = await admins().findUnique({ where: byEmail(email) });
    const admin = row ? adminToApi(row) : null;

    if (row && bcrypt.compareSync(password, row.password)) {
      if (admin?.status === "inactivo") {
        // Record failed attempt for inactive account
        await recordFailedAttempt(email, ip);
        
        // Log failed login (inactive account)
        await logAction({
          adminId: admin._id,
          adminEmail: admin.email,
          adminName: admin.name,
          action: "LOGIN_FAILED",
          ip,
          userAgent,
          status: "failure",
          errorMessage: "Cuenta inactiva",
        });
        
        return res.status(403).send({
          message:
            "Lo sentimos, no tienes acceso en este momento. Por favor contacta al Super Administrador.",
        });
      }

      // Successful login - reset attempts
      await resetLoginAttempts(email, ip);

      // Log successful login
      await logAction({
        adminId: admin._id,
        adminEmail: admin.email,
        adminName: admin.name,
        action: "LOGIN_SUCCESS",
        ip,
        userAgent,
      });

      const token = signInToken(admin);
      const { data, iv } = handleEncryptData([
        ...admin?.access_list,
        admin.role,
      ]);
      
      res.send({
        token,
        _id: admin._id,
        name: admin.name,
        phone: admin.phone,
        email: admin.email,
        image: admin.image,
        iv,
        data,
      });
    } else {
      // Failed login - record attempt
      await recordFailedAttempt(email, ip);
      
      // Log failed login attempt
      if (admin) {
        await logAction({
          adminId: admin._id,
          adminEmail: admin.email,
          adminName: admin.name,
          action: "LOGIN_FAILED",
          ip,
          userAgent,
          status: "failure",
          errorMessage: "Contraseña inválida",
        });
      }
      
      res.status(401).send({
        message: "Correo electrónico o contraseña incorrectos",
      });
    }
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

const forgetPassword = async (req, res) => {
  const found = await admins().findUnique({ where: byEmail(req.body.verifyEmail) });
  const isAdded = found ? adminToApi(found) : null;
  if (!isAdded) {
    return res.status(404).send({
      message: "No se encontró ningún administrador con este correo electrónico",
    });
  } else {
    const token = tokenForVerify(isAdded);
    const resetUrl = process.env.ADMIN_URL + '/reset-password/' + token;
    const logo = CONFIG.CLOUDINARY.getImageUrl(CONFIG.CLOUDINARY.IMAGES.LOGO);
    const company = CONFIG.COMPANY.NAME;
    const year = new Date().getFullYear();
    const bc = '#3B82F6';
    const bd = '#1E3A5F';
    const bg = '#F1F5F9';
    const tp = '#1E293B';
    const ts = '#64748B';
    const body = {
      from: CONFIG.EMAIL.FROM,
      to: `${req.body.verifyEmail}`,
      subject: "Restablecer Contraseña de Administrador",
      html: '<!DOCTYPE html>'
+ '<html xmlns="http://www.w3.org/1999/xhtml" lang="es"><head>'
+ '<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>'
+ '<title>Restablecer Contraseña - ' + company + '</title></head>'
+ '<body style="margin:0;padding:0;background-color:' + bg + ';font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">'
+ '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:' + bg + ';"><tr><td align="center" style="padding:32px 16px;">'
+ '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">'
+ '<tr><td bgcolor="' + bd + '" style="background-color:' + bd + ';background:linear-gradient(135deg,' + bd + ' 0%,' + bc + ' 100%);padding:32px 40px;border-radius:12px 12px 0 0;text-align:center;">'
+ '<img src="' + logo + '" alt="' + company + '" width="120" style="display:block;margin:0 auto 16px;max-width:120px;height:auto;"/>'
+ '<h1 style="margin:0;font-size:22px;font-weight:700;color:#FFFFFF;">Restablecer Contraseña</h1>'
+ '<p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.8);">Panel de Administración</p>'
+ '</td></tr>'
+ '<tr><td style="background-color:#FFFFFF;padding:0;">'
+ '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
+ '<td style="padding:36px 40px 0;text-align:center;">'
+ '<div style="display:inline-block;width:64px;height:64px;border-radius:50%;background-color:' + bg + ';line-height:64px;font-size:28px;">&#128274;</div>'
+ '</td></tr></table>'
+ '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
+ '<td style="padding:20px 40px 8px;text-align:center;">'
+ '<h2 style="margin:0;font-size:18px;font-weight:700;color:' + tp + ';">Hola ' + req.body.verifyEmail + '</h2>'
+ '<p style="margin:12px 0 0;font-size:14px;color:' + ts + ';line-height:1.6;">Se ha recibido una solicitud para restablecer la contraseña de tu cuenta de administrador en <strong>' + company + '</strong>.</p>'
+ '</td></tr></table>'
+ '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
+ '<td style="padding:28px 40px;text-align:center;">'
+ '<a href="' + resetUrl + '" style="display:inline-block;background-color:' + bc + ';color:#FFFFFF;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:8px;">Restablecer Contraseña</a>'
+ '</td></tr></table>'
+ '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
+ '<td style="padding:0 40px 8px;text-align:center;">'
+ '<p style="margin:0;font-size:12px;color:' + ts + ';">Si el botón no funciona, copia y pega este enlace:</p>'
+ '<p style="margin:6px 0 0;font-size:12px;color:' + bc + ';word-break:break-all;"><a href="' + resetUrl + '" style="color:' + bc + ';text-decoration:none;">' + resetUrl + '</a></p>'
+ '</td></tr></table>'
+ '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:20px 40px 28px;">'
+ '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:' + bg + ';border-radius:8px;border-left:4px solid #EF4444;"><tr><td style="padding:16px 20px;">'
+ '<p style="margin:0;font-size:13px;color:' + ts + ';line-height:1.5;"><strong>Importante:</strong> Este enlace expirará en 15 minutos. Si no solicitaste este cambio, contáctanos en <a href="mailto:' + CONFIG.COMPANY.SUPPORT_EMAIL + '" style="color:' + bc + ';font-weight:600;text-decoration:none;">' + CONFIG.COMPANY.SUPPORT_EMAIL + '</a></p>'
+ '</td></tr></table></td></tr></table>'
+ '</td></tr>'
+ '<tr><td style="background-color:' + bd + ';padding:28px 40px;border-radius:0 0 12px 12px;text-align:center;">'
+ '<p style="margin:0 0 6px;font-size:12px;color:rgba(255,255,255,0.7);">Correo enviado desde el panel de administración de ' + company + '.</p>'
+ '<p style="margin:0;font-size:11px;color:rgba(255,255,255,0.5);">&copy; ' + year + ' ' + company + '. Todos los derechos reservados.</p>'
+ '</td></tr>'
+ '</table></td></tr></table></body></html>',
    };
    const message = "Por favor revisa tu correo electrónico para restablecer tu contraseña";
    sendEmail(body, res, message);
  }
};

const resetPassword = async (req, res) => {
  const token = req.body.token;
  if (!token) {
    return res.status(400).send({ message: "Token requerido" });
  }

  try {
    // Se verifica la firma ANTES de tocar la base: antes se cargaba el usuario
    // a partir de un token sin validar.
    jwt.verify(token, process.env.JWT_SECRET_FOR_VERIFY);
  } catch (err) {
    return res.status(500).send({
      message: "El token ha expirado, por favor intenta de nuevo",
    });
  }

  try {
    const { email } = jwt.decode(token);
    const staff = await admins().findUnique({ where: byEmail(email) });
    if (!staff) {
      return res.status(404).send({ message: "Administrador no encontrado" });
    }

    await admins().update({
      where: { id: staff.id },
      data: { password: bcrypt.hashSync(req.body.newPassword) },
    });

    res.send({
      message: "Tu contraseña ha sido cambiada exitosamente. Ya puedes iniciar sesión",
    });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

const addStaff = async (req, res) => {
  try {
    const isAdded = await admins().findUnique({ where: byEmail(req.body.email) });
    if (isAdded) {
      return res.status(500).send({
        message: "Este correo electrónico ya está registrado",
      });
    }

    // Validate role - only super admin can assign any role
    const allowedRoles = [
      "admin",
      "super admin",
      "cashier",
      "manager",
      "ceo",
      "driver",
      "security guard",
      "accountant",
    ];

    if (!allowedRoles.includes(req.body.role)) {
      return res.status(400).send({
        message: "Rol especificado no válido",
      });
    }

    // Access list validation - ensure it's not empty
    if (!req.body.access_list || req.body.access_list.length === 0) {
      return res.status(400).send({
        message: "La lista de accesos no puede estar vacía. El personal debe tener al menos un permiso.",
      });
    }

    const created = await admins().create({
      data: {
        name: { ...req.body.name },
        ...byEmail(req.body.email),
        password: bcrypt.hashSync(req.body.password),
        phone: req.body.phone,
        joiningDate: req.body.joiningDate ? new Date(req.body.joiningDate) : null,
        role: roleToDb(req.body.role),
        image: req.body.image,
        accessList: req.body.access_list,
      },
    });
    const newStaff = adminToApi(created);

    // Log admin creation
    await logAction({
      adminId: req.user._id,
      adminEmail: req.user.email,
      adminName: req.user.name,
      action: "CREATE_ADMIN",
      targetId: newStaff._id,
      targetEmail: newStaff.email,
      targetRole: newStaff.role,
      changes: {
        role: newStaff.role,
        access_list: newStaff.access_list,
      },
      ip: getIpFromRequest(req),
      userAgent: getUserAgentFromRequest(req),
    });

    res.status(200).send({
      message: "Personal agregado exitosamente",
    });
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

const getAllStaff = async (req, res) => {
  try {
    const rows = await admins().findMany({ orderBy: { createdAt: "desc" } });
    res.send(rows.map(adminToApi));
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

const getStaffById = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) {
      return res.status(404).send({ message: "Personal no encontrado" });
    }
    const row = await admins().findUnique({ where: { id: req.params.id } });
    if (!row) return res.status(404).send({ message: "Personal no encontrado" });
    res.send(adminToApi(row));
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

const updateStaff = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) {
      return res.status(404).send({ message: "Personal no encontrado" });
    }
    const current = await admins().findUnique({ where: { id: req.params.id } });

    if (!current) {
      return res.status(404).send({
        message: "Personal no encontrado",
      });
    }
    const admin = adminToApi(current);

    // Prevent modifying another super admin unless you're also a super admin
    // This is already enforced by isSuperAdmin middleware, but double-check
    if (current.role === "super_admin" && req.user._id !== current.id) {
      const requestingAdmin = isUuid(req.user._id)
        ? await admins().findUnique({ where: { id: req.user._id } })
        : null;
      if (!requestingAdmin || requestingAdmin.role !== "super_admin") {
        return res.status(403).send({
          message: "Solo los super administradores pueden modificar otras cuentas de super administrador",
        });
      }
    }

    // Capture old values for audit log
    const oldValues = {
      name: admin.name,
      email: admin.email,
      phone: admin.phone,
      role: admin.role,
      access_list: admin.access_list,
    };

    // Update fields
    const updated = await admins().update({
      where: { id: req.params.id },
      data: {
        name: { ...(current.name || {}), ...(req.body.name || {}) },
        ...(req.body.email !== undefined ? byEmail(req.body.email) : {}),
        phone: req.body.phone,
        role: roleToDb(req.body.role),
        accessList: req.body.access_list,
        joiningDate: req.body.joiningDate ? new Date(req.body.joiningDate) : null,
        image: req.body.image,
      },
    });
    const updatedAdmin = adminToApi(updated);

    // Log admin update
    const changes = getChanges(oldValues, {
      name: updatedAdmin.name,
      email: updatedAdmin.email,
      phone: updatedAdmin.phone,
      role: updatedAdmin.role,
      access_list: updatedAdmin.access_list,
    });


    await logAction({
      adminId: req.user._id,
      adminEmail: req.user.email,
      adminName: req.user.name,
      action: oldValues.role !== updatedAdmin.role ? "UPDATE_ROLE" : "UPDATE_ADMIN",
      targetId: updatedAdmin._id,
      targetEmail: updatedAdmin.email,
      targetRole: updatedAdmin.role,
      changes,
      ip: getIpFromRequest(req),
      userAgent: getUserAgentFromRequest(req),
    });
    const token = signInToken(updatedAdmin);

    const { data, iv } = handleEncryptData([
      ...updatedAdmin?.access_list,
      updatedAdmin.role,
    ]);
    
    res.send({
      token,
      _id: updatedAdmin._id,
      name: updatedAdmin.name,
      email: updatedAdmin.email,
      image: updatedAdmin.image,
      data,
      iv,
    });
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

const deleteStaff = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) {
      return res.status(404).send({ message: "Personal no encontrado" });
    }
    const found = await admins().findUnique({ where: { id: req.params.id } });

    if (!found) {
      return res.status(404).send({
        message: "Personal no encontrado",
      });
    }
    const adminToDelete = adminToApi(found);

    // Prevent deleting the last super admin
    if (found.role === "super_admin") {
      const superAdminCount = await admins().count({ where: { role: "super_admin" } });
      if (superAdminCount <= 1) {
        return res.status(403).send({
          message: "No se puede eliminar al último super administrador. Debe existir al menos un super administrador.",
        });
      }
    }

    await admins().delete({ where: { id: req.params.id } });

    // Log admin deletion
    await logAction({
      adminId: req.user._id,
      adminEmail: req.user.email,
      adminName: req.user.name,
      action: "DELETE_ADMIN",
      targetId: adminToDelete._id,
      targetEmail: adminToDelete.email,
      targetRole: adminToDelete.role,
      ip: getIpFromRequest(req),
      userAgent: getUserAgentFromRequest(req),
    });

    res.status(200).send({
      message: "Administrador eliminado exitosamente",
    });
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

const updatedStatus = async (req, res) => {
  try {
    const newStatus = req.body.status;
    if (!isUuid(req.params.id)) {
      return res.status(404).send({ message: "Personal no encontrado" });
    }
    const found = await admins().findUnique({ where: { id: req.params.id } });

    if (!found) {
      return res.status(404).send({
        message: "Personal no encontrado",
      });
    }
    const adminToUpdate = adminToApi(found);

    // Prevent deactivating the last super admin
    if (found.role === "super_admin" && newStatus === "inactivo") {
      const activeSuperAdminCount = await admins().count({
        where: { role: "super_admin", status: "activo" },
      });
      if (activeSuperAdminCount <= 1) {
        return res.status(403).send({
          message: "No se puede desactivar al último super administrador activo. Debe permanecer al menos un super administrador activo.",
        });
      }
    }

    await admins().update({ where: { id: req.params.id }, data: { status: newStatus } });

    // Log status update
    await logAction({
      adminId: req.user._id,
      adminEmail: req.user.email,
      adminName: req.user.name,
      action: "UPDATE_STATUS",
      targetId: adminToUpdate._id,
      targetEmail: adminToUpdate.email,
      targetRole: adminToUpdate.role,
      changes: {
        status: {
          old: adminToUpdate.status,
          new: newStatus,
        },
      },
      ip: getIpFromRequest(req),
      userAgent: getUserAgentFromRequest(req),
    });

    res.send({
      message: `Estado del personal actualizado a ${newStatus} exitosamente`,
    });
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

// Get current admin's own profile
const getMyProfile = async (req, res) => {
  try {
    if (!isUuid(req.user._id)) {
      return res.status(404).send({ message: "Administrador no encontrado" });
    }
    const row = await admins().findUnique({ where: { id: req.user._id } });

    if (!row) {
      return res.status(404).send({
        message: "Administrador no encontrado",
      });
    }

    // adminToApi ya descarta la contraseña.
    res.send(adminToApi(row));
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

// Update current admin's own profile (cannot change role)
const updateMyProfile = async (req, res) => {
  try {
    if (!isUuid(req.user._id)) {
      return res.status(404).send({ message: "Administrador no encontrado" });
    }
    const current = await admins().findUnique({ where: { id: req.user._id } });

    if (!current) {
      return res.status(404).send({
        message: "Administrador no encontrado",
      });
    }

    // Only allow updating specific fields (NOT role)
    const updates = {};
    if (req.body.name) updates.name = { ...(current.name || {}), ...req.body.name };
    if (req.body.email) Object.assign(updates, byEmail(req.body.email));
    if (req.body.phone) updates.phone = req.body.phone;
    if (req.body.image) updates.image = req.body.image;

    // Allow password change if provided
    if (req.body.password && req.body.password.trim() !== "") {
      updates.password = bcrypt.hashSync(req.body.password);
    }

    const updatedAdmin = adminToApi(
      await admins().update({ where: { id: req.user._id }, data: updates })
    );
    const token = signInToken(updatedAdmin);

    const { data, iv } = handleEncryptData([
      ...updatedAdmin?.access_list,
      updatedAdmin.role,
    ]);

    res.send({
      token,
      _id: updatedAdmin._id,
      name: updatedAdmin.name,
      email: updatedAdmin.email,
      phone: updatedAdmin.phone,
      image: updatedAdmin.image,
      data,
      iv,
      message: "Perfil actualizado exitosamente",
    });
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

module.exports = {
  registerAdmin,
  loginAdmin,
  forgetPassword,
  resetPassword,
  addStaff,
  getAllStaff,
  getStaffById,
  updateStaff,
  deleteStaff,
  updatedStatus,
  getMyProfile,
  updateMyProfile,
};
