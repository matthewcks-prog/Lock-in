import { describe, expect, it } from 'vitest';
import {
  MONASH_MOODLE_HOSTS,
  hasMoodleLikePath,
  isKnownMonashMoodleHost,
  isMonashEduHost,
  isMonashMoodleUrl,
} from '../config/hostRules';

describe('hostRules', () => {
  it('exposes the approved Moodle host allowlist', () => {
    expect(MONASH_MOODLE_HOSTS).toEqual([
      'learning.monash.edu',
      'lms.monash.edu',
      'moodle.monash.edu.au',
      'cpw-lms.monash.edu',
    ]);
  });

  it('matches known hosts case-insensitively', () => {
    expect(isKnownMonashMoodleHost('LEARNING.MONASH.EDU')).toBe(true);
    expect(isKnownMonashMoodleHost('learning.monash.edu.')).toBe(true);
    expect(isKnownMonashMoodleHost('monash.edu')).toBe(false);
  });

  it('matches monash.edu suffix hosts safely', () => {
    expect(isMonashEduHost('a.b.monash.edu')).toBe(true);
    expect(isMonashEduHost('learning.monash.edu')).toBe(true);
    expect(isMonashEduHost('learning.monash.edu.au')).toBe(false);
    expect(isMonashEduHost('evil-monash.edu')).toBe(false);
  });

  it('matches moodle-like paths', () => {
    expect(hasMoodleLikePath('/course/view.php?id=1')).toBe(true);
    expect(hasMoodleLikePath('/mod/page/view.php?id=2')).toBe(true);
    expect(hasMoodleLikePath('/local/myplugin/index.php')).toBe(true);
    expect(hasMoodleLikePath('/research/projects')).toBe(false);
  });

  it('returns true for known Moodle hosts', () => {
    expect(isMonashMoodleUrl('https://learning.monash.edu/')).toBe(true);
    expect(isMonashMoodleUrl('https://moodle.monash.edu.au/')).toBe(true);
  });

  it('returns true for monash.edu subdomains with moodle-like paths', () => {
    expect(isMonashMoodleUrl('https://teaching.monash.edu/course/view.php?id=1')).toBe(true);
    expect(isMonashMoodleUrl('https://teaching.monash.edu/mod/assign/view.php?id=2')).toBe(true);
  });

  it('returns false for non-moodle paths and non-monash domains', () => {
    expect(isMonashMoodleUrl('https://teaching.monash.edu/research')).toBe(false);
    expect(isMonashMoodleUrl('https://example.com/course/view.php?id=1')).toBe(false);
    expect(isMonashMoodleUrl('not-a-url')).toBe(false);
  });
});
