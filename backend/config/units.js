const { TWO, TEN } = require('../constants/numbers');

const KIBIBYTE = Math.pow(TWO, TEN);
const MEBIBYTE = KIBIBYTE * KIBIBYTE;

module.exports = {
  KIBIBYTE,
  MEBIBYTE,
};
