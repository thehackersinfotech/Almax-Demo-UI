/** Renders TipTap HTML output with consistent typography. */
export default function RichTextContent({
  html,
  className,
  style,
}: {
  html: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  if (!html || html === "<p></p>") return null;

  return (
    <>
      <div
        className={`rte-content ${className ?? ""}`}
        style={style}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <style>{`
        .rte-content { font-size: 14px; line-height: 1.7; color: var(--bms-text, #1f2937); word-break: break-word; }
        .rte-content p { margin: 0 0 6px; }
        .rte-content p:last-child { margin-bottom: 0; }
        .rte-content ul, .rte-content ol { padding-left: 20px; margin: 6px 0; }
        .rte-content li { margin-bottom: 4px; }
        .rte-content strong { font-weight: 700; }
        .rte-content a { color: #1677ff; text-decoration: underline; }
        .rte-content h1 { font-size: 20px; font-weight: 700; margin: 8px 0 4px; }
        .rte-content h2 { font-size: 17px; font-weight: 700; margin: 6px 0 4px; }
        .rte-content h3 { font-size: 15px; font-weight: 600; margin: 4px 0 4px; }
        .rte-content blockquote {
          border-left: 3px solid #d1d5db; padding-left: 12px;
          color: #6b7280; margin: 6px 0; font-style: italic;
        }
        .rte-content .rte-mention {
          /* Tinted by the surrounding text color so it reads on both a
             light bubble (dark text) and a blue "mine" bubble (white text). */
          background: color-mix(in srgb, currentColor 18%, transparent);
          color: inherit; border-radius: 4px; padding: 1px 4px; font-weight: 600;
        }
      `}</style>
    </>
  );
}

function isHtmlContent(value: string): boolean {
  return /<[a-z][\s\S]*>/i.test(value);
}

/** Pulls the employee IDs out of `@mention` chips in a TipTap HTML body —
 * used when sending a message, to tell the backend who was actually tagged
 * (drives the "Mentions" filter tab and, eventually, mention notifications). */
export function extractMentionIds(html: string): string[] {
  const ids = new Set<string>();
  const re = /<span[^>]*data-type="mention"[^>]*data-id="([^"]+)"[^>]*>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    ids.add(match[1]);
  }
  return Array.from(ids);
}

export function htmlToPlainText(html: string): string {
  if (typeof document !== "undefined") {
    const el = document.createElement("div");
    el.innerHTML = html;
    return (el.textContent || el.innerText || "").replace(/\s+/g, " ").trim();
  }
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function PostContent({ content, style }: { content: string; style?: React.CSSProperties }) {
  if (!content) return null;
  if (isHtmlContent(content)) {
    return <RichTextContent html={content} style={style} />;
  }
  return (
    <div style={{ fontSize: 14, lineHeight: 1.7, color: "var(--bms-text-2)", whiteSpace: "pre-wrap", ...style }}>
      {content}
    </div>
  );
}

/** Single-line plain preview for compact lists (dashboard widgets, etc.). */
export function PostContentPreview({
  content,
  maxLength = 100,
  style,
}: {
  content: string;
  maxLength?: number;
  style?: React.CSSProperties;
}) {
  if (!content || content === "<p></p>") return null;
  const plain = isHtmlContent(content) ? htmlToPlainText(content) : content.trim();
  if (!plain) return null;
  const preview = plain.length > maxLength ? `${plain.slice(0, maxLength)}…` : plain;
  return (
    <div
      style={{
        fontSize: 12,
        color: "var(--bms-text-2)",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {preview}
    </div>
  );
}
