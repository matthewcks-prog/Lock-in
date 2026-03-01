import type { ComponentType } from 'react';
import { StudySummaryTool } from './StudySummaryTool';
import { StudyTranscriptTool } from './StudyTranscriptTool';

export const STUDY_TOOL_IDS = ['transcript', 'summary'] as const;
export type StudyToolId = (typeof STUDY_TOOL_IDS)[number];

export interface StudyToolDefinition {
  id: StudyToolId;
  label: string;
  menuLabel: string;
  closeable?: boolean;
  component: ComponentType;
}

export const STUDY_TOOL_REGISTRY: Record<StudyToolId, StudyToolDefinition> = {
  transcript: {
    id: 'transcript',
    label: 'Transcript',
    menuLabel: 'Open Transcript',
    closeable: true,
    component: StudyTranscriptTool,
  },
  summary: {
    id: 'summary',
    label: 'Summary',
    menuLabel: 'Open Summary',
    closeable: true,
    component: StudySummaryTool,
  },
};

export const STUDY_TOOLS: StudyToolDefinition[] = STUDY_TOOL_IDS.map(
  (toolId) => STUDY_TOOL_REGISTRY[toolId],
);
