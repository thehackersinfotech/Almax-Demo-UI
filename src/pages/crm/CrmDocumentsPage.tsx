import React from "react";
import CrmSharedDocumentsManager from "@/components/crm/CrmSharedDocumentsManager";

export default function CrmDocumentsPage() {
  return (
    <div style={{ padding: "0 0 24px 0" }}>
      <CrmSharedDocumentsManager
        title="CRM Documents & Shared Folders"
        description="Central repository for agreements, proposals, quotations, and client documents shared across CRM, Lead Management, and Sales Management."
      />
    </div>
  );
}
