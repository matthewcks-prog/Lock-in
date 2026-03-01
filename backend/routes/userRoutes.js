const express = require('express');
const { requireSupabaseUser } = require('../middleware/authMiddleware');
const { deleteMyAccount } = require('../controllers/users/account');

const router = express.Router();

router.use(requireSupabaseUser);
router.delete('/users/me', deleteMyAccount);

module.exports = router;
