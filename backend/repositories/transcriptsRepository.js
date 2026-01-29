const { supabase } = require('../supabaseClient');

async function getTranscriptByFingerprint({ fingerprint, userId }) {
  if (!fingerprint || !userId) return null;
  const { data, error } = await supabase
    .from('transcripts')
    .select('*')
    .eq('fingerprint', fingerprint)
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw error;
  }
  return data;
}

async function upsertTranscriptCache({
  userId,
  fingerprint,
  provider,
  mediaUrlRedacted,
  mediaUrlNormalized,
  etag,
  lastModified,
  durationMs,
  transcriptJson,
}) {
  const payload = {
    user_id: userId,
    fingerprint,
    provider,
    media_url: mediaUrlRedacted,
    media_url_normalized: mediaUrlNormalized,
    etag,
    last_modified: lastModified,
    duration_ms: durationMs,
    transcript_json: transcriptJson,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('transcripts')
    .upsert(payload, { onConflict: 'user_id,fingerprint' })
    .select()
    .single();

  if (error) {
    throw error;
  }
  return data;
}

async function createTranscriptJob({
  userId,
  fingerprint,
  mediaUrl,
  mediaUrlNormalized,
  durationMs,
  provider,
  expectedTotalChunks,
}) {
  const payload = {
    user_id: userId,
    fingerprint,
    media_url: mediaUrl,
    media_url_normalized: mediaUrlNormalized,
    duration_ms: durationMs,
    provider,
    status: 'created',
    expected_total_chunks: expectedTotalChunks ?? null,
    bytes_received: 0,
  };

  const { data, error } = await supabase.from('transcript_jobs').insert(payload).select().single();

  if (error) {
    throw error;
  }
  return data;
}

async function getTranscriptJob({ jobId, userId }) {
  let query = supabase.from('transcript_jobs').select('*').eq('id', jobId);
  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query.single();
  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw error;
  }
  return data;
}

async function updateTranscriptJob({ jobId, userId, updates }) {
  const payload = {
    ...updates,
    updated_at: new Date().toISOString(),
  };

  let query = supabase.from('transcript_jobs').update(payload).eq('id', jobId);
  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query.select().single();
  if (error) {
    throw error;
  }
  return data;
}

async function countTranscriptJobsSince({ userId, since }) {
  if (!userId || !since) return 0;
  const { error, count } = await supabase
    .from('transcript_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', since);

  if (error) {
    throw error;
  }
  return typeof count === 'number' ? count : 0;
}

async function countActiveTranscriptJobs({ userId }) {
  if (!userId) return 0;
  const { error, count } = await supabase
    .from('transcript_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('status', ['created', 'uploading', 'uploaded', 'processing']);

  if (error) {
    throw error;
  }
  return typeof count === 'number' ? count : 0;
}

async function insertTranscriptJobChunk({ jobId, chunkIndex, byteSize }) {
  const { data, error } = await supabase
    .from('transcript_job_chunks')
    .insert({
      job_id: jobId,
      chunk_index: chunkIndex,
      byte_size: byteSize,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return { inserted: false };
    }
    throw error;
  }

  return { inserted: true, data };
}

async function deleteTranscriptJobChunk({ jobId, chunkIndex }) {
  const { error } = await supabase
    .from('transcript_job_chunks')
    .delete()
    .eq('job_id', jobId)
    .eq('chunk_index', chunkIndex);

  if (error) {
    throw error;
  }
}

async function deleteTranscriptJobChunks(jobId) {
  if (!jobId) return;
  const { error } = await supabase.from('transcript_job_chunks').delete().eq('job_id', jobId);
  if (error) {
    throw error;
  }
}

async function listTranscriptJobChunkIndices(jobId) {
  if (!jobId) return [];
  const { data, error } = await supabase
    .from('transcript_job_chunks')
    .select('chunk_index')
    .eq('job_id', jobId)
    .order('chunk_index', { ascending: true });

  if (error) {
    throw error;
  }

  return (data || []).map((row) => row.chunk_index);
}

async function getTranscriptJobChunkStats(jobId) {
  if (!jobId) {
    return { count: 0, minIndex: null, maxIndex: null };
  }

  const { count, error: countError } = await supabase
    .from('transcript_job_chunks')
    .select('chunk_index', { count: 'exact', head: true })
    .eq('job_id', jobId);

  if (countError) {
    throw countError;
  }

  const { data: minRows, error: minError } = await supabase
    .from('transcript_job_chunks')
    .select('chunk_index')
    .eq('job_id', jobId)
    .order('chunk_index', { ascending: true })
    .limit(1);

  if (minError) {
    throw minError;
  }

  const { data: maxRows, error: maxError } = await supabase
    .from('transcript_job_chunks')
    .select('chunk_index')
    .eq('job_id', jobId)
    .order('chunk_index', { ascending: false })
    .limit(1);

  if (maxError) {
    throw maxError;
  }

  const minIndex = Array.isArray(minRows) && minRows.length > 0 ? minRows[0].chunk_index : null;
  const maxIndex = Array.isArray(maxRows) && maxRows.length > 0 ? maxRows[0].chunk_index : null;

  return {
    count: typeof count === 'number' ? count : 0,
    minIndex,
    maxIndex,
  };
}

async function listActiveTranscriptJobs({ userId }) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('transcript_jobs')
    .select('id, status, fingerprint, media_url, created_at, updated_at')
    .eq('user_id', userId)
    .in('status', ['created', 'uploading', 'uploaded', 'processing'])
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }
  return data || [];
}

