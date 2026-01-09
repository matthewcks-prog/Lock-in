/**
 * Study Tools - Tool Registry
 *
 * Central registry of all available study tools.
 * To add a new tool:
 * 1. Create a ToolContent component implementing ToolContentProps
 * 2. Add an entry to the TOOLS array below
 */

import { TranscriptToolContent } from './TranscriptToolContent';
import type { ToolDefinition, ToolContentProps } from './types';

// Placeholder component for disabled tools
function PlaceholderTool(_props: ToolContentProps) {
  return (
    <div className="lockin-tool-placeholder">
      <p>This tool is coming soon!</p>
    </div>
  );
}

/**
 * Registry of all study tools.
 * Order determines display order in the dropdown.
 */
export const TOOLS: ToolDefinition[] = [
  {
    id: 'transcript',
    label: 'Transcript',
    typeTag: 'video',
    enabled: true,
    component: TranscriptToolContent,
  },
  {
    id: 'quiz',
    label: 'Quiz',
    typeTag: 'video',
    enabled: false, // Placeholder - coming soon
    component: PlaceholderTool,
  },
];

/**
 * Get a tool definition by ID.
 */
export function getToolById(id: string): ToolDefinition | undefined {
  return TOOLS.find((tool) => tool.id === id);
}

/**
 * Get all enabled tools.
 */
export function getEnabledTools(): ToolDefinition[] {
  return TOOLS.filter((tool) => tool.enabled);
}
