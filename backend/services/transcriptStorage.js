const { supabase } = require('../supabaseClient');
const { TRANSCRIPT_JOBS_BUCKET } = require('../config');

const CHUNK_INDEX_PAD = 6;

function getTranscriptJobPrefix(userId, jobId) {
  if (!userId || !jobId) {
    throw new Error('Transcript storage requires userId and jobId');
  }
  return `${userId}/${jobId}`;
}

function getChunkFilename(chunkIndex) {
  const safeIndex = Number.isFinite(chunkIndex) ? chunkIndex : 0;
  const padded = String(safeIndex).padStart(CHUNK_INDEX_PAD, '0');
  return `chunk-${padded}.bin`;
}

function getTranscriptChunkPath({ userId, jobId, chunkIndex }) {
  const prefix = getTranscriptJobPrefix(userId, jobId);
  return `${prefix}/${getChunkFilename(chunkIndex)}`;
}

async function uploadTranscriptChunk({ userId, jobId, chunkIndex, chunk }) {
  const storagePath = getTranscriptChunkPath({ userId, jobId, chunkIndex });
  const { error } = await supabase.storage.from(TRANSCRIPT_JOBS_BUCKET).upload(storagePath, chunk, {
    contentType: 'application/octet-stream',
    upsert: false,
  });

  if (error) {
    throw error;
  }

  return { storagePath };
}

async function downloadTranscriptChunk({ userId, jobId, chunkIndex }) {
  const storagePath = getTranscriptChunkPath({ userId, jobId, chunkIndex });
  const { data, error } = await supabase.storage.from(TRANSCRIPT_JOBS_BUCKET).download(storagePath);

  if (error) {
    throw error;
  }

  if (!data) {
    return Buffer.alloc(0);
  }

  if (Buffer.isBuffer(data)) {
    return data;
  }

  if (data instanceof ArrayBuffer) {
    return Buffer.from(data);
  }

  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer);
  }

  if (typeof data.arrayBuffer === 'function') {
    const buffer = await data.arrayBuffer();
    return Buffer.from(buffer);
  }

  throw new Error('Unsupported transcript chunk payload type');
}

async function removeTranscriptChunks({ userId, jobId, chunkIndices }) {
  if (!Array.isArray(chunkIndices) || chunkIndices.length === 0) {
    return { removed: 0 };
  }

  const paths = chunkIndices.map((chunkIndex) =>
    getTranscriptChunkPath({ userId, jobId, chunkIndex }),
  );
  const { error } = await supabase.storage.from(TRANSCRIPT_JOBS_BUCKET).remove(paths);

  if (error) {
    throw error;
  }

  return { removed: paths.length };
}

module.exports = {
  getTranscriptJobPrefix,
  getTranscriptChunkPath,
  uploadTranscriptChunk,
  downloadTranscriptChunk,
  removeTranscriptChunks,
};
