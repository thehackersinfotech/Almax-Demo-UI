// import { useState } from "react";
// import { useParams, useNavigate } from "react-router-dom";
// import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
// import {
//   Card, Tabs, Avatar, Typography, Tag, Button, Descriptions, Spin,
//   Form, Select, DatePicker, Input, Row, Col, Divider, message,
//   Space, Table, Empty, Badge,
// } from "antd";
// import {
//   UserOutlined, ArrowLeftOutlined, EditOutlined, SaveOutlined,
//   CloseOutlined, MailOutlined, PhoneOutlined,
// } from "@ant-design/icons";
// import dayjs from "dayjs";

// import { employeeApi, certificateApi, type EmployeeDetail, type Certificate } from "@/services/employees";
// import { designationApi, departmentApi, locationApi, gradeApi, employmentTypeApi } from "@/services/master";
// import OrgChart from "@/components/OrgChart";
// import AttendanceCalendar from "@/components/common/AttendanceCalendar";
// import { apiErrorMsg } from "@/utils/apiError";
// import { get } from "@/services/api";

// const { Text, Title } = Typography;

// const STATUS_COLOR: Record<string, string> = {
//   ACTIVE: "success", INACTIVE: "default", ON_LEAVE: "warning", RESIGNED: "error",
// };
// const STATUS_LABEL: Record<string, string> = {
//   ACTIVE: "Active", INACTIVE: "Inactive", ON_LEAVE: "On Leave", RESIGNED: "Resigned",
// };
// const GENDER_LABEL: Record<string, string> = { M: "Male", F: "Female", O: "Other" };

// function useDropdowns() {
//   const { data: designations = [] } = useQuery({ queryKey: ["dd", "designations"], queryFn: () => designationApi.dropdown(), staleTime: 60_000 });
//   const { data: departments = [] }  = useQuery({ queryKey: ["dd", "departments"],  queryFn: () => departmentApi.dropdown(),  staleTime: 60_000 });
//   const { data: locations = [] }    = useQuery({ queryKey: ["dd", "locations"],    queryFn: () => locationApi.dropdown(),    staleTime: 60_000 });
//   const { data: grades = [] }       = useQuery({ queryKey: ["dd", "grades"],       queryFn: () => gradeApi.dropdown(),       staleTime: 60_000 });
//   const { data: empTypes = [] }     = useQuery({ queryKey: ["dd", "emp-types"],    queryFn: () => employmentTypeApi.dropdown(), staleTime: 60_000 });
//   return { designations, departments, locations, grades, empTypes };
// }

// // ── Employment Tab ──────────────────────────────────────────────────────────────
// function EmploymentTab({ emp, editing, onStopEdit, form }: {
//   emp: EmployeeDetail; editing: boolean; onStopEdit: () => void; form: any;
// }) {
//   const { designations, departments, locations, empTypes } = useDropdowns();

//   if (!editing) {
//     return (
//       <div style={{ padding: "8px 0" }}>
//         <Descriptions
//           bordered
//           column={{ xs: 1, sm: 2 }}
//           size="small"
//           labelStyle={{ background: "#f8fafc", fontWeight: 600, width: 180, color: "#5a6a7e", fontSize: 13 }}
//           contentStyle={{ fontSize: 13, color: "#1a2332" }}
//         >
//           <Descriptions.Item label="Employee Code">
//             {emp.employee_code ? <Text code>{emp.employee_code}</Text> : "—"}
//           </Descriptions.Item>
//           <Descriptions.Item label="Status">
//             <Badge status={STATUS_COLOR[emp.status] as any} text={STATUS_LABEL[emp.status] ?? emp.status} />
//           </Descriptions.Item>
//           <Descriptions.Item label="Designation">{emp.designation_name || "—"}</Descriptions.Item>
//           <Descriptions.Item label="Department">{emp.department_name || "—"}</Descriptions.Item>
//           <Descriptions.Item label="Location">{emp.location_name || "—"}</Descriptions.Item>
//           <Descriptions.Item label="Employment Type">{emp.employment_type_name || "—"}</Descriptions.Item>
//           <Descriptions.Item label="Date of Joining">
//             {emp.joining_date ? dayjs(emp.joining_date).format("DD MMM YYYY") : "—"}
//           </Descriptions.Item>
//           <Descriptions.Item label="Total Experience">
//             {emp.total_experience ? `${emp.total_experience} years` : "—"}
//           </Descriptions.Item>
//           <Descriptions.Item label="Prior Experience">
//             {emp.prior_experience ? `${emp.prior_experience} years` : "—"}
//           </Descriptions.Item>
//           <Descriptions.Item label="Shift Applicable">{emp.shift_applicable ? "Yes" : "No"}</Descriptions.Item>
//           <Descriptions.Item label="Phone">{emp.phone_number || "—"}</Descriptions.Item>
//           <Descriptions.Item label="Roles">
//             <Space size={4}>
//               {emp.is_pmo && <Tag color="blue">PMO</Tag>}
//               {emp.is_manager && <Tag color="purple">Manager</Tag>}
//               {emp.is_staff && <Tag color="cyan">Admin</Tag>}
//               {!emp.is_pmo && !emp.is_manager && !emp.is_staff && <Text type="secondary">Member</Text>}
//             </Space>
//           </Descriptions.Item>
//         </Descriptions>
//       </div>
//     );
//   }

//   // total_experience = tenure_since_joining + prior_experience (read-only, auto-calc)
//   const recalcTotal = () => {
//     const joiningDate: dayjs.Dayjs | undefined = form.getFieldValue("joining_date");
//     const prior = parseFloat(form.getFieldValue("prior_experience") ?? 0) || 0;
//     if (joiningDate) {
//       const tenure = parseFloat((dayjs().diff(joiningDate, "day") / 365).toFixed(1));
//       form.setFieldsValue({ total_experience: parseFloat((tenure + prior).toFixed(1)) });
//     }
//   };

//   const onValuesChange = (changed: any) => {
//     if ("joining_date" in changed || "prior_experience" in changed) recalcTotal();
//   };

