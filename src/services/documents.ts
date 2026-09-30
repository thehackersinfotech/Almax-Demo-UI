import { get, del, upload } from "./api";

export interface EmployeeDocument {
  id: string;
  document_type: "IDENTITY_CARD" | "PAN_CARD" | "PASSPORT" | "CERTIFICATE";
  document_type_display: string;
  title: string;
  file: string | null;
  file_url: string | null;
  uploaded_at: string;
}

export const documentApi = {
  list: (params?: Record<string, unknown>) =>
    get<any>("/employee-documents/", params).then((r: any) =>
      Array.isArray(r) ? r : r.results ?? r
    ),
  create: (formData: FormData) => upload<EmployeeDocument>("/employee-documents/", formData),
  delete: (id: string) => del(`/employee-documents/${id}/`),
};
