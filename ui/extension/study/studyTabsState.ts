import type { StudyToolId } from './studyToolRegistry';

export interface StudyTabsState {
  openToolIds: StudyToolId[];
  activeToolId: StudyToolId | null;
}

export const INITIAL_STUDY_TABS_STATE: StudyTabsState = {
  openToolIds: [],
  activeToolId: null,
};

function resolveNextActiveTool({
  previousOpenToolIds,
  nextOpenToolIds,
  closedToolId,
}: {
  previousOpenToolIds: StudyToolId[];
  nextOpenToolIds: StudyToolId[];
  closedToolId: StudyToolId;
}): StudyToolId | null {
  if (nextOpenToolIds.length === 0) {
    return null;
  }
  const closedIndex = previousOpenToolIds.indexOf(closedToolId);
  const leftCandidate = closedIndex > 0 ? nextOpenToolIds[closedIndex - 1] : undefined;
  if (leftCandidate !== undefined) {
    return leftCandidate;
  }
  return nextOpenToolIds[0] ?? null;
}

export function openStudyToolTab(state: StudyTabsState, toolId: StudyToolId): StudyTabsState {
  if (state.openToolIds.includes(toolId)) {
    if (state.activeToolId === toolId) {
      return state;
    }
    return { ...state, activeToolId: toolId };
  }
  return {
    openToolIds: [...state.openToolIds, toolId],
    activeToolId: toolId,
  };
}

export function closeStudyToolTab(state: StudyTabsState, toolId: StudyToolId): StudyTabsState {
  if (!state.openToolIds.includes(toolId)) {
    return state;
  }
  const nextOpenToolIds = state.openToolIds.filter((id) => id !== toolId);
  if (state.activeToolId !== toolId) {
    return { ...state, openToolIds: nextOpenToolIds };
  }
  return {
    openToolIds: nextOpenToolIds,
    activeToolId: resolveNextActiveTool({
      previousOpenToolIds: state.openToolIds,
      nextOpenToolIds,
      closedToolId: toolId,
    }),
  };
}

export function focusStudyToolTab(state: StudyTabsState, toolId: StudyToolId): StudyTabsState {
  if (!state.openToolIds.includes(toolId)) {
    return state;
  }
  if (state.activeToolId === toolId) {
    return state;
  }
  return { ...state, activeToolId: toolId };
}
