import { useQuery } from "@tanstack/react-query";
import {
  Alert, Card, Col, Progress, Row, Skeleton, Space, Tag, Typography,
} from "antd";
import {
  CheckCircleFilled,
  CloseCircleOutlined,
  CrownOutlined,
  ProjectOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { planApi, type WorkspacePlan } from "@/services/plan";
import type { PlanDefinition } from "@/services/platformTenants";

const { Title, Text } = Typography;

const MODULE_LABELS: Record<string, string> = {
  hms: "People / HR",
  workspace: "Workspace",
  master: "Master data",
  policy: "Policies",
  role: "Roles & permissions",
  plan: "Plan & usage",
  project: "Projects",
  crm: "CRM",
  finance: "Finance",
  executive: "Executive dashboard",
  chat: "Chat",
};

const ALL_MODULES = Object.keys(MODULE_LABELS);

function moduleLabel(key: string): string {
  return MODULE_LABELS[key] ?? key;
}

function limitText(limit: number | null | undefined): string {
  return limit === null || limit === undefined ? "Unlimited" : String(limit);
}

function formatPrice(value: number | null | undefined): string {
  return value == null ? "Custom" : `₹${value.toLocaleString("en-IN")}`;
}

function UsageCard({
  title,
  used,
  limit,
  icon,
}: {
  title: string;
  used: number;
  limit: number | null | undefined;
  icon: React.ReactNode;
}) {
  const unlimited = limit === null || limit === undefined;
  const percent = unlimited || limit === 0 ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const status = !unlimited && limit !== 0 && used >= limit ? "exception" : "normal";

  return (
    <Card className="plan-usage-meter" variant="borderless">
      <div className="plan-usage-meter__heading">
        <span className="plan-usage-meter__icon">{icon}</span>
        <Text type="secondary">{title}</Text>
      </div>
      <div className="plan-usage-meter__value">
        {used}
        <Text type="secondary"> / {limitText(limit)}</Text>
      </div>
      <Progress
        percent={percent}
        status={status}
        showInfo={!unlimited}
        strokeColor="var(--bms-primary)"
        trailColor="var(--bms-surface-2)"
      />
      <Text type="secondary" className="plan-usage-meter__caption">
        {unlimited ? "No usage limit" : `${Math.max(0, (limit ?? 0) - used)} remaining`}
      </Text>
    </Card>
  );
}

function PlanOption({
  option,
  current,
}: {
  option: PlanDefinition;
  current: boolean;
}) {
  const included = new Set(option.modules);

  return (
    <Card
      className={`plan-option${current ? " plan-option--current" : ""}`}
      variant={!current ? "outlined" : "borderless"}
    >
      <div className="plan-option__top">
        <div>
          <Space size={8}>
            <Title level={4}>{option.name}</Title>
            {current && <Tag color="blue">Current plan</Tag>}
          </Space>
          <Text type="secondary">{option.description}</Text>
        </div>
        {current && <CrownOutlined className="plan-option__crown" />}
      </div>

      <div className="plan-option__price">
        <strong>{formatPrice(option.monthly_inr)}</strong>
        {option.monthly_inr != null && <Text type="secondary"> / month</Text>}
      </div>
      <Text type="secondary">
        {formatPrice(option.annual_inr)} annually · {limitText(option.max_employees)} users
      </Text>

      <div className="plan-option__features">
        {ALL_MODULES.map((module) => (
          <div
            className={`plan-option__feature${included.has(module) ? "" : " plan-option__feature--muted"}`}
            key={module}
          >
            {included.has(module)
              ? <CheckCircleFilled aria-hidden />
              : <CloseCircleOutlined aria-hidden />}
            <span>{moduleLabel(module)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function PlanUsagePage() {
  const { data, isLoading, isError, refetch } = useQuery<WorkspacePlan>({
    queryKey: ["workspace-plan"],
    queryFn: () => planApi.current(),
  });

  if (isLoading) {
    return (
      <div className="plan-page" aria-busy="true">
        <Skeleton active paragraph={{ rows: 2 }} />
        <Row gutter={[16, 16]}>
          {[1, 2, 3].map((item) => (
            <Col xs={24} md={8} key={item}>
              <Card><Skeleton active paragraph={{ rows: 4 }} /></Card>
            </Col>
          ))}
        </Row>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Alert
        type="error"
        showIcon
        message="Unable to load your plan details"
        description="Please check your connection and try again."
        action={<a onClick={() => refetch()}>Try again</a>}
      />
    );
  }

  const { plan, catalog, usage, limits, at_limit: atLimit } = data;
  const entitled = new Set(plan.modules);

  return (
    <div className="plan-page">
      <div className="plan-page__header">
        <div>
          <Text className="plan-page__eyebrow">Workspace subscription</Text>
          <Title level={2}>Plan &amp; Usage</Title>
          <Text type="secondary">
            Review limits and features for <strong>{data.tenant.name}</strong>.
          </Text>
        </div>
        <Tag color={data.tenant.status === "active" ? "success" : "warning"}>
          {data.tenant.status}
        </Tag>
      </div>

      {(atLimit?.employees || atLimit?.projects) && (
        <Alert
          className="plan-page__limit-alert"
          type="warning"
          showIcon
          message="You have reached a plan limit"
          description="New records in the affected area are blocked. Contact your platform administrator to upgrade."
        />
      )}

      <Card className="plan-current" variant="borderless">
        <div className="plan-current__summary">
          <div className="plan-current__icon"><CrownOutlined /></div>
          <div>
            <Text type="secondary">Current plan</Text>
            <Space size={8} align="center">
              <Title level={2}>{plan.name}</Title>
              <Tag color="blue">Active</Tag>
            </Space>
            <Text type="secondary">{plan.description}</Text>
          </div>
          <div className="plan-current__price">
            <strong>{formatPrice(plan.monthly_inr)}</strong>
            {plan.monthly_inr != null && <Text type="secondary"> / month</Text>}
            <Text type="secondary">{formatPrice(plan.annual_inr)} billed annually</Text>
          </div>
        </div>

        <Row gutter={[16, 16]} className="plan-current__meters">
          <Col xs={24} sm={12}>
            <UsageCard
              title="Employees"
              used={usage?.employees ?? 0}
              limit={limits?.max_employees ?? plan.max_employees}
              icon={<TeamOutlined />}
            />
          </Col>
          {entitled.has("project") && (
            <Col xs={24} sm={12}>
              <UsageCard
                title="Projects"
                used={usage?.projects ?? 0}
                limit={limits?.max_projects ?? plan.max_projects}
                icon={<ProjectOutlined />}
              />
            </Col>
          )}
        </Row>
      </Card>

      <section className="plan-page__section" aria-labelledby="included-modules-heading">
        <div className="plan-page__section-heading">
          <div>
            <Title level={3} id="included-modules-heading">Your modules</Title>
            <Text type="secondary">Features available in the {plan.name} plan.</Text>
          </div>
          <Text type="secondary">{entitled.size} of {ALL_MODULES.length} included</Text>
        </div>
        <div className="plan-modules">
          {ALL_MODULES.map((m) => (
            <div
              key={m}
              className={`plan-module${entitled.has(m) ? " plan-module--included" : ""}`}
            >
              {entitled.has(m) ? <CheckCircleFilled /> : <CloseCircleOutlined />}
              <span>{moduleLabel(m)}</span>
              <small>{entitled.has(m) ? "Included" : "Upgrade required"}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="plan-page__section" aria-labelledby="compare-plans-heading">
        <div className="plan-page__section-heading">
          <div>
            <Title level={3} id="compare-plans-heading">Compare plans</Title>
            <Text type="secondary">
              Contact your platform administrator when you are ready to change plans.
            </Text>
          </div>
        </div>
        <Row gutter={[16, 16]}>
          {catalog.map((option) => (
            <Col xs={24} lg={8} key={option.slug}>
              <PlanOption option={option} current={option.slug === plan.slug} />
            </Col>
          ))}
        </Row>
      </section>
    </div>
  );
}
