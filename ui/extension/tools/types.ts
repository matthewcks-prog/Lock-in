/**
 * Study Tools - Type Definitions
 *
 * Core types for the tool framework. Keep minimal to avoid coupling.
 */

import type { ComponentType } from 'react';

/** Type tag indicating what kind of content the tool operates on */
export type ToolType = 'video' | 'pdf' | 'text';

/**
 * Props passed to every tool content component.
 * Keep minimal - tool-specific state should live inside the tool component.
 */
export interface ToolContentProps {
    /** Callback to close the tool and return to Chat/Notes */
    onClose: () => void;
    /** Callback to save content as a note */
    onSaveAsNote: (content: string) => void;
}

/**
 * Definition of a study tool for the registry.
 */
export interface ToolDefinition {
    /** Unique identifier for the tool */
    id: string;
    /** Display label shown in dropdown and tab */
    label: string;
    /** Type tag shown in dropdown (e.g., "Video", "PDF") */
    typeTag: ToolType;
    /** Whether the tool is enabled (false = placeholder/coming soon) */
    enabled: boolean;
    /** React component to render when tool is active */
    component: ComponentType<ToolContentProps>;
}
