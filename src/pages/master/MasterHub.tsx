import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { useAuthStore } from "@/store/auth";
import { useTenantStore } from "@/store/tenant";
import { hasPermission } from "@/utils/access";
import { planHasModule } from "@/utils/planModules";
import { MASTER_CATEGORIES, type MasterCategoryDef, type MasterItemDef } from "./masterConfig";
import "./master.css";

function filterCategories(
  categories: MasterCategoryDef[],
  query: string,
  canView: (item: MasterItemDef) => boolean,
  modules: string[] | null | undefined,
): MasterCategoryDef[] {
  const q = query.trim().toLowerCase();
  return categories
    .map((cat) => ({
      ...cat,
      items: cat.items.filter((item) => {
        if (!planHasModule(modules, item.module)) return false;
        if (!canView(item)) return false;
        if (!q) return true;
        return (
          item.label.toLowerCase().includes(q)
          || item.description.toLowerCase().includes(q)
          || cat.title.toLowerCase().includes(q)
        );
      }),
    }))
    .filter((cat) => cat.items.length > 0);
}

export default function MasterHub() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const user = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);
  const modules = useTenantStore((s) => s.tenant?.modules);

  const canView = (item: MasterItemDef) => {
    if (!user) return false;
    return true;
  };

  const visibleCategories = useMemo(
    () => filterCategories(MASTER_CATEGORIES, search, canView, modules),
    [search, user, permissions, modules],
  );

  return (
    <div className="master-hub">
      <div className="master-hub-header">
        <div>
          <h1 className="master-hub-title">Master Configuration</h1>
          <p className="master-hub-subtitle">
            Manage organization reference data and workflow settings
          </p>
        </div>
        <Input
          className="master-hub-search"
          placeholder="Search masters…"
          prefix={<SearchOutlined style={{ color: "var(--bms-text-3)" }} />}
          allowClear
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {visibleCategories.length === 0 ? (
        <div className="master-hub-empty">
          No master configurations match your search, permissions, or current plan.
        </div>
      ) : (
        visibleCategories.map((category) => (
          <section key={category.key} className="master-category">
            <h2 className="master-category-title">{category.title}</h2>
            <div className="master-card-grid">
              {category.items.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className="master-card"
                  onClick={() => navigate(`/master/${item.key}`)}
                >
                  <div className="master-card-icon" style={{ background: item.accent }}>
                    {item.icon}
                  </div>
                  <div className="master-card-body">
                    <span className="master-card-label">{item.label}</span>
                    <span className="master-card-desc">{item.description}</span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
