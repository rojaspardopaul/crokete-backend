const express = require("express");
const router = express.Router();
const {
  addBrand,
  addAllBrands,
  getAllBrands,
  getShowingBrands,
  getBrandById,
  updateBrand,
  updateStatus,
  deleteBrand,
  deleteManyBrands,
  updateManyBrands,
} = require("../controller/brandController");

// add a brand
router.post("/add", addBrand);

// add multiple brands
router.post("/all", addAllBrands);

// get showing brands only
router.get("/show", getShowingBrands);

// get all brands
router.get("/", getAllBrands);

// get a brand by id
router.get("/:id", getBrandById);

// update a brand
router.put("/:id", updateBrand);

// update brand status
router.put("/status/:id", updateStatus);

// delete a brand
router.delete("/:id", deleteBrand);

// delete many brands
router.patch("/delete/many", deleteManyBrands);

// update many brands
router.patch("/update/many", updateManyBrands);

module.exports = router;
