import { Avatar } from "antd";
import { avatarPastel, initialsFromName } from "@/utils/avatarColors";

interface AssigneeAvatarProps {
  name: string;
  size?: number;
  /** Real photo URL, if the person has one uploaded. Falsy (undefined/null/"")
   * falls back to the pastel initials avatar — never pass `undefined` to
   * antd's own `Avatar src=` directly, it renders a broken-image icon
   * instead of falling back to children. */
  src?: string | null;
}

/** Pastel assignee avatar — unique soft color per person (not all primary blue),
 * or their real photo when they have one uploaded. */
export default function AssigneeAvatar({ name, size = 22, src }: AssigneeAvatarProps) {
  if (src) {
    return <Avatar size={size} src={src} style={{ flexShrink: 0 }} />;
  }
  const av = avatarPastel(name);
  return (
    <Avatar
      size={size}
      style={{
        background: av.bg,
        color: av.text,
        fontSize: Math.max(9, Math.round(size * 0.42)),
        fontWeight: 600,
        border: `1px solid ${av.border}`,
        flexShrink: 0,
      }}
    >
      {initialsFromName(name)}
    </Avatar>
  );
}
