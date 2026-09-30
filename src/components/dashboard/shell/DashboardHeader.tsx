import type { ReactNode } from "react";
import { Typography } from "antd";

const { Title, Text } = Typography;

interface DashboardHeaderProps {
  title: string;
  subtitle?: string;
  periodControl?: ReactNode;
  actions?: ReactNode;
}

export default function DashboardHeader({
  title,
  subtitle,
  periodControl,
  actions,
}: DashboardHeaderProps) {
  return (
    <header className="dash-header">
      <div className="dash-header__titles">
        <Title level={3} className="dash-header__title">
          {title}
        </Title>
        {subtitle && (
          <Text className="dash-header__subtitle">{subtitle}</Text>
        )}
      </div>
      <div className="dash-header__actions">
        {periodControl}
        {actions}
      </div>
    </header>
  );
}
