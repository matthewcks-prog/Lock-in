import type { ApiRequest } from '../fetcher';
import {
  validateFeedbackListResponse,
  validateFeedbackResponse,
  validateSubmitFeedbackResponse,
} from '../validation';

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
  url?: string | null | undefined;
  courseCode?: string | null | undefined;
  extensionVersion?: string | null | undefined;
  browser?: string | null | undefined;
  page?: string | null | undefined;
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

export type FeedbackClient = {
  submitFeedback: (params: SubmitFeedbackParams) => Promise<SubmitFeedbackResponse>;
  listFeedback: (limit?: number) => Promise<FeedbackRecord[]>;
  getFeedback: (feedbackId: string) => Promise<FeedbackRecord>;
};

export function createFeedbackClient(apiRequest: ApiRequest): FeedbackClient {
  /**
   * Submit user feedback (bug report, feature request, question)
   */
  async function submitFeedback(params: SubmitFeedbackParams): Promise<SubmitFeedbackResponse> {
    const raw = await apiRequest<unknown>('/api/feedback', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return validateSubmitFeedbackResponse(raw, 'submitFeedback');
  }

  /**
   * List user's own feedback submissions
   */
  async function listFeedback(limit?: number): Promise<FeedbackRecord[]> {
    const queryParams =
      typeof limit === 'number' && Number.isFinite(limit) ? `?limit=${limit}` : '';
    const raw = await apiRequest<unknown>(`/api/feedback${queryParams}`, {
      method: 'GET',
    });
    const response = validateFeedbackListResponse(raw, 'listFeedback');
    return response.data;
  }

  /**
   * Get a specific feedback entry
   */
  async function getFeedback(feedbackId: string): Promise<FeedbackRecord> {
    if (typeof feedbackId !== 'string' || feedbackId.length === 0) {
      throw new Error('feedbackId is required');
    }
    const raw = await apiRequest<unknown>(`/api/feedback/${feedbackId}`, {
      method: 'GET',
    });
    const response = validateFeedbackResponse(raw, 'getFeedback');
    return response.data;
  }

  return {
    submitFeedback,
    listFeedback,
    getFeedback,
  };
}
