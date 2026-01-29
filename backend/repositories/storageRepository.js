const { supabase } = require('../db/supabaseClient');

function createStorageRepository({ bucket, supabaseClient = supabase } = {}) {
  if (!bucket) {
    throw new Error('Storage repository requires a bucket');
  }

  return {
    async upload(path, data, options = {}) {
      return supabaseClient.storage.from(bucket).upload(path, data, options);
    },
    async remove(paths) {
      return supabaseClient.storage.from(bucket).remove(paths);
    },
    async createSignedUrl(path, expiresInSeconds) {
      return supabaseClient.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
    },
    getPublicUrl(path) {
      return supabaseClient.storage.from(bucket).getPublicUrl(path);
    },
    async download(path) {
      return supabaseClient.storage.from(bucket).download(path);
    },
  };
}

module.exports = {
  createStorageRepository,
};