//   return (
//     <Form form={form} layout="vertical" style={{ marginTop: 8 }} onValuesChange={onValuesChange}>
//       <Text strong style={{ fontSize: 13, color: "#5a6a7e" }}>Position</Text>
//       <Divider style={{ margin: "8px 0 16px" }} />
//       <Row gutter={16}>
//         <Col span={12}>
//           <Form.Item name="designation_ref" label="Designation">
//             <Select showSearch placeholder="Select" allowClear
//               options={(designations as any[]).map((d) => ({ value: d.id, label: d.name }))}
//               filterOption={(i, o) => (o?.label as string)?.toLowerCase().includes(i.toLowerCase())} />
//           </Form.Item>
//         </Col>
//         <Col span={12}>
//           <Form.Item name="department_ref" label="Department">
//             <Select showSearch placeholder="Select" allowClear
//               options={(departments as any[]).map((d) => ({ value: d.id, label: d.name }))}
//               filterOption={(i, o) => (o?.label as string)?.toLowerCase().includes(i.toLowerCase())} />
//           </Form.Item>
//         </Col>
//       </Row>
//       <Row gutter={16}>
//         <Col span={12}>
//           <Form.Item name="location" label="Location">
//             <Select showSearch placeholder="Select" allowClear
//               options={(locations as any[]).map((l) => ({ value: l.id, label: l.name }))}
//               filterOption={(i, o) => (o?.label as string)?.toLowerCase().includes(i.toLowerCase())} />
//           </Form.Item>
//         </Col>
//         <Col span={12}>
//           <Form.Item name="employment_type" label="Employment Type">
//             <Select showSearch placeholder="Select" allowClear
//               options={(empTypes as any[]).map((e) => ({ value: e.id, label: e.name }))}
//               filterOption={(i, o) => (o?.label as string)?.toLowerCase().includes(i.toLowerCase())} />
//           </Form.Item>
//         </Col>
//       </Row>
//       <Row gutter={16}>
//         <Col span={12}>
//           <Form.Item name="joining_date" label="Date of Joining">
//             <DatePicker style={{ width: "100%" }} format="DD MMM YYYY" />
//           </Form.Item>
//         </Col>
//       </Row>
//       <Row gutter={16}>
//         <Col span={12}>
//           <Form.Item name="prior_experience" label="Prior Experience (yrs)" tooltip="Experience before joining">
//             <Input type="number" placeholder="2.0" min={0} step={0.1} />
//           </Form.Item>
//         </Col>
//         <Col span={12}>
//           <Form.Item name="total_experience" label="Total Experience (yrs)" tooltip="Auto-calculated: tenure + prior">
//             <Input type="number" placeholder="5.5" disabled style={{ background: "#f8fafc" }} />
//           </Form.Item>
//         </Col>
//       </Row>
//       <Row gutter={16}>
//         <Col span={12}>
//           <Form.Item name="phone_number" label="Phone Number">
//             <Input prefix={<PhoneOutlined />} placeholder="+91 9876543210" />
//           </Form.Item>
//         </Col>
//         <Col span={12}>
//           <Form.Item name="status" label="Status">
//             <Select options={[
//               { value: "ACTIVE", label: "Active" },
//               { value: "INACTIVE", label: "Inactive" },
//               { value: "ON_LEAVE", label: "On Leave" },
//               { value: "RESIGNED", label: "Resigned" },
//             ]} />
//           </Form.Item>
//         </Col>
//       </Row>
//       <Row gutter={16}>
//         <Col span={8}>
//           <Form.Item name="is_pmo" label="PMO Role">
//             <Select options={[{ value: true, label: "Yes" }, { value: false, label: "No" }]} />
//           </Form.Item>
//         </Col>
//         <Col span={8}>
//           <Form.Item name="is_manager" label="Manager Role">
//             <Select options={[{ value: true, label: "Yes" }, { value: false, label: "No" }]} />
//           </Form.Item>
//         </Col>
//         <Col span={8}>
//           <Form.Item name="shift_applicable" label="Shift Applicable">
//             <Select options={[{ value: true, label: "Yes" }, { value: false, label: "No" }]} />
//           </Form.Item>
//         </Col>
//       </Row>
//     </Form>
//   );
// }

// // ── Profile Tab ─────────────────────────────────────────────────────────────────
// function ProfileTab({ emp, editing, form }: { emp: EmployeeDetail; editing: boolean; form: any }) {
//   if (!editing) {
//     return (
//       <div style={{ padding: "8px 0" }}>
//         <Descriptions
//           bordered
//           column={{ xs: 1, sm: 2 }}
//           size="small"
//           labelStyle={{ background: "#f8fafc", fontWeight: 600, width: 180, color: "#5a6a7e", fontSize: 13 }}
//           contentStyle={{ fontSize: 13, color: "#1a2332" }}
//         >
//           <Descriptions.Item label="First Name">{emp.first_name || "—"}</Descriptions.Item>
//           <Descriptions.Item label="Last Name">{emp.last_name || "—"}</Descriptions.Item>
//           <Descriptions.Item label="Email">{emp.email}</Descriptions.Item>
//           <Descriptions.Item label="Gender">{GENDER_LABEL[emp.gender] ?? "—"}</Descriptions.Item>
//           <Descriptions.Item label="Date of Birth">
//             {emp.date_of_birth ? dayjs(emp.date_of_birth).format("DD MMM YYYY") : "—"}
//           </Descriptions.Item>
//           <Descriptions.Item label="Username">{emp.username}</Descriptions.Item>
//           <Descriptions.Item label="Bio" span={2}>
//             {emp.bio || <Text type="secondary">No bio provided.</Text>}
//           </Descriptions.Item>
//         </Descriptions>
//       </div>
//     );
//   }

//   return (
//     <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
//       <Row gutter={16}>
//         <Col span={12}>
//           <Form.Item name="first_name" label="First Name" rules={[{ required: true }]}>
//             <Input />
//           </Form.Item>
//         </Col>
//         <Col span={12}>
//           <Form.Item name="last_name" label="Last Name" rules={[{ required: true }]}>
//             <Input />
//           </Form.Item>
//         </Col>
//       </Row>
//       <Row gutter={16}>
//         <Col span={12}>
//           <Form.Item name="gender" label="Gender">
//             <Select allowClear options={[
//               { value: "M", label: "Male" },
//               { value: "F", label: "Female" },
//               { value: "O", label: "Other" },
//             ]} />
//           </Form.Item>
//         </Col>
//         <Col span={12}>
//           <Form.Item name="date_of_birth" label="Date of Birth">
//             <DatePicker style={{ width: "100%" }} format="DD MMM YYYY" />
//           </Form.Item>
//         </Col>
//       </Row>
//       <Form.Item name="bio" label="Bio">
//         <Input.TextArea rows={4} placeholder="Short bio..." />
//       </Form.Item>
//     </Form>
//   );
// }

// // ── Performance Tab ─────────────────────────────────────────────────────────────
// function PerformanceTab({ empId }: { empId: string }) {
//   const { data: workItems = [], isLoading } = useQuery({
//     queryKey: ["emp-work-items", empId],
//     queryFn: () =>
//       get<any>("/work-items/", { assignee: empId, page_size: 50 }).then((r: any) =>
//         Array.isArray(r) ? r : r.results ?? []
//       ),
//   });

//   const STATUS_BADGE: Record<string, string> = {
//     open: "default", "in-progress": "processing", "in-review": "warning",
//     done: "success", closed: "success", blocked: "error",
//   };

//   const columns = [
//     {
//       title: "Work Item",
//       key: "item",
//       render: (_: any, r: any) => (
//         <div>
//           <Text strong style={{ fontSize: 13 }}>{r.title}</Text>
//           <Text style={{ fontSize: 11, color: "#8c9ab0", display: "block" }}>{r.item_type}</Text>
//         </div>
//       ),
//     },
//     { title: "Project", dataIndex: ["project_detail", "name"], key: "project", render: (v: any) => v || "—" },
//     {
//       title: "Status",
//       key: "status",
//       render: (_: any, r: any) => {
//         const s = r.current_state_detail?.slug ?? r.status ?? "";
//         return <Badge status={STATUS_BADGE[s] as any} text={r.current_state_detail?.name ?? r.status ?? "—"} />;
//       },
//     },
//     { title: "Story Points", dataIndex: "story_points", key: "sp", render: (v: any) => v ?? "—" },
//     {
//       title: "Due Date",
//       dataIndex: "due_date",
//       key: "due",
//       render: (v: string) => v ? dayjs(v).format("DD MMM YYYY") : "—",
//     },
//   ];

