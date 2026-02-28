import type { TranscriptResult } from '@core/transcripts/types';
import type { ApiRequest, ApiRequestOptions } from '../fetcher';
import {
  validateStudySummaryResponse,
  type StudySummaryDepth,
  type StudySummaryResponse,
} from '../validationStudy';

export interface GenerateStudySummaryParams {
  transcript: TranscriptResult;
  depth?: StudySummaryDepth;
  courseName?: string | null;
  lectureTitle?: string | null;
  weekTopic?: string | null;
  goal?: string | null;
  examFocusAreas?: string[];
  includeJson?: boolean;
}

export type StudyClient = {
  generateStudySummary: (
    params: GenerateStudySummaryParams,
    options?: ApiRequestOptions,
  ) => Promise<StudySummaryResponse>;
};

function validateGenerateSummaryParams(params: GenerateStudySummaryParams): void {
  if (params?.transcript === null || params?.transcript === undefined) {
    throw new Error('transcript is required');
  }
  if (!Array.isArray(params.transcript.segments) || params.transcript.segments.length === 0) {
    throw new Error('transcript.segments must include at least one segment');
  }
}

async function generateStudySummaryRequest(
  apiRequest: ApiRequest,
  params: GenerateStudySummaryParams,
  options?: ApiRequestOptions,
): Promise<StudySummaryResponse> {
  validateGenerateSummaryParams(params);
  const raw = await apiRequest<unknown>('/api/study/summary', {
    method: 'POST',
    body: JSON.stringify(params),
    ...options,
  });
  return validateStudySummaryResponse(raw, 'generateStudySummary');
}

export function createStudyClient(apiRequest: ApiRequest): StudyClient {
  return {
    generateStudySummary: async (params, options) =>
      generateStudySummaryRequest(apiRequest, params, options),
  };
}
