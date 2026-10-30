import { Children, isValidElement } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';

type PreviewProps = {
  source: string;
  onToggleTask: (offset: number) => void;
};

const remarkPlugins = [remarkGfm];
const rehypePlugins = [rehypeHighlight];

export function Preview({ source, onToggleTask }: PreviewProps) {
  const components: Components = {
    // Task checkboxes are rebuilt so they can write back to the source at the item's offset.
    li({ node, className, children }) {
      const offset = node?.position?.start.offset;
      if (offset === undefined || !className?.includes('task-list-item')) {
        return <li className={className}>{children}</li>;
      }
      return (
        <li className={className}>
          {Children.map(children, (child) => {
            if (!isValidElement<{ type?: string; checked?: boolean }>(child) || child.props.type !== 'checkbox') {
              return child;
            }
            return (
              <input
                type="checkbox"
                checked={child.props.checked}
                onChange={() => onToggleTask(offset)}
              />
            );
          })}
        </li>
      );
    },
  };

  return (
    <article className="preview" data-testid="preview">
      <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={components}>
        {source}
      </ReactMarkdown>
    </article>
  );
}
