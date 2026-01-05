/**
 * WebVTT Parser
 * 
 * Parses WebVTT format captions into structured segments.
 * Handles HTML entity decoding and common VTT variations.
 */

import type { TranscriptResult, TranscriptSegment } from './types';

/**
 * Common HTML entities that appear in VTT captions
 */
const HTML_ENTITIES: Record<string, string> = {
  '&#39;': "'",
  '&#x27;': "'",
  '&apos;': "'",
  '&#34;': '"',
  '&#x22;': '"',
  '&quot;': '"',
  '&amp;': '&',
  '&#38;': '&',
  '&lt;': '<',
  '&#60;': '<',
  '&gt;': '>',
  '&#62;': '>',
  '&nbsp;': ' ',
  '&#160;': ' ',
  '&#8217;': '\u2019', // Right single quote
  '&#8216;': '\u2018', // Left single quote
  '&#8220;': '\u201C', // Left double quote
  '&#8221;': '\u201D', // Right double quote
  '&#8211;': '\u2013', // En dash
  '&#8212;': '\u2014', // Em dash
  '&#8230;': '\u2026', // Ellipsis
};

/**
 * Decode HTML entities in text
 */
export function decodeHtmlEntities(text: string): string {
  let result = text;
  
  // Replace named and numeric entities
  for (const [entity, char] of Object.entries(HTML_ENTITIES)) {
    result = result.split(entity).join(char);
  }
  
  // Handle arbitrary numeric entities (&#NNN; or &#xHHH;)
  result = result.replace(/&#(\d+);/g, (_, code) => {
    return String.fromCharCode(parseInt(code, 10));
  });
  
  result = result.replace(/&#x([0-9a-fA-F]+);/g, (_, code) => {
    return String.fromCharCode(parseInt(code, 16));
  });
  
  return result;
}

/**
 * Parse a VTT timestamp into milliseconds
 * Formats: HH:MM:SS.mmm or MM:SS.mmm
 */
export function parseVttTimestamp(timestamp: string): number {
  const parts = timestamp.trim().split(':');
  
  if (parts.length < 2 || parts.length > 3) {
    return 0;
  }
  
  let hours = 0;
  let minutes: number;
  let seconds: number;
  
  if (parts.length === 3) {
    hours = parseInt(parts[0], 10) || 0;
    minutes = parseInt(parts[1], 10) || 0;
    seconds = parseFloat(parts[2]) || 0;
  } else {
    minutes = parseInt(parts[0], 10) || 0;
    seconds = parseFloat(parts[1]) || 0;
  }
  
  return Math.round((hours * 3600 + minutes * 60 + seconds) * 1000);
}

/**
 * Strip VTT formatting tags like <v>, <c>, <b>, etc.
 */
function stripVttTags(text: string): string {
  // Remove voice tags: <v Name>text</v>
  let result = text.replace(/<v[^>]*>/gi, '').replace(/<\/v>/gi, '');
  
  // Remove class tags: <c.classname>text</c>
  result = result.replace(/<c[^>]*>/gi, '').replace(/<\/c>/gi, '');
  
  // Remove other inline tags: <b>, <i>, <u>, <ruby>, <rt>, <lang>
  result = result.replace(/<\/?(?:b|i|u|ruby|rt|lang)[^>]*>/gi, '');
  
  return result.trim();
}

/**
 * Parse WebVTT content into structured segments
 * 
 * @param vttContent - Raw VTT file content
 * @returns Parsed transcript with segments and plain text
 */
export function parseWebVtt(vttContent: string): TranscriptResult {
  const lines = vttContent.split(/\r?\n/);
  const segments: TranscriptSegment[] = [];
  
  let i = 0;
  
  // Skip WEBVTT header and any metadata
  while (i < lines.length) {
    const line = lines[i].trim();
    if (line === '' || line.startsWith('WEBVTT') || line.startsWith('NOTE') || line.startsWith('STYLE')) {
      i++;
      // Skip multi-line NOTE/STYLE blocks
      if (line.startsWith('NOTE') || line.startsWith('STYLE')) {
        while (i < lines.length && lines[i].trim() !== '') {
          i++;
        }
      }
      continue;
    }
    break;
  }
  
  // Parse cues
  while (i < lines.length) {
    const line = lines[i].trim();
    
    // Skip empty lines and cue identifiers (numeric or text before timestamp)
    if (line === '') {
      i++;
      continue;
    }
    
    // Check if this line is a timestamp line (contains -->)
    const timestampMatch = line.match(/^(\d{1,2}:\d{2}(?::\d{2})?(?:\.\d{1,3})?)\s*-->\s*(\d{1,2}:\d{2}(?::\d{2})?(?:\.\d{1,3})?)/);
    
    if (!timestampMatch) {
      // This might be a cue identifier, skip it
      i++;
      continue;
    }
    
    const startMs = parseVttTimestamp(timestampMatch[1]);
    const endMs = parseVttTimestamp(timestampMatch[2]);
    
    i++;
    
    // Collect cue text (may span multiple lines until empty line)
    const textLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== '') {
      textLines.push(lines[i]);
      i++;
    }
    
    if (textLines.length > 0) {
      let text = textLines.join(' ');
      text = stripVttTags(text);
      text = decodeHtmlEntities(text);
      text = text.replace(/\s+/g, ' ').trim();
      
      if (text) {
        segments.push({ startMs, endMs, text });
      }
    }
  }
  
  // Build plain text version
  const plainText = segments.map(s => s.text).join(' ');
  
  // Calculate duration from last segment
  const lastSegment = segments[segments.length - 1];
  const durationMs = lastSegment
    ? typeof lastSegment.endMs === 'number'
      ? lastSegment.endMs
      : lastSegment.startMs
    : 0;
  
  return {
    plainText,
    segments,
    durationMs,
  };
}

/**
 * Format segments back to VTT format
 */
export function formatAsVtt(segments: TranscriptSegment[]): string {
  const lines: string[] = ['WEBVTT', ''];
  
  segments.forEach((segment, index) => {
    lines.push(String(index + 1));
    const endMs =
      typeof segment.endMs === 'number' ? segment.endMs : segment.startMs;
    lines.push(`${formatVttTimestamp(segment.startMs)} --> ${formatVttTimestamp(endMs)}`);
    lines.push(segment.text);
    lines.push('');
  });
  
  return lines.join('\n');
}

/**
 * Format milliseconds as VTT timestamp (HH:MM:SS.mmm)
 */
function formatVttTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const millis = ms % 1000;
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}
