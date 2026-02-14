require("dotenv").config();
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");

const signInToken = (user) => {
  return jwt.sign(
    {
      _id: user._id,
      name: user.name,
      email: user.email,
      address: user.address,
      phone: user.phone,
      image: user.image,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "1d",
    }
  );
};

const generateAccessToken = (user) => {
  return jwt.sign(
    {
      _id: user._id,
      name: user.name,
      email: user.email,
      address: user.address,
      phone: user.phone,
      image: user.image,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_ACCESS_LIFETIME || "1d" } // extended to 1 day to match NextAuth session
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user._id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_LIFETIME || "7d" } // longer-lived
  );
};

const tokenForVerify = (user) => {
  return jwt.sign(
    {
      _id: user._id,
      name: user.name,
      email: user.email,
      password: user.password,
      phone: user.phone,
    },
    process.env.JWT_SECRET_FOR_VERIFY,
    { expiresIn: "15m" }
  );
};

const isAuth = async (req, res, next) => {
  const { authorization } = req.headers;
  // console.log("authorization", req.headers);
  console.log(`🔍isAuth ${req.method} : ${req.originalUrl}`);
  try {
    const token = authorization.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.log("error on isAuth", err);

    const message = err.name === "TokenExpiredError" 
      ? "Tu sesión ha expirado. Por favor, inicia sesión nuevamente."
      : err.name === "JsonWebTokenError"
      ? "Sesión inválida. Por favor, inicia sesión nuevamente."
      : err.message;

    res.status(401).send({
      message,
    });
  }
};

const isAdmin = async (req, res, next) => {
  const admin = await Admin.findOne({ role: "Admin" });
  if (admin) {
    next();
  } else {
    res.status(401).send({
      message: "User is not Admin",
    });
  }
};

const isSuperAdmin = async (req, res, next) => {
  console.log(`🔍isSuperAdmin ${req.method} : ${req.originalUrl}`);
  try {
    if (!req.user) {
      return res.status(401).send({
        message: "Authentication required",
      });
    }

    // Fetch the admin from database to verify current role
    const admin = await Admin.findById(req.user._id);
    
    if (!admin) {
      return res.status(404).send({
        message: "Admin not found",
      });
    }

    if (admin.role !== "super admin") {
      return res.status(403).send({
        message: "Access denied. Super Admin privileges required.",
      });
    }

    // Add admin to request for use in controllers
    req.admin = admin;
    next();
  } catch (err) {
    console.log("error on isSuperAdmin", err);
    res.status(500).send({
      message: err.message,
    });
  }
};

const secretKey = process.env.ENCRYPT_PASSWORD;

// Ensure the secret key is exactly 32 bytes (256 bits)
const key = crypto.createHash("sha256").update(secretKey).digest();

// Helper function to encrypt data
const handleEncryptData = (data) => {
  // Generate a NEW initialization vector for each encryption
  const iv = crypto.randomBytes(16); // AES-CBC requires a 16-byte IV
  
  // Ensure the input is a string or convert it to a string
  const dataToEncrypt = typeof data === "string" ? data : JSON.stringify(data);

  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let encryptedData = cipher.update(dataToEncrypt, "utf8", "hex");
  encryptedData += cipher.final("hex");

  return {
    data: encryptedData,
    iv: iv.toString("hex"),
  };
};

module.exports = {
  isAuth,
  isAdmin,
  isSuperAdmin,
  signInToken,
  tokenForVerify,
  handleEncryptData,
  generateAccessToken,
  generateRefreshToken,
};
