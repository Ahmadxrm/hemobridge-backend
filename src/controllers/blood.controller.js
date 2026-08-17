'use strict';

const bloodService = require('../services/blood.service');
const { sendSuccess } = require('../utils/response');

exports.search = async (req, res, next) => {
  try {
    const results = await bloodService.searchBlood(req.query);
    return sendSuccess(res, 200, 'Blood search results fetched successfully', { results });
  } catch (err) {
    next(err);
  }
};
