import { StudyToolsDropdown } from '../tools';

interface SidebarHeaderActionsProps {
  onOpenFeedback: () => void;
}

export function SidebarHeaderActions({ onOpenFeedback }: SidebarHeaderActionsProps) {
  return (
    <>
      <StudyToolsDropdown />
      <button
        className="lockin-feedback-trigger-btn"
        onClick={onOpenFeedback}
        aria-label="Send feedback"
        title="Send feedback"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </button>
    </>
  );
}
