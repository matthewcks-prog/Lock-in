/**
 * WebVTT Parser Tests
 */

import { describe, it, expect } from 'vitest';
import { parseWebVtt, decodeHtmlEntities, parseVttTimestamp, formatAsVtt } from '../webvttParser';

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
    expect(parseVttTimestamp('00:01:00.000')).toBe(60000);
    expect(parseVttTimestamp('01:00:00.000')).toBe(3600000);
    expect(parseVttTimestamp('00:00:00.430')).toBe(430);
  });

  it('parses MM:SS.mmm format', () => {
    expect(parseVttTimestamp('00:00.000')).toBe(0);
    expect(parseVttTimestamp('00:05.919')).toBe(5919);
    expect(parseVttTimestamp('01:30.500')).toBe(90500);
  });

  it('handles various millisecond precisions', () => {
    expect(parseVttTimestamp('00:00:01.5')).toBe(1500);
    expect(parseVttTimestamp('00:00:01.50')).toBe(1500);
    expect(parseVttTimestamp('00:00:01.500')).toBe(1500);
  });
});

describe('parseWebVtt', () => {
  it('parses a simple VTT file', () => {
    const vtt = `WEBVTT

1
00:00:00.430 --> 00:00:05.919
The central processing unit

2
00:00:05.920 --> 00:00:10.000
is the brain of the computer.
`;

    const result = parseWebVtt(vtt);

    expect(result.segments).toHaveLength(2);
    expect(result.segments[0]).toEqual({
      startMs: 430,
      endMs: 5919,
      text: 'The central processing unit',
    });
    expect(result.segments[1]).toEqual({
      startMs: 5920,
      endMs: 10000,
      text: 'is the brain of the computer.',
    });
    expect(result.plainText).toBe('The central processing unit is the brain of the computer.');
    expect(result.durationMs).toBe(10000);
  });

  it('handles HTML entities in captions', () => {
    const vtt = `WEBVTT

1
00:00:00.000 --> 00:00:05.000
It&#39;s a &quot;test&quot;
`;

    const result = parseWebVtt(vtt);

    expect(result.segments[0].text).toBe('It\'s a "test"');
  });

  it('strips VTT formatting tags', () => {
    const vtt = `WEBVTT

1
00:00:00.000 --> 00:00:05.000
<v Speaker>Hello</v> <b>world</b>
`;

    const result = parseWebVtt(vtt);

    expect(result.segments[0].text).toBe('Hello world');
  });

  it('handles multi-line cues', () => {
    const vtt = `WEBVTT

1
00:00:00.000 --> 00:00:05.000
This is line one
and this is line two
`;

    const result = parseWebVtt(vtt);

    expect(result.segments[0].text).toBe('This is line one and this is line two');
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
    expect(result.segments[0].text).toBe('Actual content');
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
    expect(result.segments[0].text).toBe('Positioned text');
  });
});

describe('formatAsVtt', () => {
  it('formats segments back to VTT', () => {
    const segments = [
      { startMs: 430, endMs: 5919, text: 'The central processing unit' },
      { startMs: 5920, endMs: 10000, text: 'is the brain of the computer.' },
    ];

    const result = formatAsVtt(segments);

    expect(result).toContain('WEBVTT');
    expect(result).toContain('00:00:00.430 --> 00:00:05.919');
    expect(result).toContain('The central processing unit');
    expect(result).toContain('00:00:05.920 --> 00:00:10.000');
    expect(result).toContain('is the brain of the computer.');
  });
});
