import { Result } from "antd";
import { useAuthStore } from "@/store/auth";
import { isWorkspaceAdmin } from "@/utils/access";

interface Props {
  children: React.ReactNode;
}

/** Route guard: tenant admin (is_staff / Admin role) inside the workspace. */
export default function RequireWorkspaceAdmin({ children }: Props) {
  const user = useAuthStore((s) => s.user);

  if (!isWorkspaceAdmin(user)) {
    return (
      <Result
        status="403"
        title="Admins only"
        subTitle="Only workspace administrators can view subscription and usage details."
      />
    );
  }

  return <>{children}</>;
}
