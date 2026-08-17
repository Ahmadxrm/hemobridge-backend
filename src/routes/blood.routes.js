'use strict';

const express = require('express');
const router = express.Router();
const bloodController = require('../controllers/blood.controller');
const { validate } = require('../middleware/validate');
const { bloodSearchQuerySchema } = require('../validators/blood.validators');

router.get('/search', validate(bloodSearchQuerySchema, 'query'), bloodController.search);

module.exports = router;
