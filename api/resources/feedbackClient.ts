import type { ApiRequest } from '../fetcher';

/**
 * Feedback type options
 */
export type FeedbackType = 'bug' | 'feature' | 'question' | 'other';

/**
 * Feedback status (for admin use)
 */
export type FeedbackStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

/**
 * Context auto-captured with feedback
 */
export interface FeedbackContext {
  url?: string;
  courseCode?: string;
  extensionVersion?: string;
  browser?: string;
  page?: string;
}

/**
 * Input for submitting feedback
 */
export interface SubmitFeedbackParams {
  type: FeedbackType;
  message: string;
  context?: FeedbackContext;
}

/**
 * Response from feedback submission
 */
export interface SubmitFeedbackResponse {
  success: boolean;
  id: string;
  message: string;
}

/**
 * Feedback record (from database)
 */
export interface FeedbackRecord {
  id: string;
  user_id: string;
  type: FeedbackType;
  message: string;
  context: FeedbackContext | null;
  screenshot_url: string | null;
  status: FeedbackStatus;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Response from listing feedback
 */
export interface ListFeedbackResponse {
  success: boolean;
  data: FeedbackRecord[];
}

/**
 * Response from getting a single feedback
 */
export interface GetFeedbackResponse {
  success: boolean;
  data: FeedbackRecord;
}

export function createFeedbackClient(apiRequest: ApiRequest) {
  /**
   * Submit user feedback (bug report, feature request, question)
   */
  async function submitFeedback(params: SubmitFeedbackParams): Promise<SubmitFeedbackResponse> {
    return apiRequest<SubmitFeedbackResponse>('/api/feedback', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  /**
   * List user's own feedback submissions
   */
  async function listFeedback(limit?: number): Promise<FeedbackRecord[]> {
    const queryParams = limit ? `?limit=${limit}` : '';
    const response = await apiRequest<ListFeedbackResponse>(`/api/feedback${queryParams}`, {
      method: 'GET',
    });
    return response.data;
  }

  /**
   * Get a specific feedback entry
   */
  async function getFeedback(feedbackId: string): Promise<FeedbackRecord> {
    if (!feedbackId) {
      throw new Error('feedbackId is required');
    }
    const response = await apiRequest<GetFeedbackResponse>(`/api/feedback/${feedbackId}`, {
      method: 'GET',
    });
    return response.data;
  }

  return {
    submitFeedback,
    listFeedback,
    getFeedback,
  };
}
