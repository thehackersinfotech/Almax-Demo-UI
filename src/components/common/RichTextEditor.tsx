import { useEffect, useRef, useState, type ReactNode } from "react";
import { useEditor, EditorContent, ReactRenderer } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Mention from "@tiptap/extension-mention";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import MentionList, { type MentionItem, type MentionListHandle } from "@/components/common/MentionList";
import {
  BoldOutlined, ItalicOutlined, UnderlineOutlined,
  OrderedListOutlined, UnorderedListOutlined,
  UndoOutlined, RedoOutlined, LinkOutlined,
  StrikethroughOutlined, AlignLeftOutlined,
  AlignCenterOutlined, AlignRightOutlined, FontSizeOutlined,
} from "@ant-design/icons";
import { Tooltip, Button, Divider } from "antd";

interface RichTextEditorProps {
  value?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  readOnly?: boolean;
  showColors?: boolean;
  /** Hides heading/alignment/color controls — a leaner toolbar for tight
   * spaces like a chat composer, where those rarely apply. */
  compact?: boolean;
  /** Enter sends (calls this instead of inserting a newline); Shift+Enter
   * still inserts a newline. Matches chat composer conventions. */
  onEnterToSubmit?: () => void;
  /** Controls whether the formatting toolbar is shown. Omit to let the
   * component manage this itself (always visible, unless `compact` — then
   * it starts collapsed). Pass together with `onToolbarVisibleChange` to
   * drive it from an external toggle button. */
  toolbarVisible?: boolean;
  onToolbarVisibleChange?: (visible: boolean) => void;
  /** Send/attach buttons etc — rendered inline at the end of the input row
   * (compact mode only). Sits next to the format-toggle icon: on the same
   * single line as the text when collapsed, pinned bottom-right of the box
   * once the toolbar is expanded — matches a typical chat composer. */
  trailingActions?: ReactNode;
  /** People who can be @mentioned — typing "@" opens an autocomplete
   * filtered against this list. Omit to disable mentions entirely (the
   * default for most editors; the chat composer passes the conversation's
   * participants). */
  mentionable?: MentionItem[];
}

const TEXT_COLORS = [
  { label: "Default", value: "" },
  { label: "Red", value: "#dc2626" },
  { label: "Orange", value: "#ea580c" },
  { label: "Green", value: "#059669" },
  { label: "Blue", value: "#1677ff" },
  { label: "Purple", value: "#7c3aed" },
  { label: "Gray", value: "#6b7280" },
];

function ToolbarButton({
  title, active, disabled, onClick, icon,
}: {
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <Tooltip title={title} mouseEnterDelay={0.6}>
      <Button
        type={active ? "primary" : "text"}
        size="small"
        icon={icon}
        onClick={onClick}
        disabled={disabled}
        style={{
          width: 28, height: 28, padding: 0,
          borderRadius: 4,
          ...(active ? {} : { color: "var(--bms-text, #374151)" }),
        }}
      />
    </Tooltip>
  );
}

