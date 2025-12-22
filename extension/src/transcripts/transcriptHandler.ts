/**
 * Transcript Message Handler
 * 
 * Handles transcript-related messages from content scripts.
 * Runs in the background service worker context.
 * 
 * This module provides the background-side logic for:
 * - Fetching Panopto embed HTML (cross-origin)
 * - Extracting caption URLs
 * - Fetching and parsing VTT captions
 */

import type {
  DetectedVideo,
  TranscriptExtractionResult,
} from '@core/transcripts/types';
import { parseWebVtt } from '@core/transcripts/webvttParser';
import { extractCaptionVttUrl } from './providers/panoptoProvider';

/**
 * Message types for transcript operations
 */
export interface TranscriptMessage {
  type: 'EXTRACT_TRANSCRIPT';
  payload: {
    video: DetectedVideo;
  };
}

export interface TranscriptResponse {
  success: boolean;
  data?: TranscriptExtractionResult;
  error?: string;
}

/**
 * Fetch HTML from a URL with credentials
 * Used to fetch Panopto embed pages which require session cookies
 */
async function fetchWithCredentials(url: string): Promise<string> {
  const response = await fetch(url, {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });
  
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('AUTH_REQUIRED');
    }
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  return response.text();
}

/**
 * Fetch VTT content from a caption URL
 */
async function fetchVttContent(url: string): Promise<string> {
  const response = await fetch(url, {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Accept': 'text/vtt,text/plain,*/*',
    },
  });
  
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('AUTH_REQUIRED');
    }
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  return response.text();
}

/**
 * Extract transcript from a Panopto video
 */
export async function extractPanoptoTranscript(
  video: DetectedVideo
): Promise<TranscriptExtractionResult> {
  try {
    // Step 1: Fetch the embed page HTML
    const embedHtml = await fetchWithCredentials(video.embedUrl);
    
    // Step 2: Extract caption URL from the HTML
    const captionUrl = extractCaptionVttUrl(embedHtml);
    
    if (!captionUrl) {
      return {
        success: false,
        error: 'No captions available for this video',
        errorCode: 'NO_CAPTIONS',
        aiTranscriptionAvailable: true,
      };
    }
    
    // Step 3: Fetch the VTT content
    const vttContent = await fetchVttContent(captionUrl);
    
    // Step 4: Parse the VTT
    const transcript = parseWebVtt(vttContent);
    
    if (transcript.segments.length === 0) {
      return {
        success: false,
        error: 'Caption file is empty or could not be parsed',
        errorCode: 'PARSE_ERROR',
        aiTranscriptionAvailable: true,
      };
    }
    
    return {
      success: true,
      transcript,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    
    if (message === 'AUTH_REQUIRED') {
      return {
        success: false,
        error: 'Authentication required. Please log in to Panopto.',
        errorCode: 'AUTH_REQUIRED',
        aiTranscriptionAvailable: true,
      };
    }
    
    if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
      return {
        success: false,
        error: 'Network error. Please check your connection.',
        errorCode: 'NETWORK_ERROR',
        aiTranscriptionAvailable: true,
      };
    }
    
    return {
      success: false,
      error: `Failed to extract transcript: ${message}`,
      errorCode: 'PARSE_ERROR',
      aiTranscriptionAvailable: true,
    };
  }
}

/**
 * Handle transcript extraction message
 */
export async function handleTranscriptMessage(
  message: TranscriptMessage
): Promise<TranscriptResponse> {
  if (message.type !== 'EXTRACT_TRANSCRIPT') {
    return {
      success: false,
      error: `Unknown message type: ${message.type}`,
    };
  }
  
  const { video } = message.payload;
  
  switch (video.provider) {
    case 'panopto': {
      const result = await extractPanoptoTranscript(video);
      return {
        success: result.success,
        data: result,
      };
    }
    
    default:
      return {
        success: false,
        error: `Unsupported video provider: ${video.provider}`,
      };
  }
}
