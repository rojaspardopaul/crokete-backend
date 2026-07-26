const express = require('express');
const router = express.Router();
const { adminOnlyMutations } = require('../config/routeGuards');

const {
  addCurrency,
  addAllCurrency,
  getAllCurrency,
  getShowingCurrency,
  getCurrencyById,
  updateCurrency,
  updateManyCurrency,
  updateEnabledStatus,
  updateLiveExchangeRateStatus,
  deleteCurrency,
  deleteManyCurrency,
} = require('../controller/currencyController');

//add a addCurrency
// El montaje sólo exige isAuth, de modo que cualquier cliente autenticado podía
// alterar monedas y tipos de cambio (y con ellos los precios mostrados). Las
// mutaciones pasan a requerir administrador.
router.use(adminOnlyMutations());

router.post('/add', addCurrency);

//add all Currency
router.post('/add/all', addAllCurrency);

//get only showing Currency
router.get('/show', getShowingCurrency);

//get all Currency
router.get('/', getAllCurrency);

//get a Currency
router.get('/:id', getCurrencyById);

//update a Currency
router.put('/:id', updateCurrency);

// update many Currency
router.patch('/update/many', updateManyCurrency);

//delete many product
router.patch('/delete/many', deleteManyCurrency);

//delete a Currency
router.delete('/:id', deleteCurrency);

// show/hide a Currency
router.put('/status/enabled/:id', updateEnabledStatus);

// show/hide a Currency
router.put('/status/live-exchange-rates/:id', updateLiveExchangeRateStatus);

//delete a Currency
router.delete('/:id', deleteCurrency);

module.exports = router;