//   return (
//     <div style={{ paddingTop: 8 }}>
//       {workItems.length === 0 && !isLoading ? (
//         <Empty description="No work items assigned" style={{ padding: "40px 0" }} />
//       ) : (
//         <Table
//           columns={columns}
//           dataSource={workItems}
//           rowKey="id"
//           loading={isLoading}
//           size="small"
//           pagination={{ pageSize: 10 }}
//         />
//       )}
//     </div>
//   );
// }

// // ── Miscellaneous Tab ───────────────────────────────────────────────────────────
// function MiscTab({ emp }: { emp: EmployeeDetail }) {
//   const { data: certs = [], isLoading } = useQuery({
//     queryKey: ["emp-certs", emp.id],
//     queryFn: () => certificateApi.list(emp.id),
//   });

//   const certCols = [
//     { title: "Certificate", dataIndex: "title", key: "title" },
//     { title: "Issuing Org", dataIndex: "issuing_organization", key: "org", render: (v: string) => v || "—" },
//     {
//       title: "Issue Date",
//       dataIndex: "issue_date",
//       key: "issue",
//       render: (v: string) => v ? dayjs(v).format("DD MMM YYYY") : "—",
//     },
//     {
//       title: "Expiry Date",
//       dataIndex: "expiry_date",
//       key: "exp",
//       render: (v: string) => v ? dayjs(v).format("DD MMM YYYY") : "—",
//     },
//     { title: "Credential ID", dataIndex: "credential_id", key: "cred_id", render: (v: string) => v || "—" },
//   ];

//   return (
//     <div style={{ paddingTop: 8 }}>
//       <div style={{ marginBottom: 16 }}>
//         <Descriptions
//           bordered
//           column={{ xs: 1, sm: 2 }}
//           size="small"
//           title={<Text strong style={{ fontSize: 13 }}>Account Info</Text>}
//           labelStyle={{ background: "#f8fafc", fontWeight: 600, width: 180, color: "#5a6a7e", fontSize: 13 }}
//           contentStyle={{ fontSize: 13, color: "#1a2332" }}
//         >
//           <Descriptions.Item label="Created At">
//             {emp.created_at ? dayjs(emp.created_at).format("DD MMM YYYY HH:mm") : "—"}
//           </Descriptions.Item>
//           <Descriptions.Item label="Last Updated">
//             {emp.updated_at ? dayjs(emp.updated_at).format("DD MMM YYYY HH:mm") : "—"}
//           </Descriptions.Item>
//           <Descriptions.Item label="Active">
//             <Badge status={emp.is_active ? "success" : "default"} text={emp.is_active ? "Yes" : "No"} />
//           </Descriptions.Item>
//         </Descriptions>
//       </div>

//       <Divider />

//       <div style={{ marginBottom: 12 }}>
//         <Text strong style={{ fontSize: 14 }}>Certificates & Credentials</Text>
//       </div>
//       <Table
//         columns={certCols}
//         dataSource={certs as Certificate[]}
//         rowKey="id"
//         loading={isLoading}
//         size="small"
//         pagination={{ pageSize: 5 }}
//         locale={{ emptyText: "No certificates on record" }}
//       />
//     </div>
//   );
// }

// // ── Main Page ────────────────────────────────────────────────────────────────────
// export default function EmployeeDetailPage() {
//   const { id } = useParams<{ id: string }>();
//   const navigate = useNavigate();
//   const qc = useQueryClient();
//   const [editing, setEditing] = useState(false);
//   const [activeTab, setActiveTab] = useState("employment");
//   const [form] = Form.useForm();

//   const { data: emp, isLoading } = useQuery({
//     queryKey: ["employee", id],
//     queryFn: () => employeeApi.get(id!),
//     enabled: !!id,
//   });

//   const updateMut = useMutation({
//     mutationFn: (payload: any) => employeeApi.update(id!, payload),
//     onSuccess: () => {
//       qc.invalidateQueries({ queryKey: ["employee", id] });
//       qc.invalidateQueries({ queryKey: ["employees"] });
//       message.success("Employee updated successfully");
//       setEditing(false);
//     },
//     onError: (e: any) => message.error(apiErrorMsg(e, "Update failed")),
//   });

//   const startEdit = () => {
//     if (!emp) return;
//     form.setFieldsValue({
//       first_name: emp.first_name,
//       last_name: emp.last_name,
//       gender: emp.gender || undefined,
//       date_of_birth: emp.date_of_birth ? dayjs(emp.date_of_birth) : null,
//       bio: emp.bio,
//       designation_ref: emp.designation_ref,
//       department_ref: emp.department_ref,
//       location: emp.location,
//       employment_type: emp.employment_type,
//       joining_date: emp.joining_date ? dayjs(emp.joining_date) : null,
//       total_experience: emp.total_experience,
//       prior_experience: emp.prior_experience,
//       phone_number: emp.phone_number,
//       status: emp.status,
//       is_pmo: emp.is_pmo,
//       is_manager: emp.is_manager,
//       shift_applicable: emp.shift_applicable,
//     });
//     setEditing(true);
//   };

//   const handleSave = () => {
//     form.validateFields().then((values) => {
//       const payload: any = {
//         ...values,
//         joining_date: values.joining_date ? dayjs(values.joining_date).format("YYYY-MM-DD") : null,
//         retirement_date: values.retirement_date ? dayjs(values.retirement_date).format("YYYY-MM-DD") : null,
//         date_of_birth: values.date_of_birth ? dayjs(values.date_of_birth).format("YYYY-MM-DD") : null,
//       };
//       updateMut.mutate(payload);
//     });
//   };

//   if (isLoading) {
//     return (
//       <div style={{ display: "flex", justifyContent: "center", paddingTop: 80 }}>
//         <Spin size="large" />
//       </div>
//     );
//   }

//   if (!emp) {
//     return (
//       <div style={{ textAlign: "center", paddingTop: 80 }}>
//         <Text type="secondary">Employee not found.</Text>
//       </div>
//     );
//   }

//   const tabItems = [
//     {
//       key: "employment",
//       label: "Employment",
//       children: (
//         <EmploymentTab
//           emp={emp}
//           editing={editing}
//           onStopEdit={() => setEditing(false)}
//           form={form}
//         />
//       ),
//     },
//     {
//       key: "profile",
//       label: "Profile",
//       children: <ProfileTab emp={emp} editing={editing} form={form} />,
//     },
//     {
//       key: "performance",
//       label: "Performance",
//       children: <PerformanceTab empId={emp.id} />,
//     },
//     {
//       key: "miscellaneous",
//       label: "Miscellaneous",
//       children: <MiscTab emp={emp} />,
//     },
//     {
//       key: "attendance",
//       label: "Attendance",
//       children: (
//         <Card size="small" style={{ borderRadius: 10 }}>
//           <AttendanceCalendar employeeId={emp.id} />
//         </Card>
//       ),
//     },
//     {
//       key: "reporting",
//       label: "Reporting Structure",
//       children: (
//         <Card size="small" style={{ borderRadius: 10 }}>
//           <OrgChart
//             rootId={emp.id}
//             onNavigate={(id) => navigate(`/employees/${id}`)}
//             height={500}
//             focusedMode
//           />
//         </Card>
//       ),
//     },
//   ];

