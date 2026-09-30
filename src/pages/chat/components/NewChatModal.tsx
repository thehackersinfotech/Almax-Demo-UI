import React, { useState } from "react";
import {
  Modal, Tabs, Input, List, Avatar, Checkbox, Button, Spin, Tag, message as toast
} from "antd";
import {
  UserOutlined, UsergroupAddOutlined, ProjectOutlined, SearchOutlined, PlusOutlined
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { employeeApi, SimpleDropdownEmployee } from "@/services/employees";
import { projectsApi, Project } from "@/services/projects";
import { chatApi, ConversationListItem } from "@/services/chat";

interface NewChatModalProps {
  open: boolean;
  onClose: () => void;
  onSelectOrCreateConversation: (conv: ConversationListItem) => void;
  myId?: string;
  existingConversations: ConversationListItem[];
}

export const NewChatModal: React.FC<NewChatModalProps> = ({
  open,
  onClose,
  onSelectOrCreateConversation,
  myId,
  existingConversations,
}) => {
  const [activeTab, setActiveTab] = useState<"staff" | "group" | "project">("staff");
  const [searchQuery, setSearchQuery] = useState("");

  // Group creation state
  const [groupName, setGroupName] = useState("");
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  // Queries
  const employeesQuery = useQuery({
    queryKey: ["employees", "simpleDropdown"],
    queryFn: () => employeeApi.simpleDropdown(),
    enabled: open,
  });

  const projectsQuery = useQuery({
    queryKey: ["projects", "list"],
    queryFn: () => projectsApi.list({ is_active: true, page_size: 100 }),
    enabled: open,
  });

  const staffList: SimpleDropdownEmployee[] = (employeesQuery.data ?? []).filter(
    (emp) => emp.id && emp.id !== myId
  );
  const filteredStaff = staffList.filter(
    (emp) =>
      emp.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.employee_code?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const projectsList: Project[] = Array.isArray(projectsQuery.data)
    ? projectsQuery.data
    : projectsQuery.data?.results ?? [];
  const filteredProjects = projectsList.filter(
    (p) =>
      p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.client_name && p.client_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Handle starting direct chat with individual staff
  const handleStartDirectChat = async (staff: SimpleDropdownEmployee) => {
    // 1. Check if direct conversation already exists in conversation list
    const existing = existingConversations.find(
      (c) =>
        c.type === "DIRECT" &&
        c.participants?.some((p) => p.employee?.id === staff.id)
    );

    if (existing) {
      onSelectOrCreateConversation(existing);
      onClose();
      return;
    }

    const staffParticipant = {
      id: `p_${staff.id}`,
      employee: {
        id: staff.id,
        full_name: staff.full_name,
        email: staff.email,
        profile_picture_url: (staff as any).profile_picture_url || null,
      },
      role: "MEMBER" as const,
      is_favorite: false,
      muted: false,
      last_read_at: new Date().toISOString(),
    };

    // 2. Call Backend API to create permanent PostgreSQL conversation
    try {
      const newConv = await chatApi.createConversation({
        type: "DIRECT",
        participant_ids: [staff.id],
      });
      if (newConv && newConv.id) {
        const fullConv: ConversationListItem = {
          ...newConv,
          name: staff.full_name,
          participants: (newConv.participants && newConv.participants.length > 0)
            ? newConv.participants
            : [staffParticipant],
        };
        onSelectOrCreateConversation(fullConv);
        onClose();
        return;
      }
    } catch (apiErr) {
      console.warn("Backend conversation creation error:", apiErr);
    }

    // Fallback: local conversation item if backend was temporarily unreachable
    const fallbackConv: ConversationListItem = {
      id: `direct_${staff.id}`,
      type: "DIRECT",
      name: staff.full_name,
      avatar_url: (staff as any).profile_picture_url || null,
      is_archived: false,
      last_message_at: new Date().toISOString(),
      participants: [staffParticipant],
      unread_count: 0,
      is_favorite: false,
      last_message_preview: null,
    };

    onSelectOrCreateConversation(fallbackConv);
    onClose();
  };

  // Handle creating group with multiple staff members
  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      toast.error("Please enter a group name");
      return;
    }
    if (selectedStaffIds.length === 0) {
      toast.error("Please select at least 1 staff member");
      return;
    }

    setIsCreatingGroup(true);
    try {
      const newGroup = await chatApi.createConversation({
        type: "GROUP",
        name: groupName.trim(),
        participant_ids: selectedStaffIds,
      });
      if (newGroup && newGroup.id) {
        toast.success("Group created!");
        onSelectOrCreateConversation(newGroup);
        setGroupName("");
        setSelectedStaffIds([]);
        setIsCreatingGroup(false);
        onClose();
        return;
      }
    } catch (apiErr) {
      console.warn("Backend group creation error:", apiErr);
    }

    const fallbackGroup: ConversationListItem = {
      id: `group_${Date.now()}`,
      type: "GROUP",
      name: groupName.trim(),
      avatar_url: null,
      is_archived: false,
      last_message_at: new Date().toISOString(),
      participants: selectedStaffIds.map((id) => {
        const st = staffList.find((s) => s.id === id);
        return {
          id: `p_${id}`,
          employee: {
            id: id,
            full_name: st?.full_name || "Staff Member",
            email: st?.email || "",
            profile_picture_url: null,
          },
          role: "MEMBER",
          is_favorite: false,
          muted: false,
          last_read_at: new Date().toISOString(),
        };
      }),
      unread_count: 0,
      is_favorite: false,
      last_message_preview: null,
    };

    toast.success("Group created!");
    onSelectOrCreateConversation(fallbackGroup);
    setGroupName("");
    setSelectedStaffIds([]);
    setIsCreatingGroup(false);
    onClose();
  };

  // Handle launching client project chat
  const handleStartProjectChat = async (project: Project) => {
    const groupTitle = `Project: ${project.name}`;
    const existing = existingConversations.find(
      (c) => c.type === "GROUP" && c.name?.toLowerCase() === groupTitle.toLowerCase()
    );

    if (existing) {
      onSelectOrCreateConversation(existing);
      onClose();
      return;
    }

    try {
      let participantIds = staffList.slice(0, 5).map((s) => s.id);
      if (participantIds.length > 0) {
        const newGroup = await chatApi.createConversation({
          type: "GROUP",
          name: groupTitle,
          participant_ids: participantIds,
        });
        if (newGroup && newGroup.id) {
          onSelectOrCreateConversation(newGroup);
          onClose();
          return;
        }
      }
    } catch (apiErr) {
      console.warn("Backend project group creation error:", apiErr);
    }

    const fallbackProjectGroup: ConversationListItem = {
      id: `project_${project.id}`,
      type: "GROUP",
      name: groupTitle,
      avatar_url: null,
      is_archived: false,
      last_message_at: new Date().toISOString(),
      participants: staffList.slice(0, 5).map((st) => ({
        id: `p_${st.id}`,
        employee: {
          id: st.id,
          full_name: st.full_name,
          email: st.email,
          profile_picture_url: null,
        },
        role: "MEMBER",
        is_favorite: false,
        muted: false,
        last_read_at: new Date().toISOString(),
      })),
      unread_count: 0,
      is_favorite: false,
      last_message_preview: null,
    };

    onSelectOrCreateConversation(fallbackProjectGroup);
    onClose();
  };

  const toggleSelectStaff = (id: string) => {
    if (selectedStaffIds.includes(id)) {
      setSelectedStaffIds(selectedStaffIds.filter((item) => item !== id));
    } else {
      setSelectedStaffIds([...selectedStaffIds, id]);
    }
  };

  return (
    <Modal
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <UsergroupAddOutlined style={{ color: "#1890ff" }} />
          <span>New Chat</span>
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={540}
    >
      <Tabs
        activeKey={activeTab}
        onChange={(k) => {
          setActiveTab(k as any);
          setSearchQuery("");
        }}
        items={[
          {
            key: "staff",
            label: (
              <span>
                <UserOutlined /> Individual Staff
              </span>
            ),
          },
          {
            key: "group",
            label: (
              <span>
                <UsergroupAddOutlined /> New Group
              </span>
            ),
          },
          {
            key: "project",
            label: (
              <span>
                <ProjectOutlined /> Client Project
              </span>
            ),
          },
        ]}
      />

      <Input
        prefix={<SearchOutlined style={{ color: "#bfbfbf" }} />}
        placeholder={
          activeTab === "project" ? "Search client projects..." : "Search staff by name, code or email..."
        }
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        style={{ marginBottom: 16 }}
      />

      {activeTab === "staff" && (
        <div style={{ maxHeight: 360, overflowY: "auto" }}>
          {employeesQuery.isLoading ? (
            <div style={{ textAlign: "center", padding: 30 }}><Spin /></div>
          ) : (
            <List
              itemLayout="horizontal"
              dataSource={filteredStaff}
              renderItem={(staff) => (
                <List.Item
                  onClick={() => handleStartDirectChat(staff)}
                  style={{
                    cursor: "pointer",
                    padding: "10px 12px",
                    borderRadius: 8,
                    transition: "background 0.2s",
                  }}
                  className="chat-list-hover"
                >
                  <List.Item.Meta
                    avatar={<Avatar style={{ background: "#1890ff" }}>{staff.full_name?.charAt(0) || "S"}</Avatar>}
                    title={<span style={{ fontWeight: 600 }}>{staff.full_name}</span>}
                    description={
                      <span style={{ fontSize: 12 }}>
                        {staff.designation_name || "Staff"} • {staff.email}
                      </span>
                    }
                  />
                </List.Item>
              )}
            />
          )}
        </div>
      )}

      {activeTab === "group" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontWeight: 600, fontSize: 13, display: "block", marginBottom: 6 }}>
              Group Name
            </label>
            <Input
              placeholder="e.g. Marketing Team, Product Development..."
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
          </div>

          <div>
            <label style={{ fontWeight: 600, fontSize: 13, display: "block", marginBottom: 6 }}>
              Select Group Members ({selectedStaffIds.length} selected)
            </label>
            <div style={{ maxHeight: 240, overflowY: "auto", border: "1px solid #f0f0f0", borderRadius: 8 }}>
              <List
                itemLayout="horizontal"
                dataSource={filteredStaff}
                renderItem={(staff) => {
                  const isSelected = selectedStaffIds.includes(staff.id);
                  return (
                    <List.Item
                      onClick={() => toggleSelectStaff(staff.id)}
                      style={{
                        cursor: "pointer",
                        padding: "8px 12px",
                        background: isSelected ? "#e6f7ff" : "transparent",
                      }}
                    >
                      <Checkbox checked={isSelected} style={{ marginRight: 12 }} />
                      <List.Item.Meta
                        avatar={<Avatar size={32} style={{ background: "#722ed1" }}>{staff.full_name?.charAt(0) || "S"}</Avatar>}
                        title={<span style={{ fontSize: 13, fontWeight: 600 }}>{staff.full_name}</span>}
                        description={<span style={{ fontSize: 11 }}>{staff.designation_name || "Staff"}</span>}
                      />
                    </List.Item>
                  );
                }}
              />
            </div>
          </div>

          <Button
            type="primary"
            icon={<PlusOutlined />}
            loading={isCreatingGroup}
            onClick={handleCreateGroup}
            block
            size="large"
            style={{ marginTop: 8 }}
          >
            Create Group Chat
          </Button>
        </div>
      )}

      {activeTab === "project" && (
        <div style={{ maxHeight: 360, overflowY: "auto" }}>
          {projectsQuery.isLoading ? (
            <div style={{ textAlign: "center", padding: 30 }}><Spin /></div>
          ) : (
            <List
              itemLayout="horizontal"
              dataSource={filteredProjects}
              renderItem={(proj) => (
                <List.Item
                  onClick={() => handleStartProjectChat(proj)}
                  style={{
                    cursor: "pointer",
                    padding: "10px 12px",
                    borderRadius: 8,
                    transition: "background 0.2s",
                  }}
                  className="chat-list-hover"
                >
                  <List.Item.Meta
                    avatar={
                      <Avatar shape="square" style={{ background: "#52c41a" }}>
                        <ProjectOutlined />
                      </Avatar>
                    }
                    title={
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 600 }}>{proj.name}</span>
                        {proj.code && <Tag color="blue">{proj.code}</Tag>}
                      </div>
                    }
                    description={
                      <span style={{ fontSize: 12 }}>
                        Client: {proj.client_name || "N/A"} • Manager: {proj.manager_name || "N/A"}
                      </span>
                    }
                  />
                </List.Item>
              )}
            />
          )}
        </div>
      )}
    </Modal>
  );
};

export default NewChatModal;
