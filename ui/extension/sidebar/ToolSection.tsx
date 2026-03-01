import { getToolById } from '../tools';

interface ToolSectionProps {
  activeToolId?: string | null;
  onClose: () => void;
}

export function ToolSection({ activeToolId, onClose }: ToolSectionProps): JSX.Element | null {
  if (activeToolId === null || activeToolId === undefined || activeToolId.length === 0) {
    return null;
  }
  const tool = getToolById(activeToolId);
  if (tool === undefined) return null;
  const ToolComponent = tool.component;

  return (
    <div className="lockin-tool-panel">
      <ToolComponent onClose={onClose} />
    </div>
  );
}
