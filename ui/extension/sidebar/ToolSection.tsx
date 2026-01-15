import { getToolById } from '../tools';

interface ToolSectionProps {
  activeToolId?: string | null;
  onClose: () => void;
}

export function ToolSection({ activeToolId, onClose }: ToolSectionProps) {
  if (!activeToolId) return null;
  const tool = getToolById(activeToolId);
  if (!tool) return null;
  const ToolComponent = tool.component;

  return (
    <div className="lockin-tool-panel">
      <ToolComponent onClose={onClose} />
    </div>
  );
}
