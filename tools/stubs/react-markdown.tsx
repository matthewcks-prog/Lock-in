import React from 'react';

type ReactMarkdownStubProps = {
  children?: React.ReactNode;
  className?: string;
  [key: string]: unknown;
};

export default function ReactMarkdownStub({ children }: ReactMarkdownStubProps) {
  return <>{children}</>;
}
