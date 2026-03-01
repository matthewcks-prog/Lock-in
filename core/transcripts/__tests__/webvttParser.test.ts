/**
 * WebVTT Parser Tests
 */

import { describe, it, expect } from 'vitest';
import { parseWebVtt, decodeHtmlEntities, parseVttTimestamp, formatAsVtt } from '../webvttParser';

const MS_430 = 430;
const MS_5919 = 5919;
const MS_90500 = 90500;
const MS_1500 = 1500;
const MS_10000 = 10000;
const MS_60000 = 60000;
const MS_3600000 = 3600000;
const MS_5920 = 5920;

const SEGMENT_TEXT = 'The central processing unit';
const SEGMENT_TEXT_2 = 'is the brain of the computer.';

describe('decodeHtmlEntities', () => {
  it('decodes common HTML entities', () => {
    expect(decodeHtmlEntities('I&#39;m')).toBe("I'm");
    expect(decodeHtmlEntities('&quot;quoted&quot;')).toBe('"quoted"');
    expect(decodeHtmlEntities('&amp; ampersand')).toBe('& ampersand');
    expect(decodeHtmlEntities('&lt;tag&gt;')).toBe('<tag>');
  });

  it('decodes numeric entities', () => {
    expect(decodeHtmlEntities('&#8217;')).toBe('\u2019'); // Right single quote
    expect(decodeHtmlEntities('&#x27;')).toBe("'");
    expect(decodeHtmlEntities('&#65;')).toBe('A');
    expect(decodeHtmlEntities('&#x41;')).toBe('A');
  });

  it('handles multiple entities in one string', () => {
    expect(decodeHtmlEntities('It&#39;s &quot;great&quot;')).toBe('It\'s "great"');
  });

  it('returns plain text unchanged', () => {
    expect(decodeHtmlEntities('Hello world')).toBe('Hello world');
  });
});

describe('parseVttTimestamp', () => {
  it('parses HH:MM:SS.mmm format', () => {
    expect(parseVttTimestamp('00:00:00.000')).toBe(0);
    expect(parseVttTimestamp('00:00:01.000')).toBe(1000);
    expect(parseVttTimestamp('00:01:00.000')).toBe(MS_60000);
    expect(parseVttTimestamp('01:00:00.000')).toBe(MS_3600000);
    expect(parseVttTimestamp('00:00:00.430')).toBe(MS_430);
  });

  it('parses MM:SS.mmm format', () => {
    expect(parseVttTimestamp('00:00.000')).toBe(0);
    expect(parseVttTimestamp('00:05.919')).toBe(MS_5919);
    expect(parseVttTimestamp('01:30.500')).toBe(MS_90500);
  });

  it('handles various millisecond precisions', () => {
    expect(parseVttTimestamp('00:00:01.5')).toBe(MS_1500);
    expect(parseVttTimestamp('00:00:01.50')).toBe(MS_1500);
    expect(parseVttTimestamp('00:00:01.500')).toBe(MS_1500);
  });
});

describe('parseWebVtt basics', () => {
  it('parses a simple VTT file', () => {
    const vtt = `WEBVTT

1
00:00:00.430 --> 00:00:05.919
${SEGMENT_TEXT}

2
00:00:05.920 --> 00:00:10.000
${SEGMENT_TEXT_2}
`;

    const result = parseWebVtt(vtt);

    expect(result.segments).toHaveLength(2);
    const [firstSegment, secondSegment] = result.segments;
    expect(firstSegment).toBeDefined();
    expect(secondSegment).toBeDefined();
    expect(firstSegment).toEqual({
      startMs: MS_430,
      endMs: MS_5919,
      text: SEGMENT_TEXT,
    });
    expect(secondSegment).toEqual({
      startMs: MS_5920,
      endMs: MS_10000,
      text: SEGMENT_TEXT_2,
    });
    expect(result.plainText).toBe(`${SEGMENT_TEXT} ${SEGMENT_TEXT_2}`);
    expect(result.durationMs).toBe(MS_10000);
  });
});

describe('parseWebVtt cues', () => {
  it('handles HTML entities in captions', () => {
    const vtt = `WEBVTT

1
00:00:00.000 --> 00:00:05.000
It&#39;s a &quot;test&quot;
`;

    const result = parseWebVtt(vtt);

    const [firstSegment] = result.segments;
    expect(firstSegment).toBeDefined();
    expect(firstSegment?.text).toBe('It\'s a "test"');
  });

  it('handles multi-line cues', () => {
    const vtt = `WEBVTT

1
00:00:00.000 --> 00:00:05.000
This is line one
and this is line two
`;

    const result = parseWebVtt(vtt);

    const [firstSegment] = result.segments;
    expect(firstSegment).toBeDefined();
    expect(firstSegment?.text).toBe('This is line one and this is line two');
  });
});

describe('parseWebVtt formatting', () => {
  it('strips VTT formatting tags', () => {
    const vtt = `WEBVTT

1
00:00:00.000 --> 00:00:05.000
<v Speaker>Hello</v> <b>world</b>
`;

    const result = parseWebVtt(vtt);

    const [firstSegment] = result.segments;
    expect(firstSegment).toBeDefined();
    expect(firstSegment?.text).toBe('Hello world');
  });

  it('handles VTT with NOTE and STYLE blocks', () => {
    const vtt = `WEBVTT

NOTE
This is a comment

STYLE
::cue { color: white; }

1
00:00:00.000 --> 00:00:05.000
Actual content
`;

    const result = parseWebVtt(vtt);

    expect(result.segments).toHaveLength(1);
    const [firstSegment] = result.segments;
    expect(firstSegment).toBeDefined();
    expect(firstSegment?.text).toBe('Actual content');
  });

  it('handles empty VTT', () => {
    const vtt = `WEBVTT

`;

    const result = parseWebVtt(vtt);

    expect(result.segments).toHaveLength(0);
    expect(result.plainText).toBe('');
    expect(result.durationMs).toBe(0);
  });

  it('handles VTT with cue settings', () => {
    const vtt = `WEBVTT

1
00:00:00.000 --> 00:00:05.000 align:start position:10%
Positioned text
`;

    const result = parseWebVtt(vtt);

    expect(result.segments).toHaveLength(1);
    const [firstSegment] = result.segments;
    expect(firstSegment).toBeDefined();
    expect(firstSegment?.text).toBe('Positioned text');
  });
});

describe('formatAsVtt', () => {
  it('formats segments back to VTT', () => {
    const segments = [
      { startMs: MS_430, endMs: MS_5919, text: SEGMENT_TEXT },
      { startMs: MS_5920, endMs: MS_10000, text: SEGMENT_TEXT_2 },
    ];

    const result = formatAsVtt(segments);

    expect(result).toContain('WEBVTT');
    expect(result).toContain('00:00:00.430 --> 00:00:05.919');
    expect(result).toContain(SEGMENT_TEXT);
    expect(result).toContain('00:00:05.920 --> 00:00:10.000');
    expect(result).toContain(SEGMENT_TEXT_2);
  });
});
