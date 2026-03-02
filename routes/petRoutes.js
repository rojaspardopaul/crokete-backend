const express = require("express");
const router = express.Router();
const {
  addPet,
  addAllPets,
  getAllPets,
  getShowingPets,
  getPetById,
  updatePet,
  updateStatus,
  deletePet,
  deleteManyPets,
  updateManyPets,
} = require("../controller/petController");

// add a pet
router.post("/add", addPet);

// add multiple pets
router.post("/all", addAllPets);

// get showing pets only
router.get("/show", getShowingPets);

// get all pets
router.get("/", getAllPets);

// get a pet by id
router.get("/:id", getPetById);

// update a pet
router.put("/:id", updatePet);

// update pet status
router.put("/status/:id", updateStatus);

// delete a pet
router.delete("/:id", deletePet);

// delete many pets
router.patch("/delete/many", deleteManyPets);

// update many pets
router.patch("/update/many", updateManyPets);

module.exports = router;
