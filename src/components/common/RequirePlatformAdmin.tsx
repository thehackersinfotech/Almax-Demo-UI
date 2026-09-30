import { Result } from "antd";
import { useAuthStore } from "@/store/auth";
import { useTenantStore } from "@/store/tenant";

interface Props {
  children: React.ReactNode;
}

/** Route guard: Django superuser on a platform (is_platform) workspace. */
export default function RequirePlatformAdmin({ children }: Props) {
  const user = useAuthStore((s) => s.user);
  const isPlatform = !!useTenantStore((s) => s.tenant?.is_platform);

  if (!user?.is_superuser || !isPlatform) {
    return (
      <Result
        status="403"
        title="Platform workspace only"
        subTitle="Tenant provisioning is available only on the platform control-plane workspace."
      />
    );
  }

  return <>{children}</>;
}
