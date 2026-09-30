import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import AssigneeAvatar from "@/components/common/AssigneeAvatar";

export interface MentionItem {
  id: string;
  label: string;
  avatarSrc?: string | null;
}

interface MentionListProps {
  items: MentionItem[];
  command: (item: MentionItem) => void;
}

export interface MentionListHandle {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

/** The @mention autocomplete dropdown — arrow keys to move, Enter/click to
 * pick, matches the conversation's own participant list so you can only
 * mention someone who can actually see the message. */
const MentionList = forwardRef<MentionListHandle, MentionListProps>(({ items, command }, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => setSelectedIndex(0), [items]);

  const selectItem = (index: number) => {
    const item = items[index];
    if (item) command(item);
  };

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === "ArrowUp") {
        setSelectedIndex((i) => (i + items.length - 1) % items.length);
        return true;
      }
      if (event.key === "ArrowDown") {
        setSelectedIndex((i) => (i + 1) % items.length);
        return true;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        selectItem(selectedIndex);
        return true;
      }
      return false;
    },
  }));

  if (items.length === 0) {
    return (
      <div style={{ padding: "8px 12px", fontSize: 13, color: "var(--bms-text-2, #6b7280)" }}>
        No matching people
      </div>
    );
  }

  return (
    <div
      style={{
        background: "var(--bms-surface, #fff)",
        border: "1px solid var(--bms-border, #e5e7eb)",
        borderRadius: 8,
        boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
        padding: 4,
        minWidth: 200,
        maxHeight: 260,
        overflowY: "auto",
      }}
    >
      {items.map((item, index) => (
        <button
          key={item.id}
          type="button"
          onClick={() => selectItem(index)}
          onMouseEnter={() => setSelectedIndex(index)}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            width: "100%", padding: "6px 8px", border: "none",
            borderRadius: 6, cursor: "pointer", textAlign: "left",
            background: index === selectedIndex ? "var(--bms-primary-bg, #e6f4ff)" : "transparent",
            fontSize: 13,
          }}
        >
          <AssigneeAvatar name={item.label} src={item.avatarSrc} size={22} />
          <span style={{ color: "var(--bms-text, #1f2937)" }}>{item.label}</span>
        </button>
      ))}
    </div>
  );
});

MentionList.displayName = "MentionList";
export default MentionList;
