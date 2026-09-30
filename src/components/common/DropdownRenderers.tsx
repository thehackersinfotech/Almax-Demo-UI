import React from 'react';
import { Divider, Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';

const ClientDropdownFooter = ({ onAdd }: { onAdd?: () => void }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  return (
    <Button
      type="text"
      block
      icon={<PlusOutlined />}
      onClick={(e) => {
        e.preventDefault();
        if (onAdd) {
          onAdd();
        } else {
          searchParams.set("add_client", "true");
          setSearchParams(searchParams);
        }
      }}
      style={{ textAlign: 'left', fontWeight: 500 }}
    >
      Add Client
    </Button>
  );
};

export const renderClientDropdown = (menu: React.ReactElement, onAdd?: () => void) => (
  <>
    {menu}
    <Divider style={{ margin: '4px 0' }} />
    <ClientDropdownFooter onAdd={onAdd} />
  </>
);

const ProjectDropdownFooter = ({ onAdd }: { onAdd?: () => void }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  return (
    <Button
      type="text"
      block
      icon={<PlusOutlined />}
      onClick={(e) => {
        e.preventDefault();
        if (onAdd) {
          onAdd();
        } else {
          searchParams.set("add_project", "true");
          setSearchParams(searchParams);
        }
      }}
      style={{ textAlign: 'left', fontWeight: 500 }}
    >
      Add Project
    </Button>
  );
};

export const renderProjectDropdown = (menu: React.ReactElement, onAdd?: () => void) => (
  <>
    {menu}
    <Divider style={{ margin: '4px 0' }} />
    <ProjectDropdownFooter onAdd={onAdd} />
  </>
);

/**
 * Format client & project name as `<Client Name> - <Project Name>`
 * Examples:
 *   formatClientProject("ABC Technologies", "Website Redesign") => "ABC Technologies - Website Redesign"
 *   formatClientProject("Acme Corp", null) => "Acme Corp"
 *   formatClientProject(null, "Website Redesign") => "Website Redesign"
 * Handles missing values safely without trailing/leading hyphens.
 */
export function formatClientProject(
  clientName?: string | null,
  projectName?: string | null,
  fallback = "—"
): string {
  const c = clientName?.trim();
  const p = projectName?.trim();
  if (c && p) {
    if (c.toLowerCase() === p.toLowerCase()) return c;
    return `${c} - ${p}`;
  }
  if (c) return c;
  if (p) return p;
  return fallback;
}

/**
 * Helper to format client and project as `<Client Name> - <Project Name>`.
 */
export function formatProjectClient(
  clientOrProject?: string | null,
  projectOrClient?: string | null,
  fallback = "—"
): string {
  return formatClientProject(clientOrProject, projectOrClient, fallback);
}

