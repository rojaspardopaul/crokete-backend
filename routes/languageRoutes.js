const express = require('express');
const router = express.Router();
const { adminOnlyMutations } = require('../config/routeGuards');

const {
  addLanguage,
  addAllLanguage,
  getAllLanguages,
  getShowingLanguage,
  getLanguageById,
  updateLanguage,
  updateStatus,
  deleteLanguage,
  updateManyLanguage,
  deleteManyLanguage,
} = require('../controller/languageController');

// Las lecturas son públicas (la tienda necesita la lista de idiomas); crear,
// editar y borrar exige administrador. Antes este router no tenía ninguna
// guarda: se podía escribir sin autenticarse.
router.use(adminOnlyMutations());

// add a language
router.post('/add', addLanguage);

// add all language
router.post('/add/all', addAllLanguage);

// get only showing language
router.get('/show', getShowingLanguage);

// get all language
router.get('/all', getAllLanguages);

// get a language
router.get('/:id', getLanguageById);

// update a language
router.put('/:id', updateLanguage);

// update many language
router.patch('/update/many', updateManyLanguage);

// show/hide a language
router.put('/status/:id', updateStatus);

// delete a language
router.patch('/:id', deleteLanguage);

//delete many language
router.patch('/delete/many', deleteManyLanguage);

module.exports = router;
