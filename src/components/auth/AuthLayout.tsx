import { Typography } from "antd";
import React from "react";
import { Link } from "react-router-dom";
import logoImage from "@/assets/logo-AlMax.png";
import ThemeToggle from "@/components/common/ThemeToggle";

const { Title, Text } = Typography;

function BMSLogo({ size = 26 }: { size?: number }) {
  return (
    <img src={logoImage} alt="Logo" width={size} height={size} style={{ objectFit: "contain" }} />
  );
}

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  backTo?: string;
  backLabel?: string;
}

export default function AuthLayout({
  title,
  subtitle,
  children,
  backTo = "/login",
  backLabel = "Back to sign in",
}: AuthLayoutProps) {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--bms-bg, #f0f4f8)",
      fontFamily: "var(--bms-font)",
      padding: "32px 16px",
      position: "relative",
    }}>
      <div style={{ position: "absolute", top: 20, right: 24 }}>
        <ThemeToggle />
      </div>

      <div className="bms-auth-card" style={{
        width: "100%",
        maxWidth: 440,
        background: "var(--bms-surface, #fff)",
        borderRadius: 16,
        padding: "40px 36px",
        boxShadow: "0 8px 32px rgba(6,15,30,0.08)",
        border: "1px solid var(--bms-border, #e8edf2)",
      }}>
        <div style={{
          width: 50, height: 50, borderRadius: 14,
          background: "#ffffff",
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: 22,
          boxShadow: "0 4px 18px color-mix(in srgb, var(--bms-primary) 32%, transparent)",
        }}>
          <BMSLogo size={28} />
        </div>

        <Title level={2} style={{
          margin: 0, fontWeight: 800, color: "var(--bms-text)",
          fontSize: 24, letterSpacing: -0.5,
        }}>
          {title}
        </Title>
        <Text style={{
          color: "var(--bms-text-2)", fontSize: 14,
          marginTop: 6, display: "block", lineHeight: 1.5, marginBottom: 28,
        }}>
          {subtitle}
        </Text>

        {children}

        <div style={{ marginTop: 24, textAlign: "center" }}>
          <Link to={backTo} style={{ color: "var(--bms-primary)", fontSize: 13, fontWeight: 500 }}>
            ← {backLabel}
          </Link>
        </div>

        <Text style={{
          display: "block", textAlign: "center",
          color: "var(--bms-text-3)", fontSize: 11.5, marginTop: 20,
        }}>
          © 2025 Hackers Infotech
        </Text>
      </div>
    </div>
  );
}