//   return (
//     <div>
//       {/* Breadcrumb */}
//       <div style={{ marginBottom: 20 }}>
//         <Space>
//           <Button
//             type="text"
//             icon={<ArrowLeftOutlined />}
//             onClick={() => navigate("/employees")}
//             style={{ paddingLeft: 0, color: "#8c9ab0", fontSize: 13 }}
//           >
//             Employees
//           </Button>
//           <Text style={{ color: "#bcc5d3" }}>/</Text>
//           <Text style={{ fontSize: 13, color: "#1a2332", fontWeight: 600 }}>
//             {emp.full_name || emp.username}
//           </Text>
//         </Space>
//       </div>

//       {/* Profile hero card */}
//       <Card
//         style={{
//           borderRadius: 12, marginBottom: 20,
//           border: "1px solid #e8edf3",
//           background: "linear-gradient(135deg, #f8faff 0%, #ffffff 60%)",
//           boxShadow: "0 2px 12px rgba(22,119,255,0.06)",
//         }}
//         styles={{ body: { padding: "0" } }}
//       >
//         {/* Accent top bar */}
//         <div style={{
//           height: 4,
//           borderRadius: "12px 12px 0 0",
//           background: editing
//             ? "linear-gradient(90deg, #f59e0b, #fbbf24)"
//             : "linear-gradient(90deg, #1677ff, #6366f1)",
//         }} />

//         <div style={{ padding: "24px 28px", display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
//           {/* Avatar */}
//           <div style={{ position: "relative", flexShrink: 0 }}>
//             <Avatar
//               size={80}
//               src={emp.profile_picture_url}
//               icon={<UserOutlined />}
//               style={{
//                 background: "linear-gradient(135deg, #1677ff, #6366f1)",
//                 fontSize: 32, boxShadow: "0 4px 14px rgba(22,119,255,0.3)",
//               }}
//             />
//             {/* Status dot */}
//             <div style={{
//               position: "absolute", bottom: 4, right: 4,
//               width: 14, height: 14, borderRadius: "50%",
//               background: emp.status === "ACTIVE" ? "#10b981" : emp.status === "ON_LEAVE" ? "#f59e0b" : "#9ca3af",
//               border: "2px solid #fff",
//               boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
//             }} />
//           </div>

//           {/* Info block */}
//           <div style={{ flex: 1, minWidth: 0 }}>
//             {/* Name + status */}
//             <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
//               <Title level={4} style={{ margin: 0, color: "#0f172a", fontWeight: 700, letterSpacing: -0.3 }}>
//                 {emp.full_name || emp.username}
//               </Title>
//               <span style={{
//                 fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 20,
//                 background: emp.status === "ACTIVE" ? "#dcfce7" : "#f1f5f9",
//                 color: emp.status === "ACTIVE" ? "#059669" : "#64748b",
//                 border: `1px solid ${emp.status === "ACTIVE" ? "#bbf7d0" : "#e2e8f0"}`,
//               }}>
//                 ● {STATUS_LABEL[emp.status] ?? emp.status}
//               </span>
//             </div>

//             {/* Code + Designation + Dept */}
//             <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
//               {emp.employee_code && (
//                 <span style={{
//                   fontSize: 11, fontFamily: "monospace", fontWeight: 700,
//                   padding: "2px 8px", borderRadius: 6,
//                   background: "#f1f5f9", color: "#475569",
//                   border: "1px solid #e2e8f0",
//                 }}>
//                   {emp.employee_code}
//                 </span>
//               )}
//               {emp.designation_name && (
//                 <span style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>
//                   {emp.designation_name}
//                 </span>
//               )}
//               {emp.department_name && (
//                 <>
//                   <span style={{ color: "#cbd5e1", fontSize: 14 }}>·</span>
//                   <span style={{
//                     fontSize: 12, fontWeight: 500,
//                     padding: "2px 10px", borderRadius: 20,
//                     background: "#eff6ff", color: "#1d4ed8",
//                     border: "1px solid #bfdbfe",
//                   }}>
//                     {emp.department_name}
//                   </span>
//                 </>
//               )}
//             </div>

//             {/* Contact row */}
//             <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
//               {emp.email && (
//                 <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#64748b" }}>
//                   <MailOutlined style={{ fontSize: 12, color: "#94a3b8" }} />
//                   {emp.email}
//                 </span>
//               )}
//               {emp.phone_number && (
//                 <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#64748b" }}>
//                   <PhoneOutlined style={{ fontSize: 12, color: "#94a3b8" }} />
//                   {emp.phone_number}
//                 </span>
//               )}
//               {emp.location_name && (
//                 <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#64748b" }}>
//                   <span style={{ fontSize: 12 }}>📍</span>
//                   {emp.location_name}
//                 </span>
//               )}
//               {emp.joining_date && (
//                 <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#64748b" }}>
//                   <span>📅</span>
//                   Joined {dayjs(emp.joining_date).format("DD MMM YYYY")}
//                 </span>
//               )}
//             </div>
//           </div>

//           {/* Right: role tags + actions */}
//           <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10, flexShrink: 0 }}>
//             {/* Role tags */}
//             <Space size={6}>
//               {emp.is_pmo     && <Tag color="blue"    style={{ borderRadius: 20, fontWeight: 600 }}>PMO</Tag>}
//               {emp.is_manager && <Tag color="purple"  style={{ borderRadius: 20, fontWeight: 600 }}>Manager</Tag>}
//               {emp.is_staff   && <Tag color="cyan"    style={{ borderRadius: 20, fontWeight: 600 }}>Admin</Tag>}
//               {emp.keycloak_group && (
//                 <Tag style={{
//                   borderRadius: 20, fontWeight: 600, fontSize: 11,
//                   background: "#faf5ff", color: "#6d28d9", border: "1px solid #ddd6fe"
//                 }}>
//                   {emp.keycloak_group}
//                 </Tag>
//               )}
//             </Space>

//             {/* Edit / Save / Cancel */}
//             <Space>
//               {editing ? (
//                 <>
//                   <Button icon={<CloseOutlined />} onClick={() => setEditing(false)}>
//                     Cancel
//                   </Button>
//                   <Button
//                     type="primary"
//                     icon={<SaveOutlined />}
//                     loading={updateMut.isPending}
//                     onClick={handleSave}
//                     style={{ background: "#f59e0b", borderColor: "#f59e0b" }}
//                   >
//                     Save Changes
//                   </Button>
//                 </>
//               ) : (
//                 <Button
//                   icon={<EditOutlined />}
//                   onClick={startEdit}
//                   style={{ borderRadius: 8, fontWeight: 600 }}
//                 >
//                   Edit
//                 </Button>
//               )}
//             </Space>
//           </div>
//         </div>
//       </Card>

//       {/* Detail tabs */}
//       <Card
//         style={{ borderRadius: 10, border: "1px solid #e8edf3" }}
//         styles={{ body: { padding: "0 24px 24px" } }}
//       >
//         <Tabs
//           activeKey={activeTab}
//           onChange={(k) => { setActiveTab(k); setEditing(false); }}
//           items={tabItems}
//           style={{ marginTop: 0 }}
//         />
//       </Card>
//     </div>
//   );
// }
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card, Tabs, Avatar, Typography, Tag, Button, Descriptions, Spin,
  Form, Select, DatePicker, Input, Row, Col, Divider, message,
  Space, Table, Empty, Badge, TimePicker, Tooltip,
} from "antd";
import {
  UserOutlined, ArrowLeftOutlined, EditOutlined, SaveOutlined,
  CloseOutlined, MailOutlined, PhoneOutlined, CopyOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

import { employeeApi, certificateApi, employeeGroupApi, type EmployeeDetail, type Certificate } from "@/services/employees";
import { designationApi, departmentApi, locationApi, employmentTypeApi, shiftCategoryApi, type ShiftCategoryOption } from "@/services/master";
import OrgChart from "@/components/OrgChart";
import AttendanceCalendar from "@/components/common/AttendanceCalendar";
import EmployeePerformanceTab from "@/components/employee/EmployeePerformanceTab";
import { apiErrorMsg } from "@/utils/apiError";
import { get } from "@/services/api";
import PhoneInput from "@/components/common/PhoneInput";
import { phoneFormRules } from "@/utils/phone";
import { useAuthStore } from "@/store/auth";

const { Text, Title } = Typography;

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: "success", INACTIVE: "default", ON_LEAVE: "warning", RESIGNED: "error",
};
const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Active", INACTIVE: "Inactive", ON_LEAVE: "On Leave", RESIGNED: "Resigned",
};
const GENDER_LABEL: Record<string, string> = { M: "Male", F: "Female", O: "Other" };

