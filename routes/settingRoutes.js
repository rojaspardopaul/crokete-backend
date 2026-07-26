const router = require("express").Router();
const {
  addGlobalSetting,
  getGlobalSetting,
  updateGlobalSetting,
  addStoreSetting,
  getStoreSetting,
  getStoreSecretKeys,
  updateStoreSetting,
  getStoreSeoSetting,
  addStoreCustomizationSetting,
  getStoreCustomizationSetting,
  updateStoreCustomizationSetting,
  getConfigStatusEndpoint,
} = require("../controller/settingController");
const { isAuth, isSuperAdmin, isStoreInternal } = require("../config/auth");

/**
 * Global Settings — GET es público (store/admin necesitan leer config)
 * POST/PUT requieren super admin
 */
router.get("/global", getGlobalSetting);
router.post("/global", isAuth, isSuperAdmin, addGlobalSetting);
router.put("/global", isAuth, isSuperAdmin, updateGlobalSetting);

/**
 * `?filter=all` devuelve la configuración COMPLETA, secretos incluidos
 * (stripe_secret, google_secret, nextauth_secret): es lo que el panel necesita
 * para rellenar el formulario de ajustes. Sin esta guarda el endpoint era
 * público y servía la clave secreta de Stripe a cualquiera que pidiera la URL.
 *
 * La comprobación va aquí y no en el propio GET para que la tienda siga leyendo
 * la versión filtrada sin autenticarse, que es como funciona hoy.
 */
const requireSuperAdminForFullSetting = (req, res, next) => {
  if (req.query.filter !== "all") return next();
  return isAuth(req, res, () => isSuperAdmin(req, res, next));
};

/**
 * Store Settings — GET público (filtrado), escritura requiere super admin
 * /keys devuelve secretos: solo el servidor de la tienda
 */
router.get("/store-setting", requireSuperAdminForFullSetting, getStoreSetting);
router.post("/store-setting", isAuth, isSuperAdmin, addStoreSetting);
router.put("/store-setting", isAuth, isSuperAdmin, updateStoreSetting);

router.get("/store-setting/keys", isStoreInternal, getStoreSecretKeys);
router.get("/store-setting/seo", getStoreSeoSetting);
router.get("/config-status", isAuth, isSuperAdmin, getConfigStatusEndpoint);

/**
 * Store Customization — GET público, escritura requiere super admin
 */
router.get("/store/customization", getStoreCustomizationSetting);
router.post("/store/customization", isAuth, isSuperAdmin, addStoreCustomizationSetting);
router.put("/store/customization", isAuth, isSuperAdmin, updateStoreCustomizationSetting);

module.exports = router;
