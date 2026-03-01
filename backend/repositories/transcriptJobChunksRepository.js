const { supabase } = require('../db/supabaseClient');

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

module.exports = {
  insertTranscriptJobChunk,
  deleteTranscriptJobChunk,
  deleteTranscriptJobChunks,
  listTranscriptJobChunkIndices,
  getTranscriptJobChunkStats,
};
