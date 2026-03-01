import { useEffect, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import type { LexicalEditor } from 'lexical';
import { COMMAND_PRIORITY_LOW, KEY_DOWN_COMMAND, SELECTION_CHANGE_COMMAND } from 'lexical';
import {
  createRafDebouncer,
  scrollCaretIntoComfortBand,
  useReducedMotionPreference,
  type CaretScrollConfig,
} from './caretScrollHelpers';

const DEFAULT_TOP_RATIO = 0.15;
const DEFAULT_BOTTOM_RATIO = 0.85;
const DEFAULT_SCROLL_CUSHION_PX = 24;
const DEFAULT_SMOOTH_THRESHOLD_PX = 150;
const MIN_SCROLL_DELTA_PX = 4;
const SCROLL_THROTTLE_MS = 50;

function registerSelectionScroll(editor: LexicalEditor, scheduleScroll: () => void): () => void {
  return editor.registerCommand(
    SELECTION_CHANGE_COMMAND,
    () => {
      scheduleScroll();
      return false;
    },
    COMMAND_PRIORITY_LOW,
  );
}

function registerKeyScroll(editor: LexicalEditor, scheduleScroll: () => void): () => void {
  return editor.registerCommand(
    KEY_DOWN_COMMAND,
    () => {
      window.setTimeout(scheduleScroll, 0);
      return false;
    },
    COMMAND_PRIORITY_LOW,
  );
}

export function CaretScrollPlugin({
  topRatio = DEFAULT_TOP_RATIO,
  bottomRatio = DEFAULT_BOTTOM_RATIO,
  scrollCushion = DEFAULT_SCROLL_CUSHION_PX,
  smoothThreshold = DEFAULT_SMOOTH_THRESHOLD_PX,
}: CaretScrollConfig): null {
  const [editor] = useLexicalComposerContext();
  const prefersReducedMotion = useRef(false);
  const lastScrollTime = useRef(0);

  useReducedMotionPreference(prefersReducedMotion);

  useEffect(() => {
    const debouncedScroll = createRafDebouncer(() => {
      scrollCaretIntoComfortBand(
        editor,
        {
          topRatio,
          bottomRatio,
          scrollCushion,
          smoothThreshold,
          minScrollDelta: MIN_SCROLL_DELTA_PX,
          scrollThrottleMs: SCROLL_THROTTLE_MS,
        },
        {
          prefersReducedMotion,
          lastScrollTime,
        },
      );
    });

    const unregisterSelection = registerSelectionScroll(editor, debouncedScroll.schedule);
    const unregisterKey = registerKeyScroll(editor, debouncedScroll.schedule);

    return () => {
      unregisterSelection();
      unregisterKey();
      debouncedScroll.cancel();
    };
  }, [bottomRatio, editor, scrollCushion, smoothThreshold, topRatio]);

  return null;
}