async function listTranscriptJobsByHeartbeatBefore({ statuses, heartbeatBefore }) {
  if (!Array.isArray(statuses) || statuses.length === 0) return [];
  if (!heartbeatBefore) return [];

  const { data, error } = await supabase
    .from('transcript_jobs')
    .select('*')
    .in('status', statuses)
    .or(`processing_heartbeat_at.is.null,processing_heartbeat_at.lt.${heartbeatBefore}`);

  if (error) {
    throw error;
  }

  return data || [];
}

async function listTranscriptJobsByStatusBefore({ statuses, updatedBefore }) {
  if (!Array.isArray(statuses) || statuses.length === 0) return [];
  if (!updatedBefore) return [];

  const { data, error } = await supabase
    .from('transcript_jobs')
    .select('*')
    .in('status', statuses)
    .lt('updated_at', updatedBefore);

  if (error) {
    throw error;
  }

  return data || [];
}

async function listTranscriptJobsCreatedBefore({ createdBefore }) {
  if (!createdBefore) return [];
  const { data, error } = await supabase
    .from('transcript_jobs')
    .select('*')
    .lt('created_at', createdBefore)
    .gt('bytes_received', 0);

  if (error) {
    throw error;
  }

  return data || [];
}

async function claimTranscriptJobForProcessing({ jobId, workerId, staleBefore }) {
  if (!jobId || !workerId) return null;
  const now = new Date().toISOString();
  let query = supabase
    .from('transcript_jobs')
    .update({
      status: 'processing',
      error: null,
      processing_worker_id: workerId,
      processing_started_at: now,
      processing_heartbeat_at: now,
      updated_at: now,
    })
    .eq('id', jobId)
    .in('status', ['uploaded', 'processing']);

  const staleFilter = staleBefore
    ? `processing_worker_id.is.null,processing_heartbeat_at.is.null,processing_heartbeat_at.lt.${staleBefore}`
    : 'processing_worker_id.is.null';
  query = query.or(staleFilter);

  const { data, error } = await query.select().single();
  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw error;
  }

  return data;
}

async function consumeTranscriptUploadBytes({ userId, bytes, limit }) {
  if (!userId || !Number.isFinite(bytes)) {
    return { allowed: true, remaining: Infinity, retryAfterSeconds: 0 };
  }

  const { data, error } = await supabase.rpc('consume_transcript_upload_bytes', {
    p_user_id: userId,
    p_bytes: bytes,
    p_limit: limit,
  });

  if (error) {
    throw error;
  }

  const result = Array.isArray(data) ? data[0] : data;
  return {
    allowed: Boolean(result?.allowed),
    remaining: result?.remaining ?? null,
    retryAfterSeconds: result?.retry_after_seconds ?? 0,
  };
}

module.exports = {
  getTranscriptByFingerprint,
  upsertTranscriptCache,
  createTranscriptJob,
  getTranscriptJob,
  updateTranscriptJob,
  countTranscriptJobsSince,
  countActiveTranscriptJobs,
  insertTranscriptJobChunk,
  deleteTranscriptJobChunk,
  deleteTranscriptJobChunks,
  listTranscriptJobChunkIndices,
  getTranscriptJobChunkStats,
  listActiveTranscriptJobs,
  listTranscriptJobsByHeartbeatBefore,
  listTranscriptJobsByStatusBefore,
  listTranscriptJobsCreatedBefore,
  claimTranscriptJobForProcessing,
  consumeTranscriptUploadBytes,
};
