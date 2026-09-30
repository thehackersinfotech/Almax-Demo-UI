import React from "react";
import { Tooltip, Tag } from "antd";
import {
  FileTextOutlined,
  UserSwitchOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  BookOutlined,
  CommentOutlined,
  DesktopOutlined,
  AuditOutlined,
  DollarOutlined,
  CheckCircleOutlined,
  LockOutlined,
} from "@ant-design/icons";

export interface LifecycleStep {
  number: number;
  name: string;
  description: string;
  icon: React.ReactNode;
}

export const LIFECYCLE_STEPS: LifecycleStep[] = [
  { number: 1, name: "Submit Resignation", description: "Employee submits resignation reason & proposed LWD based on notice period.", icon: <FileTextOutlined /> },
  { number: 2, name: "Project Manager Review", description: "PM reviews handover plan, project impact, and recommends LWD.", icon: <UserSwitchOutlined /> },
  { number: 3, name: "HR Review", description: "HR validates notice period policy, buyout options, and exit approval.", icon: <SafetyCertificateOutlined /> },
  { number: 4, name: "Task Setups", description: "Reassign pending tickets, work items, and project responsibilities.", icon: <SettingOutlined /> },
  { number: 5, name: "Knowledge Transfer", description: "Document & upload KT notes, conduct KT sessions, and obtain sign-off.", icon: <BookOutlined /> },
  { number: 6, name: "Exit Interview", description: "HR conducts exit interview questionnaire & feedback session.", icon: <CommentOutlined /> },
  { number: 7, name: "IT Assets & Facilities", description: "Revoke IT hardware, badges, digital accounts, and facility access.", icon: <DesktopOutlined /> },
  { number: 8, name: "Documents Issued", description: "Generate & issue Relieving Letter, Experience Certificate, and Service Certificate.", icon: <AuditOutlined /> },
  { number: 9, name: "Finance Clearance", description: "Final settlement calculation (Encashment, Gratuity, Deductions).", icon: <DollarOutlined /> },
  { number: 10, name: "Completed", description: "Offboarding officially closed and employee status set to Exited.", icon: <CheckCircleOutlined /> },
];

interface OffboardingLifecycleBarProps {
  currentStep: number; // Max step reached (1..10)
  selectedStep: number; // Currently viewed step
  onSelectStep: (stepNumber: number) => void;
}

export const OffboardingLifecycleBar: React.FC<OffboardingLifecycleBarProps> = ({
  currentStep,
  selectedStep,
  onSelectStep,
}) => {
  return (
    <div
      style={{
        background: "var(--bms-surface, #ffffff)",
        border: "1px solid var(--bms-border, #e5e7eb)",
        borderRadius: 12,
        padding: "16px 20px",
        marginBottom: 24,
        boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--bms-text-secondary, #6b7280)" }}>
          Offboarding Lifecycle Workflow Progress
        </div>
        <Tag color={currentStep === 10 ? "success" : "processing"} style={{ fontWeight: 600, fontSize: 12 }}>
          {currentStep === 10 ? "✓ OFFBOARDING COMPLETED" : `STEP ${currentStep} OF 10: ${LIFECYCLE_STEPS[currentStep - 1]?.name}`}
        </Tag>
      </div>

      {/* Lifecycle Progress Bar */}
      <div style={{ display: "flex", alignItems: "center", position: "relative", width: "100%", overflowX: "auto", paddingBottom: 6 }}>
        {/* Background Connecting Line */}
        <div
          style={{
            position: "absolute",
            top: 24,
            left: 24,
            right: 24,
            height: 4,
            background: "#e5e7eb",
            zIndex: 1,
          }}
        />

        {/* Completed Progress Line */}
        <div
          style={{
            position: "absolute",
            top: 24,
            left: 24,
            width: `${Math.min(100, Math.max(0, ((currentStep - 1) / 9) * 100))}%`,
            height: 4,
            background: "linear-gradient(90deg, #10b981, #0284c7)",
            zIndex: 2,
            transition: "width 0.4s ease",
          }}
        />

        {/* 10 Step Icons */}
        <div style={{ display: "flex", justifyContent: "space-between", width: "100%", zIndex: 3, position: "relative" }}>
          {LIFECYCLE_STEPS.map((step) => {
            const isCompleted = step.number < currentStep;
            const isCurrent = step.number === currentStep;
            const isSelected = step.number === selectedStep;
            const isDisabled = step.number > currentStep; // Disabled until current step reaches it!

            let bgColor = "#ffffff";
            let borderColor = "#d1d5db";
            let iconColor = "#9ca3af";

            if (isCompleted) {
              bgColor = "#10b981";
              borderColor = "#059669";
              iconColor = "#ffffff";
            } else if (isCurrent) {
              bgColor = "#0284c7";
              borderColor = "#0369a1";
              iconColor = "#ffffff";
            } else if (isDisabled) {
              bgColor = "#f3f4f6";
              borderColor = "#e5e7eb";
              iconColor = "#d1d5db";
            }

            if (isSelected) {
              borderColor = isCompleted ? "#047857" : "#0284c7";
            }

            return (
              <Tooltip
                key={step.number}
                title={
                  <div style={{ padding: 4 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>
                      Step {step.number}: {step.name}
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.9 }}>{step.description}</div>
                    {isDisabled && (
                      <div style={{ fontSize: 10, color: "#f87171", marginTop: 4, fontWeight: 600 }}>
                        🔒 Locked until Step {step.number - 1} is completed
                      </div>
                    )}
                  </div>
                }
                placement="top"
              >
                <button
                  type="button"
                  disabled={isDisabled}
                  onClick={() => !isDisabled && onSelectStep(step.number)}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    background: bgColor,
                    border: `3px solid ${borderColor}`,
                    boxShadow: isSelected ? "0 0 0 4px rgba(2, 132, 199, 0.25)" : "0 2px 5px rgba(0,0,0,0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: isDisabled ? "not-allowed" : "pointer",
                    transition: "all 0.25s ease",
                    transform: isSelected ? "scale(1.12)" : "scale(1)",
                    outline: "none",
                    padding: 0,
                    opacity: isDisabled ? 0.6 : 1,
                  }}
                >
                  <span style={{ fontSize: 20, color: iconColor, display: "flex" }}>
                    {isDisabled ? <LockOutlined style={{ fontSize: 16 }} /> : step.icon}
                  </span>
                </button>
              </Tooltip>
            );
          })}
        </div>
      </div>
    </div>
  );
};
