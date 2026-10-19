import { Fragment } from "react";
import { parseMarkdown, type Inline } from "@/lib/markdown";

function Inlines({ nodes }: { nodes: Inline[] }) {
  return nodes.map((node, index) => {
    if (node.type === "text") return <Fragment key={index}>{node.text}</Fragment>;
    if (node.type === "br") return <br key={index} />;
    if (node.type === "strong") {
      return (
        <strong key={index} className="font-bold">
          <Inlines nodes={node.children} />
        </strong>
      );
    }
    return (
      <a key={index} href={node.href} className="text-seal underline-offset-2 hover:underline">
        <Inlines nodes={node.children} />
      </a>
    );
  });
}

export function MarkdownBody({ source }: { source: string }) {
  const blocks = parseMarkdown(source);

  return (
    <div>
      {blocks.map((block, index) => {
        if (block.type === "heading" && block.level === 1) {
          return (
            <h1 key={index} className="font-serif text-4xl leading-tight sm:text-5xl">
              <Inlines nodes={block.children} />
            </h1>
          );
        }
        if (block.type === "heading") {
          const Tag = block.level === 2 ? "h2" : "h3";
          return (
            <Tag key={index} className="mt-10 font-serif text-2xl">
              <Inlines nodes={block.children} />
            </Tag>
          );
        }
        if (block.type === "hr") {
          return <hr key={index} className="mt-10 border-0 border-t border-dashed border-line" />;
        }
        if (block.type === "list") {
          const Tag = block.ordered ? "ol" : "ul";
          return (
            <Tag
              key={index}
              className={`mt-4 space-y-3 pl-6 leading-8 ${block.ordered ? "list-decimal" : "list-disc"}`}
            >
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <Inlines nodes={item} />
                </li>
              ))}
            </Tag>
          );
        }
        return (
          <p key={index} className="mt-4 leading-8">
            <Inlines nodes={block.children} />
          </p>
        );
      })}
    </div>
  );
}
