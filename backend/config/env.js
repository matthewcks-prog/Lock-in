const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';
const IS_DEVELOPMENT = NODE_ENV === 'development';

module.exports = {
  NODE_ENV,
  IS_PRODUCTION,
  IS_DEVELOPMENT,
};
