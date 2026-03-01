import { ChatSectionView } from './ChatSectionView';
import { useChatSectionModel, type ChatSectionProps } from './useChatSectionModel';
import { ChatErrorBoundary } from '../chat/components/ChatErrorBoundary';

export type { ChatSectionProps } from './useChatSectionModel';

export function ChatSection(props: ChatSectionProps): JSX.Element {
  const model = useChatSectionModel(props);
  return (
    <ChatErrorBoundary>
      <ChatSectionView model={model} />
    </ChatErrorBoundary>
  );
}
