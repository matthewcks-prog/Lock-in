/**
 * MarkdownRenderer Component
 *
 * Renders markdown content with syntax highlighting, per-block copy buttons,
 * and security hardening (no raw HTML, safe links, XSS-resistant).
 *
 * Security:
 * - rehype-sanitize strips raw HTML to prevent XSS
 * - All external links get rel="noreferrer noopener" and target="_blank"
 * - No dangerouslySetInnerHTML
 */

import React, { memo, useCallback, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface MarkdownRendererProps {
  /** Markdown content to render */
  content: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Copy-to-clipboard button for code blocks
 */
function CodeCopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }, [text]);

  return (
    <button
      type="button"
      className="lockin-code-copy-btn"
      onClick={handleCopy}
      aria-label={copied ? 'Copied' : 'Copy code'}
      title={copied ? 'Copied!' : 'Copy'}
    >
      {copied ? '✓' : '⎘'}
    </button>
  );
}

/**
 * Custom code block component with syntax highlighting + copy button
 */
type CodeProps = Omit<React.HTMLAttributes<HTMLElement>, 'style'> & {
  inline?: boolean;
  node?: unknown;
};

const syntaxStyle = oneDark as unknown as Record<string, React.CSSProperties>;

const CodeBlock = memo(function CodeBlock({ inline, className, children, ...props }: CodeProps) {
  // Extract language from className (e.g., "language-javascript")
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';
  const codeString = String(children).replace(/\n$/, '');

  // Inline code
  if (inline) {
    return (
      <code
        className="px-1.5 py-0.5 mx-0.5 rounded bg-gray-100 text-gray-800 font-mono text-sm"
        {...props}
      >
        {children}
      </code>
    );
  }

  // Code block with syntax highlighting + copy button
  return (
    <div className="lockin-code-block-wrapper">
      <div className="lockin-code-block-header">
        {language && <span className="lockin-code-block-lang">{language}</span>}
        <CodeCopyButton text={codeString} />
      </div>
      <SyntaxHighlighter
        style={syntaxStyle}
        language={language || 'text'}
        PreTag="div"
        customStyle={{
          margin: 0,
          padding: '1rem',
          fontSize: '0.875rem',
          borderRadius: '0 0 0.5rem 0.5rem',
        }}
        {...props}
      >
        {codeString}
      </SyntaxHighlighter>
    </div>
  );
});

/**
 * Custom components for markdown elements
 */
type MarkdownComponents = Record<string, React.ComponentType<Record<string, unknown>>>;

const markdownComponents: MarkdownComponents = {
  // Code blocks with syntax highlighting
  code: CodeBlock,

  // Paragraphs with proper spacing
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>
  ),

  // Headings
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="text-xl font-bold mb-3 mt-4 first:mt-0">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="text-lg font-bold mb-2 mt-3 first:mt-0">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="text-base font-semibold mb-2 mt-3 first:mt-0">{children}</h3>
  ),

  // Lists
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="leading-relaxed">{children}</li>
  ),

  // Links
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 hover:text-blue-800 underline"
    >
      {children}
    </a>
  ),

  // Blockquotes
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="border-l-4 border-gray-300 pl-4 py-1 my-3 italic text-gray-700">
      {children}
    </blockquote>
  ),

  // Tables
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="overflow-x-auto my-3">
      <table className="min-w-full border-collapse border border-gray-300">{children}</table>
    </div>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="border border-gray-300 px-3 py-2 bg-gray-100 font-semibold text-left">
      {children}
    </th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="border border-gray-300 px-3 py-2">{children}</td>
  ),

  // Horizontal rule
  hr: () => <hr className="my-4 border-t border-gray-300" />,

  // Strong and emphasis
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => <em className="italic">{children}</em>,
};

export const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
  className = '',
}: MarkdownRendererProps) {
  if (!content) return null;

  return (
    <div className={`lockin-markdown ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={markdownComponents}
        /* Security: disallow raw HTML in markdown to prevent XSS */
        skipHtml
        /* Security: disallow dangerous protocols in URLs */
        urlTransform={(url: string) => {
          // Block javascript: and data: protocols
          if (/^(javascript|data|vbscript):/i.test(url)) return '';
          return url;
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
