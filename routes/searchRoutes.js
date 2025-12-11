const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');

router.get('/', searchController.renderSearchPage);
router.post('/parse', searchController.parse); // parse Q-coded text into questions/options
router.post('/search-selected', searchController.searchSelected); // run Serper for selected answers

module.exports = router;
