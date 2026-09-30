import dayjs from "dayjs";
import type { OffboardingRequest } from "@/services/offboarding";

export type DocumentType = "relieving" | "experience" | "nodues" | "payslip";

export function generateOffboardingDocumentHtml(
  type: DocumentType,
  req: Partial<OffboardingRequest>,
  customTitle?: string
): string {
  const currentDate = dayjs().format("DD MMMM YYYY");
  const empName = req.employee_name || "Employee";
  const empCode = req.employee_code || req.employee_id || "EMP-001";
  const dept = req.department || "Engineering";
  const desig = req.designation || "Software Engineer";
  const lwd = req.approved_lwd || req.proposed_lwd || dayjs().format("YYYY-MM-DD");
  const joiningDate = req.joining_date ? dayjs(req.joining_date).format("DD MMMM YYYY") : "01 January 2023";
  const resDate = req.resignation_date ? dayjs(req.resignation_date).format("DD MMMM YYYY") : currentDate;

  const refNo = `HI/HR/${type.toUpperCase()}/${empCode}/${dayjs().format("YYYYMM")}`;

  let contentHtml = "";

  if (type === "relieving") {
    contentHtml = `
      <div class="doc-header">
        <div class="ref-date">
          <div><strong>Ref:</strong> ${refNo}</div>
          <div><strong>Date:</strong> ${currentDate}</div>
        </div>
      </div>

      <div class="recipient">
        <strong>To,</strong><br/>
        <strong>${empName}</strong><br/>
        Employee Code: ${empCode}<br/>
        Designation: ${desig}<br/>
        Department: ${dept}
      </div>

      <div class="subject">
        SUBJECT: RELIEVING LETTER & ACCEPTANCE OF RESIGNATION
      </div>

      <div class="body-text">
        <p>Dear <strong>${empName}</strong>,</p>

        <p>With reference to your resignation letter dated <strong>${resDate}</strong>, we hereby accept your resignation from the position of <strong>${desig}</strong> in the <strong>${dept}</strong> department.</p>

        <p>You are hereby officially relieved from your duties and employment with <strong>Hackers Infotech</strong> with effect from the closing hours of <strong>${dayjs(lwd).format("DD MMMM YYYY")}</strong>.</p>

        <p>We confirm that you have completed all Knowledge Transfer handovers, returned all assigned IT assets, laptops, and company facilities, and completed all department clearance formalities.</p>

        <p>We appreciate your valuable contributions during your tenure with us and wish you continued success in all your future professional endeavors.</p>
      </div>
    `;
  } else if (type === "experience") {
    contentHtml = `
      <div class="doc-header">
        <div class="ref-date">
          <div><strong>Ref:</strong> ${refNo}</div>
          <div><strong>Date:</strong> ${currentDate}</div>
        </div>
      </div>

      <div class="subject-center">
        TO WHOMSOEVER IT MAY CONCERN<br/>
        <span style="font-size: 14px; font-weight: normal; color: #475569;">SERVICE & EXPERIENCE CERTIFICATE</span>
      </div>

      <div class="body-text">
        <p>This is to certify that <strong>${empName}</strong> (Employee Code: <strong>${empCode}</strong>) was employed with <strong>Hackers Infotech</strong> as <strong>${desig}</strong> in the <strong>${dept}</strong> department from <strong>${joiningDate}</strong> to <strong>${dayjs(lwd).format("DD MMMM YYYY")}</strong>.</p>

        <p>During their tenure of service with our organization, we found them to be sincere, hardworking, dedicated, and highly professional in executing their responsibilities. Their conduct and character were exemplary throughout their employment.</p>

        <p>We express our sincere appreciation for their contributions to the organization and wish them bright success and good luck in all future endeavors.</p>
      </div>
    `;
  } else if (type === "nodues") {
    contentHtml = `
      <div class="doc-header">
        <div class="ref-date">
          <div><strong>Ref:</strong> ${refNo}</div>
          <div><strong>Date:</strong> ${currentDate}</div>
        </div>
      </div>

      <div class="subject-center">
        NO DUES CLEARANCE CERTIFICATE
      </div>

      <div class="body-text">
        <p>This is to certify that <strong>${empName}</strong> (Employee Code: <strong>${empCode}</strong>, Designation: <strong>${desig}</strong>, Department: <strong>${dept}</strong>) has successfully cleared all department formalities and holds zero outstanding dues as of <strong>${dayjs(lwd).format("DD MMMM YYYY")}</strong>.</p>

        <table class="clearance-table">
          <thead>
            <tr>
              <th>Department / Section</th>
              <th>Clearance Status</th>
              <th>Cleared Date</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>IT Assets & Hardware Facilities</td>
              <td><span class="status-badge">RETURNED & CLEARED</span></td>
              <td>${currentDate}</td>
            </tr>
            <tr>
              <td>Project Manager & Knowledge Transfer</td>
              <td><span class="status-badge">ACKNOWLEDGED & CLEARED</span></td>
              <td>${currentDate}</td>
            </tr>
            <tr>
              <td>Human Resources & Exit Questionnaire</td>
              <td><span class="status-badge">COMPLETED & APPROVED</span></td>
              <td>${currentDate}</td>
            </tr>
            <tr>
              <td>Finance & Full & Final Settlement</td>
              <td><span class="status-badge">PAID & CLEARED</span></td>
              <td>${currentDate}</td>
            </tr>
          </tbody>
        </table>

        <p style="margin-top: 20px;">This certificate confirms that the employee holds no pending liabilities or commitments towards the company.</p>
      </div>
    `;
  } else {
    const baseSal = Number(req.finance_base_salary || 65000);
    const adds = Number(req.finance_additions || 0);
    const deds = Number(req.finance_deductions || 0);
    const net = baseSal + adds - deds;

    contentHtml = `
      <div class="doc-header">
        <div class="ref-date">
          <div><strong>Ref:</strong> ${refNo}</div>
          <div><strong>Date:</strong> ${currentDate}</div>
        </div>
      </div>

      <div class="subject-center">
        FULL & FINAL SETTLEMENT STATEMENT & PAYSLIP
      </div>

      <div class="body-text">
        <p>Employee: <strong>${empName}</strong> (${empCode}) | Role: <strong>${desig}</strong> (${dept})<br/>
        Last Working Day: <strong>${dayjs(lwd).format("DD MMMM YYYY")}</strong></p>

        <table class="settlement-table">
          <thead>
            <tr>
              <th>Description / Particulars</th>
              <th>Category</th>
              <th style="text-align: right;">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Base Monthly Salary Credited (HRMS Payroll)</td>
              <td>Earnings</td>
              <td style="text-align: right; font-weight: bold;">₹${baseSal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr>
              <td>Leave Encashment / Bonus Additions</td>
              <td>Additions</td>
              <td style="text-align: right; color: #16a34a; font-weight: bold;">+ ₹${adds.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr>
              <td>Notice Period Buyout / Statutory Deductions</td>
              <td>Deductions</td>
              <td style="text-align: right; color: #dc2626; font-weight: bold;">- ₹${deds.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr style="background: #f1f5f9; font-size: 16px;">
              <td colspan="2"><strong>NET FINAL SETTLEMENT AMOUNT</strong></td>
              <td style="text-align: right; font-weight: 800; color: #0284c7;">₹${net.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
            </tr>
          </tbody>
        </table>

        ${req.finance_notes ? `<p style="margin-top: 15px; font-size: 13px; color: #475569;"><strong>Notes / Remarks:</strong> ${req.finance_notes}</p>` : ""}
      </div>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${customTitle || type.toUpperCase() + " - " + empName}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
          body {
            font-family: 'Inter', sans-serif;
            margin: 0;
            padding: 40px;
            color: #1e293b;
            background: #ffffff;
          }
          .letterhead {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 3px solid #0284c7;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .company-name {
            font-size: 26px;
            font-weight: 800;
            color: #0f172a;
            letter-spacing: -0.5px;
          }
          .company-sub {
            font-size: 12px;
            color: #64748b;
            margin-top: 4px;
          }
          .ref-date {
            display: flex;
            justify-content: space-between;
            font-size: 13px;
            color: #475569;
            margin-bottom: 25px;
          }
          .recipient {
            font-size: 14px;
            line-height: 1.6;
            margin-bottom: 25px;
          }
          .subject {
            font-size: 15px;
            font-weight: 700;
            color: #0284c7;
            text-decoration: underline;
            margin-bottom: 25px;
          }
          .subject-center {
            font-size: 18px;
            font-weight: 800;
            color: #0f172a;
            text-align: center;
            margin-bottom: 30px;
            line-height: 1.4;
          }
          .body-text {
            font-size: 14px;
            line-height: 1.8;
            color: #334155;
          }
          .body-text p {
            margin-bottom: 16px;
          }
          .clearance-table, .settlement-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            font-size: 13px;
          }
          .clearance-table th, .clearance-table td, .settlement-table th, .settlement-table td {
            border: 1px solid #cbd5e1;
            padding: 10px 14px;
            text-align: left;
          }
          .clearance-table th, .settlement-table th {
            background: #f8fafc;
            font-weight: 700;
            color: #1e293b;
          }
          .status-badge {
            background: #dcfce7;
            color: #166534;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 700;
          }
          .signature-section {
            margin-top: 60px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
          }
          .sign-box {
            text-align: center;
            width: 220px;
          }
          .sign-line {
            border-top: 1.5px solid #64748b;
            margin-top: 40px;
            padding-top: 8px;
            font-size: 13px;
            font-weight: 600;
            color: #334155;
          }
          .footer-note {
            margin-top: 50px;
            font-size: 11px;
            color: #94a3b8;
            text-align: center;
            border-top: 1px solid #e2e8f0;
            padding-top: 15px;
          }
          @media print {
            body { padding: 20px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 20px; display: flex; justify-content: flex-end; gap: 10px;">
          <button onclick="window.print()" style="padding: 8px 16px; background: #0284c7; color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer;">
            🖨 Print / Download PDF
          </button>
        </div>

        <div class="letterhead">
          <div>
            <div class="company-name">HACKERS INFOTECH</div>
            <div class="company-sub">AlMax Enterprise Workspace & HRMS System | Official Letterhead</div>
          </div>
          <div style="text-align: right; font-size: 12px; color: #64748b;">
            Corporate HQ: Hacker Tower, Tech Park<br/>
            Email: hr@hackersinfotech.com | Web: www.hackersinfotech.com
          </div>
        </div>

        ${contentHtml}

        <div class="signature-section">
          <div class="sign-box">
            <div style="color: #0284c7; font-weight: 700; font-style: italic; font-size: 16px; margin-bottom: -10px;">Digital Stamp</div>
            <div class="sign-line">Employee Signature</div>
          </div>

          <div class="sign-box">
            <div style="color: #0284c7; font-weight: 700; font-style: italic; font-size: 16px; margin-bottom: -10px;">Hackers Infotech HR</div>
            <div class="sign-line">Authorized HR Signatory</div>
          </div>
        </div>

        <div class="footer-note">
          This is an official system-generated document from Hackers Infotech HRMS. Verification Code: ${refNo}
        </div>
      </body>
    </html>
  `;
}

export function openAndPrintDocument(
  type: DocumentType,
  req: Partial<OffboardingRequest>,
  customTitle?: string
) {
  const html = generateOffboardingDocumentHtml(type, req, customTitle);
  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  }
}
