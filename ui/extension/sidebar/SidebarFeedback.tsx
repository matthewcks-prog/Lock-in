import { FeedbackModal } from '../feedback';
import type { SidebarModel } from './lockInSidebarTypes';

export function SidebarFeedback({ model }: { model: SidebarModel }): JSX.Element {
  return (
    <FeedbackModal
      isOpen={model.isFeedbackOpen}
      onClose={() => model.setIsFeedbackOpen(false)}
      apiClient={model.apiClient}
      pageUrl={model.pageUrl}
      courseCode={model.courseCode}
    />
  );
}
