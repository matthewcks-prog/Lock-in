const aiUploadStreamRoot = typeof globalThis !== 'undefined' ? globalThis : self;
const aiUploadStreamRegistry =
  aiUploadStreamRoot.LockInBackground || (aiUploadStreamRoot.LockInBackground = {});
const aiUploadStreamTranscripts =
  aiUploadStreamRegistry.transcripts || (aiUploadStreamRegistry.transcripts = {});

const PROGRESS_CHUNK_INTERVAL = 5;

function mergePendingBytes(pending, value) {
  const combined = new Uint8Array(pending.length + value.length);
  combined.set(pending);
  combined.set(value, pending.length);
  return combined;
}

function reportUploadProgress({ onProgress, totalBytes, uploadedBytes, chunkIndex }) {
  if (!onProgress) return;
  if (totalBytes) {
    onProgress({ percent: Math.round((uploadedBytes / totalBytes) * 100) });
    return;
  }
  if (chunkIndex % PROGRESS_CHUNK_INTERVAL === 0) {
    onProgress({ message: `Uploaded ${chunkIndex} chunks` });
  }
}

async function uploadPendingChunks({
  pending,
  chunkBytes,
  sendChunkWithRetry,
  backendUrl,
  jobId,
  token,
  signal,
  totalChunks,
  uploadedBytes,
  chunkIndex,
  onProgress,
  totalBytes,
}) {
  let nextPending = pending;
  let nextUploadedBytes = uploadedBytes;
  let nextChunkIndex = chunkIndex;
  while (nextPending.length >= chunkBytes) {
    const chunk = nextPending.slice(0, chunkBytes);
    nextPending = nextPending.slice(chunkBytes);
    await sendChunkWithRetry({
      backendUrl,
      jobId,
      token,
      signal,
      chunk,
      index: nextChunkIndex,
      totalChunks,
    });
    nextChunkIndex += 1;
    nextUploadedBytes += chunk.length;
    reportUploadProgress({
      onProgress,
      totalBytes,
      uploadedBytes: nextUploadedBytes,
      chunkIndex: nextChunkIndex,
    });
  }
  return { pending: nextPending, uploadedBytes: nextUploadedBytes, chunkIndex: nextChunkIndex };
}

async function uploadFinalPendingChunk({
  pending,
  sendChunkWithRetry,
  backendUrl,
  jobId,
  token,
  signal,
  totalChunks,
  chunkIndex,
  uploadedBytes,
  onProgress,
  totalBytes,
}) {
  if (pending.length === 0) return { chunkIndex, uploadedBytes };
  await sendChunkWithRetry({
    backendUrl,
    jobId,
    token,
    signal,
    chunk: pending,
    index: chunkIndex,
    totalChunks,
  });
  const nextChunkIndex = chunkIndex + 1;
  const nextUploadedBytes = uploadedBytes + pending.length;
  reportUploadProgress({
    onProgress,
    totalBytes,
    uploadedBytes: nextUploadedBytes,
    chunkIndex: nextChunkIndex,
  });
  return { chunkIndex: nextChunkIndex, uploadedBytes: nextUploadedBytes };
}

async function streamChunks({
  reader,
  chunkBytes,
  sendChunkWithRetry,
  backendUrl,
  jobId,
  token,
  signal,
  totalChunks,
  onProgress,
  totalBytes,
}) {
  let pending = new Uint8Array(0);
  let uploadedBytes = 0;
  let chunkIndex = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value) continue;
    pending = mergePendingBytes(pending, value);
    const uploadState = await uploadPendingChunks({
      pending,
      chunkBytes,
      sendChunkWithRetry,
      backendUrl,
      jobId,
      token,
      signal,
      totalChunks,
      uploadedBytes,
      chunkIndex,
      onProgress,
      totalBytes,
    });
    ({ pending, uploadedBytes, chunkIndex } = uploadState);
  }
  return uploadFinalPendingChunk({
    pending,
    sendChunkWithRetry,
    backendUrl,
    jobId,
    token,
    signal,
    totalChunks,
    chunkIndex,
    uploadedBytes,
    onProgress,
    totalBytes,
  });
}

function createStreamAndUploadResponse({ sendChunkWithRetry, chunkBytes, backendUrl }) {
  return async function streamAndUploadResponse({ response, jobId, token, signal, onProgress }) {
    if (!response.body || typeof response.body.getReader !== 'function') {
      throw new Error('Streaming not supported for this media.');
    }
    const totalBytesHeader = response.headers.get('content-length');
    const totalBytes = totalBytesHeader ? Number(totalBytesHeader) : null;
    const totalChunks =
      Number.isFinite(totalBytes) && totalBytes > 0 ? Math.ceil(totalBytes / chunkBytes) : null;
    const finalState = await streamChunks({
      reader: response.body.getReader(),
      chunkBytes,
      sendChunkWithRetry,
      backendUrl,
      jobId,
      token,
      signal,
      totalChunks,
      onProgress,
      totalBytes,
    });
    return { chunkCount: finalState.chunkIndex, totalChunks, totalBytes };
  };
}

aiUploadStreamTranscripts.aiTranscriptionUploadStream = {
  createStreamAndUploadResponse,
};
