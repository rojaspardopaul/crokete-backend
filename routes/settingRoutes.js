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
} = require("../controller/settingController");

/**
 * Global Settings
 */
router
  .route("/global")
  .post(addGlobalSetting) // POST /global
  .get(getGlobalSetting) // GET /global
  .put(updateGlobalSetting); // PUT /global

/**
 * Store Settings
 */
router
  .route("/store-setting")
  .post(addStoreSetting) // POST /store-setting
  .get(getStoreSetting) // GET /store-setting
  .put(updateStoreSetting); // PUT /store-setting

router.get("/store-setting/keys", getStoreSecretKeys); // GET /store-setting/keys
router.get("/store-setting/seo", getStoreSeoSetting); // GET /store-setting/seo

/**
 * Store Customization
 */
router
  .route("/store/customization")
  .post(addStoreCustomizationSetting) // POST /store/customization
  .get(getStoreCustomizationSetting) // GET /store/customization
  .put(updateStoreCustomizationSetting); // PUT /store/customization

module.exports = router;
