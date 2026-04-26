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
const { isAuth, isSuperAdmin } = require("../config/auth");

/**
 * Global Settings — GET es público (store/admin necesitan leer config)
 * POST/PUT requieren super admin
 */
router.get("/global", getGlobalSetting);
router.post("/global", isAuth, isSuperAdmin, addGlobalSetting);
router.put("/global", isAuth, isSuperAdmin, updateGlobalSetting);

/**
 * Store Settings — GET público, escritura requiere super admin
 * /keys devuelve secretos: solo super admin
 */
router.get("/store-setting", getStoreSetting);
router.post("/store-setting", isAuth, isSuperAdmin, addStoreSetting);
router.put("/store-setting", isAuth, isSuperAdmin, updateStoreSetting);

router.get("/store-setting/keys", isAuth, isSuperAdmin, getStoreSecretKeys);
router.get("/store-setting/seo", getStoreSeoSetting);
router.get("/config-status", isAuth, isSuperAdmin, getConfigStatusEndpoint);

/**
 * Store Customization — GET público, escritura requiere super admin
 */
router.get("/store/customization", getStoreCustomizationSetting);
router.post("/store/customization", isAuth, isSuperAdmin, addStoreCustomizationSetting);
router.put("/store/customization", isAuth, isSuperAdmin, updateStoreCustomizationSetting);

module.exports = router;
