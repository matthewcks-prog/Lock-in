import { ChatSectionView } from './ChatSectionView';
import { useChatSectionModel, type ChatSectionProps } from './useChatSectionModel';

export type { ChatSectionProps } from './useChatSectionModel';

export function ChatSection(props: ChatSectionProps): JSX.Element {
  const model = useChatSectionModel(props);
  return <ChatSectionView model={model} />;
}
