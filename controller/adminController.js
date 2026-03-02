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
const Admin = require("../models/Admin");

const registerAdmin = async (req, res) => {
  try {
    const isAdded = await Admin.findOne({ email: req.body.email });
    if (isAdded) {
      return res.status(403).send({
        message: "Este correo electrónico ya está registrado",
      });
    } else {
      const newStaff = new Admin({
        name: req.body.name,
        email: req.body.email,
        role: req.body.role,
        password: bcrypt.hashSync(req.body.password),
        access_list: req.body.access_list?.length > 0 ? req.body.access_list : ['dashboard', 'edit-profile'], // any new admin must have at least one access right, otherwise he will not be able to login
      });
      const staff = await newStaff.save();
      const token = signInToken(staff);
      res.send({
        token,
        _id: staff._id,
        name: staff.name,
        email: staff.email,
        role: staff.role,
        joiningData: Date.now(),
        access_list: staff.access_list,
      });
    }
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

    const admin = await Admin.findOne({ email });
    
    if (admin && bcrypt.compareSync(password, admin.password)) {
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
  const isAdded = await Admin.findOne({ email: req.body.verifyEmail });
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
  const { email } = jwt.decode(token);
  const staff = await Admin.findOne({ email: email });

  if (token) {
    jwt.verify(token, process.env.JWT_SECRET_FOR_VERIFY, (err, decoded) => {
      if (err) {
        return res.status(500).send({
          message: "El token ha expirado, por favor intenta de nuevo",
        });
      } else {
        staff.password = bcrypt.hashSync(req.body.newPassword);
        staff.save();
        res.send({
          message: "Tu contraseña ha sido cambiada exitosamente. Ya puedes iniciar sesión",
        });
      }
    });
  }
};

const addStaff = async (req, res) => {
  try {
    const isAdded = await Admin.findOne({ email: req.body.email });
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

    const newStaff = new Admin({
      name: { ...req.body.name },
      email: req.body.email,
      password: bcrypt.hashSync(req.body.password),
      phone: req.body.phone,
      joiningDate: req.body.joiningDate,
      role: req.body.role,
      image: req.body.image,
      access_list: req.body.access_list,
    });
    await newStaff.save();

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
  // console.log('allamdin')
  try {
    const admins = await Admin.find({}).sort({ _id: -1 });
    res.send(admins);
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

const getStaffById = async (req, res) => {
  try {
    const admin = await Admin.findById(req.params.id);
    res.send(admin);
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

const updateStaff = async (req, res) => {
  try {
    const admin = await Admin.findOne({ _id: req.params.id });

    if (!admin) {
      return res.status(404).send({
        message: "Personal no encontrado",
      });
    }

    // Prevent modifying another super admin unless you're also a super admin
    // This is already enforced by isSuperAdmin middleware, but double-check
    if (admin.role === "super admin" && req.user._id !== admin._id.toString()) {
      // Only super admins can modify other super admins
      const requestingAdmin = await Admin.findById(req.user._id);
      if (requestingAdmin.role !== "super admin") {
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
    admin.name = { ...admin.name, ...req.body.name };
    admin.email = req.body.email;
    admin.phone = req.body.phone;
    admin.role = req.body.role;
    admin.access_list = req.body.access_list;
    admin.joiningData = req.body.joiningDate;
    admin.image = req.body.image;

    const updatedAdmin = await admin.save();

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
    const adminToDelete = await Admin.findById(req.params.id);
    
    if (!adminToDelete) {
      return res.status(404).send({
        message: "Personal no encontrado",
      });
    }

    // Prevent deleting the last super admin
    if (adminToDelete.role === "super admin") {
      const superAdminCount = await Admin.countDocuments({ role: "super admin" });
      if (superAdminCount <= 1) {
        return res.status(403).send({
          message: "No se puede eliminar al último super administrador. Debe existir al menos un super administrador.",
        });
      }
    }

    await Admin.deleteOne({ _id: req.params.id });

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
    const adminToUpdate = await Admin.findById(req.params.id);

    if (!adminToUpdate) {
      return res.status(404).send({
        message: "Personal no encontrado",
      });
    }

    // Prevent deactivating the last super admin
    if (adminToUpdate.role === "super admin" && newStatus === "inactivo") {
      const activeSuperAdminCount = await Admin.countDocuments({ 
        role: "super admin", 
        status: "activo" 
      });
      if (activeSuperAdminCount <= 1) {
        return res.status(403).send({
          message: "No se puede desactivar al último super administrador activo. Debe permanecer al menos un super administrador activo.",
        });
      }
    }

    await Admin.updateOne(
      { _id: req.params.id },
      {
        $set: {
          status: newStatus,
        },
      }
    );

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
    const admin = await Admin.findById(req.user._id).select('-password');
    
    if (!admin) {
      return res.status(404).send({
        message: "Administrador no encontrado",
      });
    }

    res.send(admin);
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

// Update current admin's own profile (cannot change role)
const updateMyProfile = async (req, res) => {
  try {
    const admin = await Admin.findById(req.user._id);
    
    if (!admin) {
      return res.status(404).send({
        message: "Administrador no encontrado",
      });
    }

    // Only allow updating specific fields (NOT role)
    if (req.body.name) admin.name = { ...admin.name, ...req.body.name };
    if (req.body.email) admin.email = req.body.email;
    if (req.body.phone) admin.phone = req.body.phone;
    if (req.body.image) admin.image = req.body.image;
    
    // Allow password change if provided
    if (req.body.password && req.body.password.trim() !== '') {
      admin.password = bcrypt.hashSync(req.body.password);
    }

    const updatedAdmin = await admin.save();
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
