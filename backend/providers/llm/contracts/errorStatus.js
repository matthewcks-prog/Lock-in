function getErrorStatus(error) {
  return (
    error?.status ??
    error?.statusCode ??
    error?.response?.status ??
    error?.originalError?.status ??
    error?.originalError?.statusCode ??
    null
  );
}

module.exports = {
  getErrorStatus,
};
