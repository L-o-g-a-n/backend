const { Router } = require('express');
const router = Router();
const controller = require('./controller');

router.post('/', controller.request);

module.exports = router;