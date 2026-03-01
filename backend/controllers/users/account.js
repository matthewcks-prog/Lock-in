const HTTP_STATUS = require('../../constants/httpStatus');
const { accountService } = require('../../services/users/accountService');

// DELETE /api/users/me
async function deleteMyAccount(req, res, next) {
  try {
    const userId = req.user?.id;
    await accountService.deleteMyAccount({ userId });
    res.status(HTTP_STATUS.NO_CONTENT).send();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  deleteMyAccount,
};