export default function RichTextEditor({
  value = "",
  onChange,
  placeholder = "Write a description...",
  minHeight = 160,
  readOnly = false,
  showColors = true,
  compact = false,
  onEnterToSubmit,
  toolbarVisible,
  onToolbarVisibleChange,
  trailingActions,
  mentionable,
}: RichTextEditorProps) {
  // useEditor's config closes over its initial render only — keep the latest
  // callback in a ref so a stale `onEnterToSubmit` from mount isn't called forever.
  const onEnterToSubmitRef = useRef(onEnterToSubmit);
  onEnterToSubmitRef.current = onEnterToSubmit;

  // Same staleness issue as above: the suggestion `items()` callback below
  // is captured once at mount, so it must read the live list through a ref
  // rather than closing over the `mentionable` prop directly.
  const mentionableRef = useRef(mentionable ?? []);
  mentionableRef.current = mentionable ?? [];

  // While the @mention popup is open, Enter/Arrow keys belong to it, not to
  // our own "Enter submits" handling below — see handleKeyDown.
  const mentionSuggestionActiveRef = useRef(false);

  const [internalShowToolbar, setInternalShowToolbar] = useState(!compact);
  const showToolbar = toolbarVisible ?? internalShowToolbar;
  const setShowToolbar = onToolbarVisibleChange ?? setInternalShowToolbar;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        bulletList: { HTMLAttributes: { class: "rte-ul" } },
        orderedList: { HTMLAttributes: { class: "rte-ol" } },
        codeBlock: { HTMLAttributes: { class: "rte-code-block" } },
        blockquote: { HTMLAttributes: { class: "rte-blockquote" } },
      }),
      Underline,
      TextStyle,
      Color,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      Placeholder.configure({ placeholder }),
      ...(mentionable !== undefined
        ? [
            Mention.configure({
              HTMLAttributes: { class: "rte-mention" },
              suggestion: {
                items: ({ query }: { query: string }) =>
                  mentionableRef.current
                    .filter((p) => p.label.toLowerCase().includes(query.toLowerCase()))
                    .slice(0, 8),
                render: () => {
                  let component: ReactRenderer<MentionListHandle>;
                  let popup: TippyInstance[];

                  return {
                    onStart: (props) => {
                      mentionSuggestionActiveRef.current = true;
                      component = new ReactRenderer(MentionList, { props, editor: props.editor });
                      if (!props.clientRect) return;
                      popup = tippy("body", {
                        getReferenceClientRect: props.clientRect as () => DOMRect,
                        appendTo: () => document.body,
                        content: component.element,
                        showOnCreate: true,
                        interactive: true,
                        trigger: "manual",
                        placement: "top-start",
                      });
                    },
                    onUpdate(props) {
                      component.updateProps(props);
                      if (!props.clientRect) return;
                      popup[0].setProps({ getReferenceClientRect: props.clientRect as () => DOMRect });
                    },
                    onKeyDown(props) {
                      if (props.event.key === "Escape") {
                        popup[0].hide();
                        mentionSuggestionActiveRef.current = false;
                        return true;
                      }
                      return component.ref?.onKeyDown(props) ?? false;
                    },
                    onExit() {
                      popup[0].destroy();
                      component.destroy();
                      mentionSuggestionActiveRef.current = false;
                    },
                  };
                },
              },
            }),
          ]
        : []),
    ],
    // initialise with whatever the form passes on mount
    content: value || "",
    editable: !readOnly,
    onUpdate({ editor }) {
      const html = editor.getHTML();
      onChange?.(html === "<p></p>" ? "" : html);
    },
    editorProps: {
      handleKeyDown(_view, event) {
        if (mentionSuggestionActiveRef.current) return false;
        if (onEnterToSubmitRef.current && event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          onEnterToSubmitRef.current();
          return true;
        }
        return false;
      },
    },
  });

  // Sync when Ant Design form.setFieldsValue() pushes a new value (e.g. edit open / reset)
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const incoming = value ?? "";
    // Normalise: treat "<p></p>" the same as ""
    const current = editor.getHTML().replace(/<p><\/p>$/, "");
    const normalised = incoming.replace(/<p><\/p>$/, "");
    if (current !== normalised) {
      editor.commands.setContent(incoming || "", { emitUpdate: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (!editor) return null;

  const addLink = () => {
    const url = window.prompt("Enter URL");
    if (!url) return;
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  // Collapsed compact mode looks like a plain single-line input (no box, just
  // an underline) — the box/border only appears once the toolbar is open.
  const flatCollapsed = compact && !showToolbar;
  const toggleButton = compact && (
    <ToolbarButton
      title={showToolbar ? "Hide formatting options" : "Show formatting options"}
      active={showToolbar}
      onClick={() => setShowToolbar(!showToolbar)}
      icon={<FontSizeOutlined />}
    />
  );

  return (
    <div
      style={{
        border: flatCollapsed ? "none" : "1px solid var(--bms-border, #d9d9d9)",
        borderBottom: flatCollapsed ? "1px solid var(--bms-border, #d9d9d9)" : undefined,
        borderRadius: flatCollapsed ? 0 : 8,
        overflow: "hidden",
        transition: "border-color 0.2s",
        background: "var(--bms-surface, #fff)",
      }}
      onFocusCapture={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = "var(--bms-primary, #1677ff)";
        el.style.boxShadow = "0 0 0 2px rgba(22,119,255,0.1)";
      }}
      onBlurCapture={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = "var(--bms-border, #d9d9d9)";
        el.style.boxShadow = "none";
      }}
    >
      {/* ── Toolbar ── */}
      {!readOnly && showToolbar && (
        <div
          style={{
            display: "flex", alignItems: "center", flexWrap: "wrap",
            gap: 2, padding: "6px 8px",
            borderBottom: "1px solid var(--bms-border, #f0f0f0)",
            background: "var(--bms-surface-2, #fafafa)",
          }}
        >
          {/* Heading — not relevant in a chat composer */}
          {!compact && (
            <>
              <select
                style={{
                  height: 26, fontSize: 12, border: "1px solid var(--bms-border, #e5e7eb)",
                  borderRadius: 4, padding: "0 4px", color: "var(--bms-text, #374151)",
                  background: "var(--bms-surface, #fff)", cursor: "pointer",
                }}
                value={
                  editor.isActive("heading", { level: 1 }) ? "h1"
                  : editor.isActive("heading", { level: 2 }) ? "h2"
                  : editor.isActive("heading", { level: 3 }) ? "h3"
                  : "p"
                }
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "p") editor.chain().focus().setParagraph().run();
                  else editor.chain().focus().toggleHeading({ level: parseInt(v[1]) as 1|2|3 }).run();
                }}
              >
                <option value="p">Normal</option>
                <option value="h1">Heading 1</option>
                <option value="h2">Heading 2</option>
                <option value="h3">Heading 3</option>
              </select>

              <Divider type="vertical" style={{ margin: "0 2px", height: 18 }} />
            </>
          )}

          {/* Inline marks */}
          <ToolbarButton title="Bold (Ctrl+B)" active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()} icon={<BoldOutlined />} />
          <ToolbarButton title="Italic (Ctrl+I)" active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()} icon={<ItalicOutlined />} />
          <ToolbarButton title="Underline (Ctrl+U)" active={editor.isActive("underline")}
            onClick={() => editor.chain().focus().toggleUnderline().run()} icon={<UnderlineOutlined />} />
          <ToolbarButton title="Strikethrough" active={editor.isActive("strike")}
            onClick={() => editor.chain().focus().toggleStrike().run()} icon={<StrikethroughOutlined />} />

          <Divider type="vertical" style={{ margin: "0 2px", height: 18 }} />

          {/* Lists */}
          <ToolbarButton title="Bullet list" active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()} icon={<UnorderedListOutlined />} />
          <ToolbarButton title="Numbered list" active={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()} icon={<OrderedListOutlined />} />

          {showColors && (
            <>
              <Divider type="vertical" style={{ margin: "0 2px", height: 18 }} />
              <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                {TEXT_COLORS.filter((c) => c.value).map((c) => (
                  <Tooltip key={c.value} title={c.label}>
                    <button
                      type="button"
                      onClick={() => editor.chain().focus().setColor(c.value).run()}
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        border: editor.isActive("textStyle", { color: c.value })
                          ? "2px solid #1677ff"
                          : "2px solid #fff",
                        boxShadow: "0 0 0 1px #d1d5db",
                        background: c.value,
                        cursor: "pointer",
                        padding: 0,
                      }}
                    />
                  </Tooltip>
                ))}
                <Tooltip title="Reset color">
                  <button
                    type="button"
                    onClick={() => editor.chain().focus().unsetColor().run()}
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      border: "2px solid #e5e7eb",
                      background: "#fff",
                      cursor: "pointer",
                      fontSize: 10,
                      color: "#6b7280",
                      lineHeight: 1,
                    }}
                  >
                    A
                  </button>
                </Tooltip>
              </div>
            </>
          )}

          {!compact && (
            <>
              <Divider type="vertical" style={{ margin: "0 2px", height: 18 }} />

              {/* Alignment — not relevant in a chat composer */}
              <ToolbarButton title="Align left" active={editor.isActive({ textAlign: "left" })}
                onClick={() => editor.chain().focus().setTextAlign("left").run()} icon={<AlignLeftOutlined />} />
              <ToolbarButton title="Align center" active={editor.isActive({ textAlign: "center" })}
                onClick={() => editor.chain().focus().setTextAlign("center").run()} icon={<AlignCenterOutlined />} />
              <ToolbarButton title="Align right" active={editor.isActive({ textAlign: "right" })}
                onClick={() => editor.chain().focus().setTextAlign("right").run()} icon={<AlignRightOutlined />} />
            </>
          )}

          <Divider type="vertical" style={{ margin: "0 2px", height: 18 }} />

          {/* Link */}
          <ToolbarButton title="Insert link" active={editor.isActive("link")}
            onClick={addLink} icon={<LinkOutlined />} />

          <Divider type="vertical" style={{ margin: "0 2px", height: 18 }} />

          {/* Code block */}
          <ToolbarButton title="Code block" active={editor.isActive("codeBlock")}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            icon={<span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700 }}>{"</>"}</span>}
          />

          {/* Blockquote */}
          <ToolbarButton title="Blockquote" active={editor.isActive("blockquote")}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            icon={<span style={{ fontSize: 14, fontWeight: 700, lineHeight: 1 }}>"</span>}
          />

          <div style={{ flex: 1 }} />

          {/* Undo / Redo */}
          <ToolbarButton title="Undo (Ctrl+Z)" disabled={!editor.can().undo()}
            onClick={() => editor.chain().focus().undo().run()} icon={<UndoOutlined />} />
          <ToolbarButton title="Redo (Ctrl+Y)" disabled={!editor.can().redo()}
            onClick={() => editor.chain().focus().redo().run()} icon={<RedoOutlined />} />
        </div>
      )}

      {/* ── Editor area ── */}
      {compact ? (
        flatCollapsed ? (
          // Collapsed: text field and action icons share a single line, like
          // a plain chat input — no toolbar, no box.
          <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px" }}>
            <EditorContent editor={editor} style={{ flex: 1, minHeight, padding: "6px 4px", cursor: "text" }} />
            {toggleButton}
            {trailingActions}
          </div>
        ) : (
          // Expanded: toolbar on top (rendered above), text area, then the
          // action icons pinned to the bottom-right of the box.
          <>
            <EditorContent editor={editor} style={{ minHeight: Math.max(minHeight, 70), padding: "10px 14px", cursor: "text" }} />
            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 4, padding: "4px 10px 8px" }}>
              {toggleButton}
              {trailingActions}
            </div>
          </>
        )
      ) : (
        <EditorContent
          editor={editor}
          style={{ minHeight, padding: "10px 14px", cursor: "text" }}
        />
      )}

      {/* ── Global styles injected inline via a style tag ── */}
      <style>{`
        .tiptap { outline: none; font-size: 14px; line-height: 1.7; color: var(--bms-text, #1f2937); }
        .tiptap p { margin: 0 0 4px; }
        .tiptap h1 { font-size: 20px; font-weight: 700; margin: 8px 0 4px; }
        .tiptap h2 { font-size: 17px; font-weight: 700; margin: 6px 0 4px; }
        .tiptap h3 { font-size: 15px; font-weight: 600; margin: 4px 0 4px; }
        .rte-ul, .rte-ol { padding-left: 20px; margin: 4px 0; }
        .rte-ul li, .rte-ol li { margin-bottom: 2px; }
        .tiptap a { color: var(--bms-primary, #1677ff); text-decoration: underline; }
        .tiptap strong { font-weight: 700; }
        .rte-code-block {
          background: var(--bms-surface-2, #f3f4f6); border-radius: 6px; padding: 10px 14px;
          font-family: monospace; font-size: 13px; margin: 6px 0;
          border: 1px solid var(--bms-border, #e5e7eb); overflow-x: auto;
          color: var(--bms-text, #1f2937);
        }
        .rte-blockquote {
          border-left: 3px solid var(--bms-border, #d1d5db); padding-left: 12px;
          color: var(--bms-text-2, #6b7280); margin: 6px 0; font-style: italic;
        }
        .tiptap p.is-editor-empty:first-child::before {
          color: #9ca3af; content: attr(data-placeholder);
          float: left; height: 0; pointer-events: none;
        }
        .rte-mention {
          background: var(--bms-primary-bg, #e6f4ff); color: var(--bms-primary, #1677ff);
          border-radius: 4px; padding: 1px 4px; font-weight: 600; box-decoration-break: clone;
        }
      `}</style>
    </div>
  );
}
