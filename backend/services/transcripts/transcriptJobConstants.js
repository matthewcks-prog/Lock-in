const JOB_STATUS = {
  CREATED: 'created',
  UPLOADING: 'uploading',
  UPLOADED: 'uploaded',
  PROCESSING: 'processing',
  DONE: 'done',
  ERROR: 'error',
  CANCELED: 'canceled',
};

const UPLOADABLE_STATUSES = new Set([JOB_STATUS.CREATED, JOB_STATUS.UPLOADING]);

module.exports = {
  JOB_STATUS,
  UPLOADABLE_STATUSES,
};
