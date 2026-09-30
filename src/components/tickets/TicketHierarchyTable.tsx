import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Pagination, Tooltip, Typography } from "antd";
import { CaretRightOutlined, EyeOutlined, FolderOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import {
  PriorityIcon, TypeIcon,
} from "@/components/tickets/TicketIcons";
import type { TicketListItem, TicketPriority } from "@/services/tickets";
import {
  buildTicketTree,
  filterTicketsWithAncestors,
  flattenTicketTree,
  type FlatTicketRow,
  type TicketTreeNode,
} from "@/utils/ticketTree";
import AssigneeAvatar from "@/components/common/AssigneeAvatar";
import "./TicketHierarchyTable.css";

const { Text } = Typography;

const PAGE_SIZE = 10;

interface ProjectGroup {
  projectId: string;
  projectCode: string;
  projectName: string;
  tree: TicketTreeNode[];
}

function hexToRgba(hex: string, alpha: number) {
  const h = hex.replace("#", "");
  if (h.length !== 6) return `rgba(95, 99, 104, ${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Workflow status — semantic color from state, pastel fill (not another blue link). */
function StatusChip({ name, color }: { name: string; color?: string }) {
  const accent = color || "#80868b";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "2px 8px", borderRadius: 6,
      background: hexToRgba(accent, 0.12),
      border: `1px solid ${hexToRgba(accent, 0.28)}`,
      fontSize: 11, fontWeight: 600, color: accent,
      whiteSpace: "nowrap",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: accent, flexShrink: 0 }} />
      {name}
    </span>
  );
}

interface TicketHierarchyTableProps {
  tickets: TicketListItem[];
  search?: string;
  loading?: boolean;
  pageSize?: number;
}

function groupTicketsByProject(tickets: TicketListItem[]): ProjectGroup[] {
  const byProject = new Map<string, TicketListItem[]>();
  tickets.forEach((t) => {
    const list = byProject.get(t.project) ?? [];
    list.push(t);
    byProject.set(t.project, list);
  });

  return Array.from(byProject.entries())
    .map(([projectId, projectTickets]) => ({
      projectId,
      projectCode: projectTickets[0].project_code,
      projectName: projectTickets[0].project_name,
      tree: buildTicketTree(projectTickets),
    }))
    .sort((a, b) => a.projectCode.localeCompare(b.projectCode));
}

function TicketRow({
  row,
  navigate,
  toggleExpand,
}: {
  row: FlatTicketRow;
  navigate: (path: string) => void;
  toggleExpand: (id: string, childIds: string[], e: React.MouseEvent) => void;
}) {
  const { node, depth, hasChildren, isExpanded, animate } = row;

  const navWithExpand = (targetId: string, parentId?: string | null) => {
    try {
      const saved = sessionStorage.getItem("bms_ticket_hierarchy_expanded");
      const set = saved ? new Set(JSON.parse(saved)) : new Set();
      if (parentId) set.add(parentId);
      set.delete(targetId);
      sessionStorage.setItem("bms_ticket_hierarchy_expanded", JSON.stringify(Array.from(set)));
    } catch {}
    navigate(`/tickets/${targetId}`);
  };

  return (
    <div
      className={`ticket-hierarchy__row${animate ? " ticket-hierarchy__row--animate" : ""}`}
      onDoubleClick={() => navWithExpand(node.id, node.parent)}
    >
      <Tooltip title={node.ticket_id}>
        <button
          type="button"
          className="ticket-hierarchy__id-link"
          onClick={(e) => {
            e.stopPropagation();
            navWithExpand(node.id, node.parent);
          }}
        >
          {node.ticket_id}
        </button>
      </Tooltip>

      <div className="ticket-hierarchy__title-cell">
        <span className="ticket-hierarchy__indent" style={{ width: depth * 20 }} />
        {hasChildren ? (
          <button
            type="button"
            className={`ticket-hierarchy__toggle${isExpanded ? " ticket-hierarchy__toggle--expanded" : ""}`}
            onClick={(e) => toggleExpand(node.id, node.children.map((c) => c.id), e)}
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            <CaretRightOutlined style={{ fontSize: 11 }} />
          </button>
        ) : (
          <span className="ticket-hierarchy__toggle-spacer" />
        )}
        <span className="ticket-hierarchy__type">
          <TypeIcon type={node.type} size={14} />
        </span>
        <Tooltip title={node.title}>
          <button
            type="button"
            className="ticket-hierarchy__title-link"
            onClick={() => navWithExpand(node.id, node.parent)}
          >
            {node.title}
          </button>
        </Tooltip>
      </div>

      <span className="ticket-hierarchy__status">
        {node.workflow_state_name ? (
          <StatusChip name={node.workflow_state_name} color={node.workflow_state_color} />
        ) : (
          <Text type="secondary">—</Text>
        )}
      </span>

      <span className="ticket-hierarchy__priority">
        <PriorityIcon priority={node.priority as TicketPriority} />
      </span>

      <span className="ticket-hierarchy__assignee">
        {node.assignee_name ? (
          <>
            <AssigneeAvatar name={node.assignee_name} size={22} />
            <Tooltip title={node.assignee_name}>
              <span className="ticket-hierarchy__assignee-name">{node.assignee_name}</span>
            </Tooltip>
          </>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>Unassigned</Text>
        )}
      </span>

      <span className="ticket-hierarchy__due">
        {node.due_date ? (
          <Text style={{
            fontSize: 12,
            color: dayjs(node.due_date).isBefore(dayjs()) ? "#ef4444" : "inherit",
          }}>
            {dayjs(node.due_date).format("DD MMM")}
          </Text>
        ) : (
          <Text type="secondary">—</Text>
        )}
      </span>

      <span className="ticket-hierarchy__updated">
        {node.is_final && node.updated_at ? (
          <Tooltip title={dayjs(node.updated_at).format("DD MMM YYYY, hh:mm A")}>
            <Text style={{ fontSize: 12, color: "#6b7280" }}>
              {dayjs(node.updated_at).format("DD MMM")}
            </Text>
          </Tooltip>
        ) : (
          <Text type="secondary">—</Text>
        )}
      </span>

      <span className="ticket-hierarchy__verified">
        {node.verified_by_name ? (
          <Tooltip title={`Verified by ${node.verified_by_name}`}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "#16a34a" }}>
              <AssigneeAvatar name={node.verified_by_name} size={18} />
              <span className="ticket-hierarchy__assignee-name">{node.verified_by_name}</span>
            </span>
          </Tooltip>
        ) : (
          <Text type="secondary">—</Text>
        )}
      </span>

      <span className="ticket-hierarchy__est">
        <Text style={{ fontSize: 12 }}>{node.original_estimate || 0}h</Text>
      </span>

      <span className="ticket-hierarchy__action">
        <Button
          size="small"
          type="text"
          icon={<EyeOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            navWithExpand(node.id, node.parent);
          }}
        />
      </span>
    </div>
  );
}

export default function TicketHierarchyTable({
  tickets,
  search = "",
  pageSize = PAGE_SIZE,
}: TicketHierarchyTableProps) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    try {
      const saved = sessionStorage.getItem("bms_ticket_hierarchy_expanded");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [animateIds, setAnimateIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);

  useEffect(() => {
    try {
      sessionStorage.setItem("bms_ticket_hierarchy_expanded", JSON.stringify(Array.from(expanded)));
    } catch {}
  }, [expanded]);

  const { filteredTickets, autoExpand } = useMemo(() => {
    const trimmed = search.trim();
    if (!trimmed) {
      return { filteredTickets: tickets, autoExpand: new Set<string>() };
    }

    const lower = trimmed.toLowerCase();
    const { tickets: filtered, expandIds } = filterTicketsWithAncestors(
      tickets,
      (t) =>
        t.ticket_id.toLowerCase().includes(lower) ||
        t.title.toLowerCase().includes(lower),
    );

    return { filteredTickets: filtered, autoExpand: expandIds };
  }, [tickets, search]);

  const projectGroups = useMemo(
    () => groupTicketsByProject(filteredTickets),
    [filteredTickets],
  );

  useEffect(() => {
    if (autoExpand.size > 0) {
      setExpanded((prev) => new Set([...prev, ...autoExpand]));
    }
  }, [autoExpand]);

  useEffect(() => {
    setPage(1);
  }, [search, tickets]);

  const totalGroups = projectGroups.length;
  const pagedGroups = projectGroups.slice((page - 1) * pageSize, page * pageSize);
  const showProjectHeaders = totalGroups > 1;

  const toggleExpand = (id: string, childIds: string[], e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        setAnimateIds(new Set(childIds));
        window.setTimeout(() => setAnimateIds(new Set()), 280);
      }
      return next;
    });
  };

  if (!filteredTickets.length) {
    return (
      <div className="ticket-hierarchy">
        <div className="ticket-hierarchy__empty">No tickets found</div>
      </div>
    );
  }

  return (
    <div className="ticket-hierarchy">
      <div className="ticket-hierarchy__head">
        <span>ID</span>
        <span>Work item</span>
        <span>Status</span>
        <span />
        <span>Assignee</span>
        <span>Due</span>
        <span>Updated</span>
        <span>Verified By</span>
        <span>Est</span>
        <span />
      </div>

      <div className="ticket-hierarchy__body">
        {pagedGroups.map((group) => {
          const rows = flattenTicketTree(group.tree, expanded, animateIds);
          if (!rows.length) return null;
          const ticketCount = filteredTickets.filter((t) => t.project === group.projectId).length;

          return (
            <div key={group.projectId} className="ticket-hierarchy__project">
              {showProjectHeaders && (
                <div className="ticket-hierarchy__project-head">
                  <FolderOutlined className="ticket-hierarchy__project-icon" />
                  <code className="ticket-hierarchy__project-code">{group.projectCode}</code>
                  <span className="ticket-hierarchy__project-name">{group.projectName}</span>
                  <span className="ticket-hierarchy__project-count">
                    {ticketCount} ticket{ticketCount !== 1 ? "s" : ""}
                  </span>
                </div>
              )}
              {rows.map((row) => (
                <TicketRow
                  key={row.node.id}
                  row={row}
                  navigate={navigate}
                  toggleExpand={toggleExpand}
                />
              ))}
            </div>
          );
        })}
      </div>

      {totalGroups > pageSize && (
        <div className="ticket-hierarchy__footer">
          <Pagination
            current={page}
            pageSize={pageSize}
            total={totalGroups}
            showSizeChanger={false}
            onChange={setPage}
            showTotal={(total, range) => `${range[0]}-${range[1]} of ${total} projects`}
          />
        </div>
      )}
    </div>
  );
}
