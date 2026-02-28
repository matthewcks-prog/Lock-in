import { describe, expect, it } from 'vitest';
import {
  closeStudyToolTab,
  focusStudyToolTab,
  INITIAL_STUDY_TABS_STATE,
  openStudyToolTab,
} from '../studyTabsState';

describe('studyTabsState', () => {
  it('opens a tool tab and sets it active', () => {
    const state = openStudyToolTab(INITIAL_STUDY_TABS_STATE, 'transcript');
    expect(state.openToolIds).toEqual(['transcript']);
    expect(state.activeToolId).toBe('transcript');
  });

  it('focuses existing tool tab without creating duplicates', () => {
    const state = openStudyToolTab(INITIAL_STUDY_TABS_STATE, 'transcript');
    const next = openStudyToolTab(state, 'transcript');
    expect(next.openToolIds).toEqual(['transcript']);
    expect(next.activeToolId).toBe('transcript');
  });

  it('closes active tab and focuses nearest tab on the right when no left tab exists', () => {
    const withTranscript = openStudyToolTab(INITIAL_STUDY_TABS_STATE, 'transcript');
    const withSummary = openStudyToolTab(withTranscript, 'summary');
    const focusedTranscript = focusStudyToolTab(withSummary, 'transcript');
    const afterClose = closeStudyToolTab(focusedTranscript, 'transcript');

    expect(afterClose.openToolIds).toEqual(['summary']);
    expect(afterClose.activeToolId).toBe('summary');
  });

  it('closes active tab and focuses nearest tab on the left when available', () => {
    const withTranscript = openStudyToolTab(INITIAL_STUDY_TABS_STATE, 'transcript');
    const withSummary = openStudyToolTab(withTranscript, 'summary');
    const afterClose = closeStudyToolTab(withSummary, 'summary');

    expect(afterClose.openToolIds).toEqual(['transcript']);
    expect(afterClose.activeToolId).toBe('transcript');
  });

  it('falls back to no active tab when last tool is closed', () => {
    const withTranscript = openStudyToolTab(INITIAL_STUDY_TABS_STATE, 'transcript');
    const afterClose = closeStudyToolTab(withTranscript, 'transcript');

    expect(afterClose.openToolIds).toEqual([]);
    expect(afterClose.activeToolId).toBeNull();
  });
});