function useDropdowns() {
  const { data: designations = [] } = useQuery({ queryKey: ["dd", "designations"], queryFn: () => designationApi.dropdown(), staleTime: 60_000 });
  const { data: departments = [] }  = useQuery({ queryKey: ["dd", "departments"],  queryFn: () => departmentApi.dropdown(),  staleTime: 60_000 });
  const { data: locations = [] }    = useQuery({ queryKey: ["dd", "locations"],    queryFn: () => locationApi.dropdown(),    staleTime: 60_000 });
  const { data: empTypes = [] }     = useQuery({ queryKey: ["dd", "emp-types"],    queryFn: () => employmentTypeApi.dropdown(), staleTime: 60_000 });
  const { data: allEmployees = [] } = useQuery({ queryKey: ["dd", "employees-dropdown"], queryFn: () => employeeApi.dropdown(), staleTime: 60_000 });
  return { designations, departments, locations, empTypes, allEmployees };
}

// ── Employment Tab ──────────────────────────────────────────────────────────────
function EmploymentTab({ emp, editing, onStopEdit, form }: {
  emp: EmployeeDetail; editing: boolean; onStopEdit: () => void; form: any;
}) {
  const { designations, departments, locations, empTypes, allEmployees } = useDropdowns();
  const shiftApplicable = Form.useWatch("shift_applicable", form);
  const shiftType = Form.useWatch("shift_type", form);
  const { data: kcGroups = [] } = useQuery({ queryKey: ["dd", "kc-groups"], queryFn: () => employeeGroupApi.list(), staleTime: 300_000 });
  const { data: shiftCats = [] } = useQuery({ queryKey: ["dd", "shift-cats"], queryFn: () => shiftCategoryApi.dropdown(), staleTime: 60_000 });

  const ff = (input: string, opt: any) => (opt?.label as string)?.toLowerCase().includes(input.toLowerCase());

  if (!editing) {
    return (
      <div style={{ padding: "8px 0" }}>
        <Descriptions
          bordered
          column={{ xs: 1, sm: 2 }}
          size="small"
          // ✅ was: background: "#f8fafc", color: "#5a6a7e" / "#1a2332"
          labelStyle={{ background: "var(--bms-surface-2)", fontWeight: 600, width: 180, color: "var(--bms-text-3)", fontSize: 13 }}
          contentStyle={{ fontSize: 13, color: "var(--bms-text)" }}
        >
          <Descriptions.Item label="Employee Code">
            {emp.employee_code ? <Text code>{emp.employee_code}</Text> : "—"}
          </Descriptions.Item>
         <Descriptions.Item label="Status">
  <span style={{
    display: "inline-flex", alignItems: "center", gap: 6,
    fontSize: 13, fontWeight: 500,
    color: emp.status === "ACTIVE" ? "#059669"
      : emp.status === "ON_LEAVE" ? "#d97706"
      : emp.status === "RESIGNED" ? "#dc2626"
      : "#6b7280",
  }}>
    <span style={{
      width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
      background: emp.status === "ACTIVE" ? "#10b981"
        : emp.status === "ON_LEAVE" ? "#f59e0b"
        : emp.status === "RESIGNED" ? "#ef4444"
        : "#9ca3af",
    }} />
    {(STATUS_LABEL[emp.status] ?? emp.status).toLowerCase()}
  </span>
</Descriptions.Item>
          <Descriptions.Item label="Designation">{emp.designation_name || "—"}</Descriptions.Item>
          <Descriptions.Item label="Department">{emp.department_name || "—"}</Descriptions.Item>
          <Descriptions.Item label="Reporting Manager">{emp.manager_name || "—"}</Descriptions.Item>
          <Descriptions.Item label="Location">{emp.location_name || "—"}</Descriptions.Item>
          <Descriptions.Item label="Employment Type">{emp.employment_type_name || "—"}</Descriptions.Item>
          <Descriptions.Item label="Date of Joining">
            {emp.joining_date ? dayjs(emp.joining_date).format("DD MMM YYYY") : "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Total Experience">
            {emp.total_experience ? `${emp.total_experience} years` : "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Prior Experience">
            {emp.prior_experience ? `${emp.prior_experience} years` : "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Shift Applicable">{emp.shift_applicable ? "Yes" : "No"}</Descriptions.Item>
          {emp.shift_applicable && (
            <Descriptions.Item label="Shift">
              {emp.shift_category_name
                ? emp.shift_category_name
                : emp.custom_shift_start && emp.custom_shift_end
                  ? `${emp.custom_shift_start.slice(0, 5)} – ${emp.custom_shift_end.slice(0, 5)}`
                  : "—"}
            </Descriptions.Item>
          )}
          <Descriptions.Item label="WFH Allowed">
  <span style={{
    display: "inline-flex", alignItems: "center", gap: 6,
    fontSize: 13, fontWeight: 500,
    color: emp.wfh_allowed ? "#059669" : "#6b7280",
  }}>
    <span style={{
      width: 8, height: 8, borderRadius: "50%",
      background: emp.wfh_allowed ? "#10b981" : "#9ca3af",
    }} />
    {emp.wfh_allowed ? "Allowed" : "Not Allowed"}
  </span>
</Descriptions.Item>
          <Descriptions.Item label="Phone">{emp.phone_number || "—"}</Descriptions.Item>
          <Descriptions.Item label="Role">{emp.keycloak_group || "—"}</Descriptions.Item>
          <Descriptions.Item label="Derived Roles">
            <Space size={4}>
              {emp.is_pmo && <Tag color="blue">PMO</Tag>}
              {emp.is_manager && <Tag color="purple">Manager</Tag>}
              {emp.is_staff && <Tag color="cyan">Admin</Tag>}
              {!emp.is_pmo && !emp.is_manager && !emp.is_staff && <Text type="secondary">Member</Text>}
            </Space>
          </Descriptions.Item>
        </Descriptions>
      </div>
    );
  }

  const recalcTotal = () => {
    const joiningDate: dayjs.Dayjs | undefined = form.getFieldValue("joining_date");
    const prior = parseFloat(form.getFieldValue("prior_experience") ?? 0) || 0;
    if (joiningDate) {
      const tenure = parseFloat((dayjs().diff(joiningDate, "day") / 365).toFixed(1));
      form.setFieldsValue({ total_experience: parseFloat((tenure + prior).toFixed(1)) });
    }
  };

  const onValuesChange = (changed: any) => {
    if ("joining_date" in changed || "prior_experience" in changed) recalcTotal();
  };

  return (
    <Form form={form} layout="vertical" style={{ marginTop: 8 }} onValuesChange={onValuesChange}>
      {/* ✅ was: color: "#5a6a7e" */}
      <Text strong style={{ fontSize: 13, color: "var(--bms-text-3)" }}>Position</Text>
      <Divider style={{ margin: "8px 0 16px" }} />
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="designation_ref" label="Designation">
            <Select showSearch placeholder="Select" allowClear
              options={(designations as any[]).map((d) => ({ value: d.id, label: d.name }))}
              filterOption={(i, o) => (o?.label as string)?.toLowerCase().includes(i.toLowerCase())} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="department_ref" label="Department">
            <Select showSearch placeholder="Select" allowClear
              options={(departments as any[]).map((d) => ({ value: d.id, label: d.name }))}
              filterOption={(i, o) => (o?.label as string)?.toLowerCase().includes(i.toLowerCase())} />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="location" label="Location">
            <Select showSearch placeholder="Select" allowClear
              options={(locations as any[]).map((l) => ({ value: l.id, label: l.name }))}
              filterOption={(i, o) => (o?.label as string)?.toLowerCase().includes(i.toLowerCase())} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="employment_type" label="Employment Type">
            <Select showSearch placeholder="Select" allowClear
              options={(empTypes as any[]).map((e) => ({ value: e.id, label: e.name }))}
              filterOption={(i, o) => (o?.label as string)?.toLowerCase().includes(i.toLowerCase())} />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="joining_date" label="Date of Joining">
            <DatePicker style={{ width: "100%" }} format="DD MMM YYYY" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="manager" label="Reporting Manager">
            <Select showSearch placeholder="Select manager" allowClear
              options={(allEmployees as any[]).map((e) => ({ value: e.id, label: `${e.full_name} (${e.employee_code})` }))}
              filterOption={ff} />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="prior_experience" label="Prior Experience (yrs)" tooltip="Experience before joining">
            <Input type="number" placeholder="2.0" min={0} step={0.1} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="total_experience" label="Total Experience (yrs)" tooltip="Auto-calculated: tenure + prior">
            {/* ✅ was: background: "#f8fafc" */}
            <Input type="number" placeholder="5.5" disabled style={{ background: "var(--bms-surface-2)" }} />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="phone_number" label="Phone Number" rules={phoneFormRules({ label: "Phone number" })}>
            <PhoneInput />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="status" label="Status">
            <Select options={[
              { value: "ACTIVE", label: "Active", disabled: emp && emp.status === "INACTIVE" && !isCeo },
              { value: "INACTIVE", label: "Inactive" },
              { value: "ON_LEAVE", label: "On Leave" },
              { value: "RESIGNED", label: "Resigned" },
            ]} />
          </Form.Item>
        </Col>
      </Row>

      <Text strong style={{ fontSize: 13, color: "var(--bms-text-3)" }}>Role</Text>
      <Divider style={{ margin: "8px 0 16px" }} />
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="keycloak_group" label="Role" rules={[{ required: true }]}>
            <Select
              showSearch allowClear placeholder="Select role"
              options={(kcGroups as string[]).map((g) => ({ value: g, label: g }))}
              filterOption={ff as any}
            />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="wfh_allowed" label="WFH Allowed">
            <Select options={[{ value: true, label: "Yes" }, { value: false, label: "No" }]} />
          </Form.Item>
        </Col>
      </Row>

      <Text strong style={{ fontSize: 13, color: "var(--bms-text-3)" }}>Shift</Text>
      <Divider style={{ margin: "8px 0 16px" }} />
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="shift_applicable" label="Shift Applicable">
            <Select options={[{ value: true, label: "Yes" }, { value: false, label: "No" }]} />
          </Form.Item>
        </Col>
        {shiftApplicable && (
          <Col span={12}>
            <Form.Item name="shift_type" label="Shift Type">
              <Select options={[
                { value: "category", label: "From Master (predefined)" },
                { value: "custom", label: "Custom timing" },
              ]} />
            </Form.Item>
          </Col>
        )}
      </Row>
      {shiftApplicable && shiftType === "category" && (
        <Form.Item name="shift_category" label="Shift Category">
          <Select
            showSearch placeholder="Select shift"
            options={(shiftCats as ShiftCategoryOption[]).map((s) => ({
              value: s.id,
              label: `${s.name}  (${s.start_time.slice(0, 5)} – ${s.end_time.slice(0, 5)})`,
            }))}
            filterOption={ff}
          />
        </Form.Item>
      )}
      {shiftApplicable && shiftType === "custom" && (
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="custom_shift_start" label="Shift Start">
              <TimePicker format="HH:mm" style={{ width: "100%" }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="custom_shift_end"
              label="Shift End"
              rules={[{
                validator: (_, val) => {
                  const s = form.getFieldValue("custom_shift_start");
                  if (!val || !s) return Promise.resolve();
                  let e = dayjs(val);
                  if (e.isBefore(dayjs(s))) e = e.add(1, "day");
                  return Math.abs(e.diff(dayjs(s), "minute") - 540) > 1
                    ? Promise.reject("Must be 9 hours")
                    : Promise.resolve();
                },
              }]}
            >
              <TimePicker format="HH:mm" style={{ width: "100%" }} />
            </Form.Item>
          </Col>
        </Row>
      )}
    </Form>
  );
}

// ── Profile Tab ─────────────────────────────────────────────────────────────────
function ProfileTab({ emp, editing, form }: { emp: EmployeeDetail; editing: boolean; form: any }) {
  if (!editing) {
    return (
      <div style={{ padding: "8px 0" }}>
        <Descriptions
          bordered
          column={{ xs: 1, sm: 2 }}
          size="small"
          // ✅ was: background: "#f8fafc", color: "#5a6a7e" / "#1a2332"
          labelStyle={{ background: "var(--bms-surface-2)", fontWeight: 600, width: 180, color: "var(--bms-text-3)", fontSize: 13 }}
          contentStyle={{ fontSize: 13, color: "var(--bms-text)" }}
        >
          <Descriptions.Item label="First Name">{emp.first_name || "—"}</Descriptions.Item>
          <Descriptions.Item label="Last Name">{emp.last_name || "—"}</Descriptions.Item>
          <Descriptions.Item label="Email">{emp.email}</Descriptions.Item>
          <Descriptions.Item label="Gender">{GENDER_LABEL[emp.gender] ?? "—"}</Descriptions.Item>
          <Descriptions.Item label="Date of Birth">
            {emp.date_of_birth ? dayjs(emp.date_of_birth).format("DD MMM YYYY") : "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Username">{emp.username}</Descriptions.Item>
          <Descriptions.Item label="Bio" span={2}>
            {emp.bio || <Text type="secondary">No bio provided.</Text>}
          </Descriptions.Item>
        </Descriptions>
      </div>
    );
  }

  return (
    <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="first_name" label="First Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="last_name" label="Last Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="gender" label="Gender">
            <Select allowClear options={[
              { value: "M", label: "Male" },
              { value: "F", label: "Female" },
              { value: "O", label: "Other" },
            ]} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="date_of_birth" label="Date of Birth">
            <DatePicker style={{ width: "100%" }} format="DD MMM YYYY" />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item name="bio" label="Bio">
        <Input.TextArea rows={4} placeholder="Short bio..." />
      </Form.Item>
    </Form>
  );
}

// ── Performance Tab ─────────────────────────────────────────────────────────────
function PerformanceTab({ empId }: { empId: string }) {
  return <EmployeePerformanceTab empId={empId} />;
}

// ── Miscellaneous Tab ───────────────────────────────────────────────────────────
function MiscTab({ emp }: { emp: EmployeeDetail }) {
  const { data: certs = [], isLoading } = useQuery({
    queryKey: ["emp-certs", emp.id],
    queryFn: () => certificateApi.list(emp.id),
  });

  const certCols = [
    { title: "Certificate", dataIndex: "title", key: "title" },
    { title: "Issuing Org", dataIndex: "issuing_organization", key: "org", render: (v: string) => v || "—" },
    {
      title: "Issue Date",
      dataIndex: "issue_date",
      key: "issue",
      render: (v: string) => v ? dayjs(v).format("DD MMM YYYY") : "—",
    },
    {
      title: "Expiry Date",
      dataIndex: "expiry_date",
      key: "exp",
      render: (v: string) => v ? dayjs(v).format("DD MMM YYYY") : "—",
    },
    { title: "Credential ID", dataIndex: "credential_id", key: "cred_id", render: (v: string) => v || "—" },
  ];

  return (
    <div style={{ paddingTop: 8 }}>
      <div style={{ marginBottom: 16 }}>
        <Descriptions
          bordered
          column={{ xs: 1, sm: 2 }}
          size="small"
          title={<Text strong style={{ fontSize: 13 }}>Account Info</Text>}
          // ✅ was: background: "#f8fafc", color: "#5a6a7e" / "#1a2332"
          labelStyle={{ background: "var(--bms-surface-2)", fontWeight: 600, width: 180, color: "var(--bms-text-3)", fontSize: 13 }}
          contentStyle={{ fontSize: 13, color: "var(--bms-text)" }}
        >
          <Descriptions.Item label="Created At">
            {emp.created_at ? dayjs(emp.created_at).format("DD MMM YYYY HH:mm") : "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Last Updated">
            {emp.updated_at ? dayjs(emp.updated_at).format("DD MMM YYYY HH:mm") : "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Active">
            <Badge status={emp.is_active ? "success" : "default"} text={emp.is_active ? "Yes" : "No"} />
          </Descriptions.Item>
        </Descriptions>
      </div>

      <Divider />

      <div style={{ marginBottom: 12 }}>
        <Text strong style={{ fontSize: 14 }}>Certificates & Credentials</Text>
      </div>
      <Table
        columns={certCols}
        dataSource={certs as Certificate[]}
        rowKey="id"
        loading={isLoading}
        size="small"
        pagination={{ pageSize: 5 }}
        locale={{ emptyText: "No certificates on record" }}
      />
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────────
export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [activeTab, setActiveTab] = useState("employment");
  const [form] = Form.useForm();
  const currentUser = useAuthStore((s) => s.user);
  const isCeo = !!(
    currentUser?.designation?.toLowerCase().includes("ceo") ||
    currentUser?.keycloak_group?.toLowerCase().includes("ceo") ||
    currentUser?.keycloak_group?.toLowerCase().includes("admin")
  );

  const { data: emp, isLoading } = useQuery({
    queryKey: ["employee", id],
    queryFn: () => employeeApi.get(id!),
    enabled: !!id,
  });

  const updateMut = useMutation({
    mutationFn: (payload: any) => employeeApi.update(id!, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employee", id] });
      qc.invalidateQueries({ queryKey: ["employees"] });
      message.success("Employee updated successfully");
      setEditing(false);
    },
    onError: (e: any) => message.error(apiErrorMsg(e, "Update failed")),
  });

  const startEdit = () => {
    if (!emp) return;
    form.setFieldsValue({
      first_name: emp.first_name,
      last_name: emp.last_name,
      gender: emp.gender || undefined,
      date_of_birth: emp.date_of_birth ? dayjs(emp.date_of_birth) : null,
      bio: emp.bio,
      designation_ref: emp.designation_ref,
      department_ref: emp.department_ref,
      location: emp.location,
      employment_type: emp.employment_type,
      manager: emp.manager,
      joining_date: emp.joining_date ? dayjs(emp.joining_date) : null,
      total_experience: emp.total_experience,
      prior_experience: emp.prior_experience,
      phone_number: emp.phone_number,
      status: emp.status,
      keycloak_group: emp.keycloak_group || undefined,
      shift_applicable: emp.shift_applicable,
      shift_type: emp.custom_shift_start || emp.custom_shift_end ? "custom" : "category",
      shift_category: emp.shift_category || undefined,
      custom_shift_start: emp.custom_shift_start ? dayjs(emp.custom_shift_start, "HH:mm:ss") : null,
      custom_shift_end: emp.custom_shift_end ? dayjs(emp.custom_shift_end, "HH:mm:ss") : null,
      wfh_allowed: emp.wfh_allowed,
    });
    setEditing(true);
  };

  const handleSave = () => {
    form.validateFields().then((values) => {
      if (emp && emp.status === "INACTIVE" && values.status === "ACTIVE" && !isCeo) {
        message.error("Only the CEO can make an inactive employee active again.");
        return;
      }
      const shiftOn = values.shift_applicable === true;
      const payload: any = {
        ...values,
        joining_date: values.joining_date ? dayjs(values.joining_date).format("YYYY-MM-DD") : null,
        retirement_date: values.retirement_date ? dayjs(values.retirement_date).format("YYYY-MM-DD") : null,
        date_of_birth: values.date_of_birth ? dayjs(values.date_of_birth).format("YYYY-MM-DD") : null,
        custom_shift_start: shiftOn && values.shift_type === "custom" && values.custom_shift_start
          ? dayjs(values.custom_shift_start).format("HH:mm:ss")
          : null,
        custom_shift_end: shiftOn && values.shift_type === "custom" && values.custom_shift_end
          ? dayjs(values.custom_shift_end).format("HH:mm:ss")
          : null,
        shift_category: shiftOn && values.shift_type === "category" ? values.shift_category ?? null : null,
      };
      delete payload.shift_type;
      updateMut.mutate(payload);
    });
  };

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", paddingTop: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!emp) {
    return (
      <div style={{ textAlign: "center", paddingTop: 80 }}>
        <Text type="secondary">Employee not found.</Text>
      </div>
    );
  }

  const tabItems = [
    {
      key: "employment",
      label: "Employment",
      children: (
        <EmploymentTab emp={emp} editing={editing} onStopEdit={() => setEditing(false)} form={form} />
      ),
    },
    { key: "profile",      label: "Profile",             children: <ProfileTab emp={emp} editing={editing} form={form} /> },
    { key: "performance",  label: "Performance",         children: <PerformanceTab empId={emp.id} /> },
    { key: "miscellaneous",label: "Miscellaneous",       children: <MiscTab emp={emp} /> },
    {
      key: "attendance", label: "Attendance",
      children: (
        <Card size="small" style={{ borderRadius: 10 }}>
          <AttendanceCalendar employeeId={emp.id} />
        </Card>
      ),
    },
    {
      key: "reporting", label: "Reporting Structure",
      children: (
        <Card size="small" style={{ borderRadius: 10 }}>
          <OrgChart rootId={emp.id} onNavigate={(id) => navigate(`/employees/${id}`)} height={500} focusedMode />
        </Card>
      ),
    },
  ];

  return (
    <div>
      <style>{`.email-copy-btn:hover { opacity: 1 !important; }`}</style>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 20 }}>
        <Space>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/employees")}
            // ✅ was: color: "#8c9ab0"
            style={{ paddingLeft: 0, color: "var(--bms-text-3)", fontSize: 13 }}
          >
            Employees
          </Button>
          {/* ✅ was: color: "#bcc5d3" */}
          <Text style={{ color: "var(--bms-border)" }}>/</Text>
          {/* ✅ was: color: "#1a2332" */}
          <Text style={{ fontSize: 13, color: "var(--bms-text)", fontWeight: 600 }}>
            {emp.full_name || emp.username}
          </Text>
        </Space>
      </div>

      {/* Profile hero card */}
      <Card
        style={{
          borderRadius: 12, marginBottom: 20,
          // ✅ was: border: "#e8edf3", background: hardcoded gradient
          border: "1px solid var(--bms-border)",
          background: "var(--bms-surface)",
          boxShadow: "0 2px 12px rgba(22,119,255,0.06)",
        }}
        styles={{ body: { padding: "0" } }}
      >
        {/* Accent top bar */}
        <div style={{
          height: 4,
          borderRadius: "12px 12px 0 0",
          background: editing
            ? "linear-gradient(90deg, #f59e0b, #fbbf24)"
            : "linear-gradient(90deg, #1677ff, #6366f1)",
        }} />

        <div style={{ padding: "24px 28px", display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
          {/* Avatar */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <Avatar
              size={80}
              src={emp.profile_picture_url}
              icon={<UserOutlined />}
              style={{
                background: "linear-gradient(135deg, #1677ff, #6366f1)",
                fontSize: 32, boxShadow: "0 4px 14px rgba(22,119,255,0.3)",
              }}
            />
            {/* Status dot */}
            <div style={{
              position: "absolute", bottom: 4, right: 4,
              width: 14, height: 14, borderRadius: "50%",
      background: emp.status === "ACTIVE" ? "#10b981"
  : emp.status === "ON_LEAVE" ? "#f59e0b"
  : emp.status === "RESIGNED" ? "#ef4444"
  : "#9ca3af",
border: "2px solid var(--bms-surface)",
            }} />
          </div>

          {/* Info block */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Name + status */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
              {/* ✅ was: color: "#0f172a" */}
              <Title level={4} style={{ margin: 0, color: "var(--bms-text)", fontWeight: 700, letterSpacing: -0.3 }}>
                {emp.full_name || emp.username}
              </Title>
              <span style={{
  fontSize: 12, fontWeight: 500,
  color: emp.status === "ACTIVE" ? "#059669"
    : emp.status === "ON_LEAVE" ? "#d97706"
    : emp.status === "RESIGNED" ? "#dc2626"
    : "#6b7280",
  display: "inline-flex", alignItems: "center", gap: 6,
}}>
  <span style={{
    display: "inline-block", width: 8, height: 8, borderRadius: "50%",
    background: emp.status === "ACTIVE" ? "#10b981"
      : emp.status === "ON_LEAVE" ? "#f59e0b"
      : emp.status === "RESIGNED" ? "#ef4444"
      : "#9ca3af",
    flexShrink: 0,
  }} />
  {(STATUS_LABEL[emp.status] ?? emp.status).toLowerCase()}
</span>
            </div>

            {/* Code + Designation + Dept */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
              {emp.employee_code && (
                <span style={{
                  fontSize: 11, fontFamily: "monospace", fontWeight: 700,
                  padding: "2px 8px", borderRadius: 6,
                  // ✅ was: background: "#f1f5f9", color: "#475569", border: "#e2e8f0"
                  background: "var(--bms-surface-2)", color: "var(--bms-text-2)",
                  border: "1px solid var(--bms-border)",
                }}>
                  {emp.employee_code}
                </span>
              )}
              {emp.designation_name && (
                // ✅ was: color: "#334155"
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--bms-text)" }}>
                  {emp.designation_name}
                </span>
              )}
              {emp.department_name && (
                <>
                  {/* ✅ was: color: "#cbd5e1" */}
                  <span style={{ color: "var(--bms-border)", fontSize: 14 }}>·</span>
                  <span style={{
                    fontSize: 12, fontWeight: 500,
                    padding: "2px 10px", borderRadius: 20,
                    // ✅ was: background: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe"
                    background: "var(--bms-surface-2)", color: "var(--bms-text-2)",
                    border: "1px solid var(--bms-border)",
                  }}>
                    {emp.department_name}
                  </span>
                </>
              )}
            </div>

            {/* Contact row */}
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
              {emp.email && (
                <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--bms-text-3)" }}>
                  <MailOutlined style={{ fontSize: 12, color: "var(--bms-text-3)" }} />
                  <Tooltip title="Copy email">
                    <CopyOutlined
                      style={{
                        fontSize: 11, color: "var(--bms-text-3)", cursor: "pointer",
                        opacity: 0.5, transition: "opacity 0.15s ease",
                      }}
                      className="email-copy-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(emp.email).then(() => {
                          message.success("Copied!");
                        }).catch(() => {
                          message.error("Failed to copy");
                        });
                      }}
                    />
                  </Tooltip>
                  {emp.email}
                </span>
              )}
              {emp.phone_number && (
                <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--bms-text-3)" }}>
                  <PhoneOutlined style={{ fontSize: 12, color: "var(--bms-text-3)" }} />
                  {emp.phone_number}
                </span>
              )}
              {emp.location_name && (
                <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--bms-text-3)" }}>
                  <span style={{ fontSize: 12 }}>📍</span>
                  {emp.location_name}
                </span>
              )}
              {emp.joining_date && (
                <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--bms-text-3)" }}>
                  <span>📅</span>
                  Joined {dayjs(emp.joining_date).format("DD MMM YYYY")}
                </span>
              )}
            </div>
          </div>

          {/* Right: role tags + actions */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10, flexShrink: 0 }}>
            <Space size={6}>
              {emp.keycloak_group && (
                <Tag style={{
                  borderRadius: 20, fontWeight: 600, fontSize: 13,
                  padding: "4px 14px",
                  background: "var(--bms-primary-alpha, #1677ff1a)",
                  color: "var(--bms-primary, #1677ff)",
                  border: "1px solid var(--bms-primary-border, #1677ff33)",
                }}>
                  {emp.keycloak_group}
                </Tag>
              )}
            </Space>

            <Space>
              {editing ? (
                <>
                  <Button icon={<CloseOutlined />} onClick={() => setEditing(false)}>Cancel</Button>
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    loading={updateMut.isPending}
                    onClick={handleSave}
                    style={{ background: "#f59e0b", borderColor: "#f59e0b" }}
                  >
                    Save Changes
                  </Button>
                </>
              ) : (
                <Button icon={<EditOutlined />} onClick={startEdit} style={{ borderRadius: 8, fontWeight: 600 }}>
                  Edit
                </Button>
              )}
            </Space>
          </div>
        </div>
      </Card>

      {/* Detail tabs card */}
      {/* ✅ was: border: "#e8edf3" */}
      <Card
        style={{ borderRadius: 10, border: "1px solid var(--bms-border)" }}
        styles={{ body: { padding: "0 24px 24px" } }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={(k) => { setActiveTab(k); setEditing(false); }}
          items={tabItems}
          style={{ marginTop: 0 }}
        />
      </Card>
    </div>
  );
}