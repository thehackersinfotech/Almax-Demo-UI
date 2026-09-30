import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Typography, Card, Row, Col, Tag, Button, Checkbox, Space, Spin,
  message, Breadcrumb, Alert, Divider,
} from "antd";
import {
  ArrowLeftOutlined, SaveOutlined, EditOutlined, SafetyCertificateOutlined,
} from "@ant-design/icons";
import { rolesApi, type PermissionCategory } from "@/services/roles";
import PermGuard from "@/components/common/PermGuard";
import { PERMS } from "@/constants/permissions";
import { usePermission } from "@/hooks/usePermission";
import { apiErrorMsg } from "@/utils/apiError";
import { useTenantStore } from "@/store/tenant";
import { filterPermissionCatalogByPlan } from "@/utils/planModules";

const { Title, Text } = Typography;

export default function RoleDetailPage() {
  const { roleId = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const canManage = usePermission(PERMS.ROLE_PERMISSION_ASSIGN);
  const modules = useTenantStore((s) => s.tenant?.modules);

  const [editing, setEditing] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: role, isLoading, isError } = useQuery({
    queryKey: ["role", roleId],
    queryFn: () => rolesApi.get(roleId),
    enabled: !!roleId,
  });

  const allCategories = role?.categories;
  // Hide groups for modules not on the current plan; keep assigned out-of-plan
  // permissions in `selected` so Save does not strip them.
  const categories = useMemo(
    () => filterPermissionCatalogByPlan(allCategories ?? [], modules),
    [allCategories, modules],
  );

  useEffect(() => {
    if (role) setSelected(new Set(role.permissions));
  }, [role]);

  useEffect(() => {
    if (!categories.length) {
      setActiveCategory(null);
      return;
    }
    if (activeCategory && !categories.some((c) => c.category === activeCategory)) {
      setActiveCategory(categories[0].category);
    }
  }, [categories, activeCategory]);

  const currentCategory = useMemo(() => {
    if (!categories.length) return null;
    const key = activeCategory ?? categories[0].category;
    return categories.find((c) => c.category === key) ?? categories[0];
  }, [categories, activeCategory]);

  const syncSelectedFromRole = () => {
    if (role) setSelected(new Set(role.permissions));
  };

  const startEdit = () => {
    syncSelectedFromRole();
    setEditing(true);
  };

  const cancelEdit = () => {
    syncSelectedFromRole();
    setEditing(false);
  };

  const togglePerm = (name: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(name);
      else next.delete(name);
      return next;
    });
  };

  const toggleCategoryAll = (cat: PermissionCategory, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const p of cat.permissions) {
        if (checked) next.add(p.name);
        else next.delete(p.name);
      }
      return next;
    });
  };

  const saveMutation = useMutation({
    mutationFn: () => rolesApi.updatePermissions(roleId, Array.from(selected).sort()),
    onSuccess: () => {
      message.success("Permissions saved to Keycloak");
      qc.invalidateQueries({ queryKey: ["role", roleId] });
      qc.invalidateQueries({ queryKey: ["roles"] });
      setEditing(false);
    },
    onError: (e: unknown) => message.error(apiErrorMsg(e, "Failed to save permissions")),
  });

  if (isLoading) {
    return (
      <div style={{ textAlign: "center", padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (isError || !role) {
    return (
      <Alert
        type="error"
        message="Role not found"
        description="Could not load this role from Keycloak."
        action={<Button onClick={() => navigate("/settings/roles")}>Back to roles</Button>}
      />
    );
  }

  const categoryCheckedCount = (cat: PermissionCategory) =>
    cat.permissions.filter((p) => selected.has(p.name)).length;

  return (
    <div>
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[
          { title: <a onClick={() => navigate("/settings/roles")}>Role Management</a> },
          { title: role.name },
        ]}
      />

      <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
        <Col>
          <Space align="center">
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/settings/roles")} />
            <Title level={3} style={{ margin: 0 }}>Role Details — {role.name}</Title>
            <Tag color="success">Active</Tag>
          </Space>
        </Col>
        <Col>
          {editing ? (
            <Space>
              <Button onClick={cancelEdit}>Cancel</Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                loading={saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
              >
                Save Permissions
              </Button>
            </Space>
          ) : (
            <PermGuard permission={PERMS.ROLE_PERMISSION_ASSIGN}>
              <Button type="primary" icon={<EditOutlined />} onClick={startEdit}>
                Edit
              </Button>
            </PermGuard>
          )}
          {!canManage && !editing && (
            <Text type="secondary" style={{ marginLeft: 12, fontSize: 12 }}>View only</Text>
          )}
        </Col>
      </Row>

      <Card style={{ marginBottom: 20 }}>
        <Row gutter={24}>
          <Col span={8}>
            <Text type="secondary">Role Name</Text>
            <div><Text strong>{role.name}</Text></div>
          </Col>
          <Col span={8}>
            <Text type="secondary">Description</Text>
            <div><Text>{role.description || "—"}</Text></div>
          </Col>
          <Col span={8}>
            <Text type="secondary">Users Assigned</Text>
            <div><Text strong>{role.users_assigned}</Text></div>
          </Col>
        </Row>
      </Card>

      <Card
        title={
          <Space>
            <SafetyCertificateOutlined style={{ color: "#1677ff" }} />
            <span>Assign Permissions / Rights</span>
            <Tag>{selected.size} selected</Tag>
          </Space>
        }
      >
        {Array.isArray(modules) && (allCategories?.length ?? 0) > categories.length && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="Showing permissions for your current plan"
            description="Modules not included in your plan are hidden here. Any rights already assigned for those modules are kept when you save."
          />
        )}
        <Row gutter={0}>
          <Col
            xs={24}
            md={6}
            className="role-detail__sidebar"
            style={{
              paddingRight: 0,
              maxHeight: 520,
              overflowY: "auto",
            }}
          >
            {categories.map((cat) => {
              const count = categoryCheckedCount(cat);
              const active = currentCategory?.category === cat.category;
              return (
                <div
                  key={cat.category}
                  onClick={() => setActiveCategory(cat.category)}
                  style={{
                    padding: "12px 16px",
                    cursor: "pointer",
                    borderLeft: active ? "3px solid var(--bms-primary)" : "3px solid transparent",
                    background: active ? "color-mix(in srgb, var(--bms-primary) 15%, var(--bms-surface))" : "transparent",
                    fontWeight: active ? 600 : 400,
                    color: active ? "var(--bms-primary)" : "var(--bms-text)",
                  }}
                >
                  {cat.category_label}
                  {count > 0 && (
                    <Tag style={{ marginLeft: 8, fontSize: 10 }}>{count}</Tag>
                  )}
                </div>
              );
            })}
          </Col>

          <Col xs={24} md={18} style={{ padding: "16px 24px", maxHeight: 520, overflowY: "auto" }}>
            {currentCategory ? (
              <>
                <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
                  <Col>
                    <Title level={5} style={{ margin: 0 }}>{currentCategory.category_label}</Title>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {currentCategory.permissions.length} permission{currentCategory.permissions.length !== 1 ? "s" : ""}
                    </Text>
                  </Col>
                  {editing && (
                    <Col>
                      <Checkbox
                        checked={currentCategory.permissions.every((p) => selected.has(p.name))}
                        indeterminate={
                          currentCategory.permissions.some((p) => selected.has(p.name))
                          && !currentCategory.permissions.every((p) => selected.has(p.name))
                        }
                        onChange={(e) => toggleCategoryAll(currentCategory, e.target.checked)}
                      >
                        Select all in category
                      </Checkbox>
                    </Col>
                  )}
                </Row>
                <Divider style={{ margin: "12px 0" }} />
                <Row gutter={[16, 12]}>
                  {currentCategory.permissions.map((perm) => (
                    <Col span={12} key={perm.name}>
                      <Checkbox
                        checked={selected.has(perm.name)}
                        disabled={!editing}
                        onChange={(e) => togglePerm(perm.name, e.target.checked)}
                      >
                        <div>
                          <Text style={{ fontSize: 13 }}>{perm.description || perm.label}</Text>
                          <br />
                          <Text type="secondary" style={{ fontSize: 11, fontFamily: "monospace" }}>
                            {perm.name}
                          </Text>
                        </div>
                      </Checkbox>
                    </Col>
                  ))}
                </Row>
              </>
            ) : (
              <Text type="secondary">No permissions in catalog</Text>
            )}
          </Col>
        </Row>
      </Card>

      <style>{`
        .role-detail__sidebar { border-right: 1px solid #e8edf3; }
        @media (max-width: 767px) {
          .role-detail__sidebar {
            border-right: none;
            border-bottom: 1px solid #e8edf3;
            max-height: 240px !important;
          }
        }
      `}</style>
    </div>
  );
}
