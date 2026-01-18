import React from 'react';

type SyntaxHighlighterStubProps = {
  children?: React.ReactNode;
  className?: string;
  [key: string]: unknown;
};

export function Prism({ children, ...props }: SyntaxHighlighterStubProps) {
  return (
    <pre {...props}>
      <code>{children}</code>
    </pre>
  );
}

export default Prism;
