const { supabase } = require("../supabaseClient");

async function getTranscriptByFingerprint({ fingerprint, userId }) {
  if (!fingerprint || !userId) return null;
  const { data, error } = await supabase
    .from("transcripts")
    .select("*")
    .eq("fingerprint", fingerprint)
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
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
    .from("transcripts")
    .upsert(payload, { onConflict: "user_id,fingerprint" })
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
    status: "created",
    expected_total_chunks: expectedTotalChunks ?? null,
    bytes_received: 0,
  };

  const { data, error } = await supabase
    .from("transcript_jobs")
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw error;
  }
  return data;
}

async function getTranscriptJob({ jobId, userId }) {
  let query = supabase.from("transcript_jobs").select("*").eq("id", jobId);
  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query.single();
  if (error) {
    if (error.code === "PGRST116") {
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

  let query = supabase.from("transcript_jobs").update(payload).eq("id", jobId);
  if (userId) {
    query = query.eq("user_id", userId);
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
    .from("transcript_jobs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);

  if (error) {
    throw error;
  }
  return typeof count === "number" ? count : 0;
}

async function countActiveTranscriptJobs({ userId }) {
  if (!userId) return 0;
  const { error, count } = await supabase
    .from("transcript_jobs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("status", ["created", "uploading", "uploaded", "processing"]);

  if (error) {
    throw error;
  }
  return typeof count === "number" ? count : 0;
}

async function insertTranscriptJobChunk({ jobId, chunkIndex, byteSize }) {
  const { data, error } = await supabase
    .from("transcript_job_chunks")
    .insert({
      job_id: jobId,
      chunk_index: chunkIndex,
      byte_size: byteSize,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return { inserted: false };
    }
    throw error;
  }

  return { inserted: true, data };
}

async function getTranscriptJobChunkStats(jobId) {
  if (!jobId) {
    return { count: 0, minIndex: null, maxIndex: null };
  }

  const { count, error: countError } = await supabase
    .from("transcript_job_chunks")
    .select("chunk_index", { count: "exact", head: true })
    .eq("job_id", jobId);

  if (countError) {
    throw countError;
  }

  const { data: minRows, error: minError } = await supabase
    .from("transcript_job_chunks")
    .select("chunk_index")
    .eq("job_id", jobId)
    .order("chunk_index", { ascending: true })
    .limit(1);

  if (minError) {
    throw minError;
  }

  const { data: maxRows, error: maxError } = await supabase
    .from("transcript_job_chunks")
    .select("chunk_index")
    .eq("job_id", jobId)
    .order("chunk_index", { ascending: false })
    .limit(1);

  if (maxError) {
    throw maxError;
  }

  const minIndex =
    Array.isArray(minRows) && minRows.length > 0
      ? minRows[0].chunk_index
      : null;
  const maxIndex =
    Array.isArray(maxRows) && maxRows.length > 0
      ? maxRows[0].chunk_index
      : null;

  return {
    count: typeof count === "number" ? count : 0,
    minIndex,
    maxIndex,
  };
}

async function listActiveTranscriptJobs({ userId }) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from("transcript_jobs")
    .select("id, status, fingerprint, media_url, created_at, updated_at")
    .eq("user_id", userId)
    .in("status", ["created", "uploading", "uploaded", "processing"])
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }
  return data || [];
}

async function listTranscriptJobsByStatusBefore({ statuses, updatedBefore }) {
  if (!Array.isArray(statuses) || statuses.length === 0) return [];
  if (!updatedBefore) return [];

  const { data, error } = await supabase
    .from("transcript_jobs")
    .select("*")
    .in("status", statuses)
    .lt("updated_at", updatedBefore);

  if (error) {
    throw error;
  }

  return data || [];
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
  getTranscriptJobChunkStats,
  listActiveTranscriptJobs,
  listTranscriptJobsByStatusBefore,
};
