import type { TicketListItem } from "@/services/tickets";

export interface TicketTreeNode extends TicketListItem {
  children: TicketTreeNode[];
}

/** Build a parent → child tree from a flat ticket list.
 *
 *  Cycle-safe: if a circular reference is detected (parent eventually points
 *  back to the child), the cycle is broken and the ticket is treated as a root
 *  instead of disappearing from the tree. */
export function buildTicketTree(tickets: TicketListItem[]): TicketTreeNode[] {
  const map = new Map<string, TicketTreeNode>();

  tickets.forEach((t) => {
    map.set(t.id, { ...t, children: [] });
  });

  const roots: TicketTreeNode[] = [];

  tickets.forEach((t) => {
    const node = map.get(t.id)!;
    if (t.parent && map.has(t.parent)) {
      // Walk up from the proposed parent — if we ever reach this node's ID,
      // it's a circular reference. Break the cycle by treating it as a root.
      let isCircular = false;
      const seen = new Set<string>([t.id]);
      let currentParentId: string | null = t.parent;
      while (currentParentId && map.has(currentParentId)) {
        if (seen.has(currentParentId)) {
          isCircular = true;
          break;
        }
        seen.add(currentParentId);
        const parentTicket = map.get(currentParentId)!;
        currentParentId = parentTicket.parent;
      }

      if (isCircular) {
        roots.push(node);
      } else {
        map.get(t.parent)!.children.push(node);
      }
    } else {
      roots.push(node);
    }
  });

  const sortNodes = (nodes: TicketTreeNode[]) => {
    nodes.sort((a, b) => a.ticket_id.localeCompare(b.ticket_id));
    nodes.forEach((n) => sortNodes(n.children));
  };

  sortNodes(roots);
  return roots;
}

/** Keep matching tickets and their ancestor chain for search/filter views. */
export function filterTicketsWithAncestors(
  tickets: TicketListItem[],
  predicate: (t: TicketListItem) => boolean,
): { tickets: TicketListItem[]; expandIds: Set<string> } {
  if (!tickets.length) return { tickets: [], expandIds: new Set() };

  const byId = new Map(tickets.map((t) => [t.id, t]));
  const keep = new Set<string>();
  const expandIds = new Set<string>();

  const addWithAncestors = (id: string) => {
    let current = byId.get(id);
    const seen = new Set<string>();
    while (current) {
      if (seen.has(current.id)) break; // cycle guard
      seen.add(current.id);
      keep.add(current.id);
      if (current.parent && byId.has(current.parent)) {
        expandIds.add(current.parent);
        current = byId.get(current.parent);
      } else {
        break;
      }
    }
  };

  tickets.forEach((t) => {
    if (predicate(t)) addWithAncestors(t.id);
  });

  return {
    tickets: tickets.filter((t) => keep.has(t.id)),
    expandIds,
  };
}

export interface FlatTicketRow {
  node: TicketTreeNode;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
  animate: boolean;
}

/** Flatten visible rows for rendering based on expanded state. */
export function flattenTicketTree(
  roots: TicketTreeNode[],
  expanded: Set<string>,
  animateIds: Set<string> = new Set(),
): FlatTicketRow[] {
  const rows: FlatTicketRow[] = [];

  const walk = (nodes: TicketTreeNode[], depth: number) => {
    nodes.forEach((node) => {
      const hasChildren = node.children.length > 0;
      const isExpanded = expanded.has(node.id);
      rows.push({
        node,
        depth,
        hasChildren,
        isExpanded,
        animate: animateIds.has(node.id),
      });
      if (hasChildren && isExpanded) {
        walk(node.children, depth + 1);
      }
    });
  };

  walk(roots, 0);
  return rows;
}
