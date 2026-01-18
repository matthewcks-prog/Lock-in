declare module 'react-markdown' {
  import type { ComponentType, ReactNode } from 'react';

  interface ReactMarkdownProps {
    children?: ReactNode;
    className?: string;
    [key: string]: unknown;
  }

  const ReactMarkdown: ComponentType<ReactMarkdownProps>;
  export default ReactMarkdown;
}

declare module 'remark-gfm' {
  const remarkGfm: () => unknown;
  export default remarkGfm;
}

declare module 'react-syntax-highlighter' {
  import type { ComponentType, ReactNode } from 'react';

  interface SyntaxHighlighterProps {
    children?: ReactNode;
    [key: string]: unknown;
  }

  export const Prism: ComponentType<SyntaxHighlighterProps>;
}

declare module 'react-syntax-highlighter/dist/esm/styles/prism' {
  export const oneDark: Record<string, unknown>;
}
