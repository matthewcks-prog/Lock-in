// backend/repositories/feedbackRepository.js

const { supabase } = require('../supabaseClient');

/**
 * Repository for feedback CRUD operations.
 * Handles user-submitted bug reports, feature requests, and questions.
 */

/**
 * Create a new feedback entry.
 *
 * @param {Object} params - Feedback parameters
 * @param {string} params.userId - User ID (from JWT)
 * @param {string} params.type - Feedback type: 'bug', 'feature', 'question', 'other'
 * @param {string} params.message - Feedback message
 * @param {Object} [params.context] - Auto-captured context (url, courseCode, etc.)
 * @returns {Promise<Object>} Created feedback record
 */
async function createFeedback({ userId, type, message, context }) {
  const insertData = {
    user_id: userId,
    type,
    message,
    context: context || null,
    status: 'open',
  };

  const { data, error } = await supabase.from('feedback').insert(insertData).select().single();

  if (error) {
    console.error('Error creating feedback:', error);
    throw error;
  }

  return data;
}

/**
 * Get all feedback for a specific user.
 * (For future "My Feedback" feature)
 *
 * @param {string} userId - User ID
 * @param {Object} [options] - Query options
 * @param {number} [options.limit=50] - Maximum records to return
 * @returns {Promise<Object[]>} Array of feedback records
 */
async function getFeedbackByUser(userId, { limit = 50 } = {}) {
  const { data, error } = await supabase
    .from('feedback')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching user feedback:', error);
    throw error;
  }

  return data;
}

/**
 * Get a single feedback entry by ID.
 * Only returns if the user owns the feedback (RLS enforced).
 *
 * @param {string} feedbackId - Feedback ID
 * @param {string} userId - User ID (for ownership check)
 * @returns {Promise<Object|null>} Feedback record or null if not found
 */
async function getFeedbackById(feedbackId, userId) {
  const { data, error } = await supabase
    .from('feedback')
    .select('*')
    .eq('id', feedbackId)
    .eq('user_id', userId)
    .single();

  if (error) {
    // PGRST116 = no rows found
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching feedback:', error);
    throw error;
  }

  return data;
}

module.exports = {
  createFeedback,
  getFeedbackByUser,
  getFeedbackById,
};
