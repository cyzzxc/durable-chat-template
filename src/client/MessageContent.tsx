import React from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

// 自定义链接组件 - 新标签打开
function LinkRenderer(props: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const { href, children, ...rest } = props;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
      {children}
    </a>
  );
}

// 自定义图片组件 - 懒加载 + 样式
function ImageRenderer(props: React.ImgHTMLAttributes<HTMLImageElement>) {
  const { src, alt, ...rest } = props;
  return (
    <img
      src={src}
      alt={alt || ""}
      loading="lazy"
      style={{ maxWidth: "100%", borderRadius: "8px" }}
      {...rest}
    />
  );
}

// 段落组件 - 优化仅含图片的段落
function ParagraphRenderer({ children }: { children?: React.ReactNode }) {
  const childArray = React.Children.toArray(children);
  const hasOnlyImages = childArray.every(
    (child) => React.isValidElement(child) && child.type === "img"
  );

  if (hasOnlyImages && childArray.length > 0) {
    return <>{children}</>;
  }
  return <p>{children}</p>;
}

interface MessageContentProps {
  content: string;
}

export function MessageContent({ content }: MessageContentProps) {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: LinkRenderer,
        img: ImageRenderer,
        p: ParagraphRenderer,
      }}
    >
      {content}
    </Markdown>
  );
}