import client, { get, post, patch, del } from "./api";

export interface CrmFolder {
  id: string;
  name: string;
  description?: string;
  color?: string;
  client?: string | null;
  client_name?: string;
  project?: string | null;
  project_name?: string;
  lead?: string | null;
  lead_name?: string;
  files_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface CrmDocument {
  id: string;
  folder?: string | null;
  folder_name?: string;
  lead?: string | null;
  lead_name?: string;
  title: string;
  file?: string;
  file_url?: string;
  original_name?: string;
  file_size?: number;
  content_type?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CrmFolderListParams {
  search?: string;
  client?: string;
  project?: string;
  lead?: string;
}

export interface CrmDocumentListParams {
  folder?: string;
  lead?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

export const crmFoldersApi = {
  list: (params?: CrmFolderListParams) =>
    get<CrmFolder[]>("/crm-folders/", params),

  get: (id: string) =>
    get<CrmFolder>(`/crm-folders/${id}/`),

  create: (data: Partial<CrmFolder>) =>
    post<CrmFolder>("/crm-folders/", data),

  update: (id: string, data: Partial<CrmFolder>) =>
    patch<CrmFolder>(`/crm-folders/${id}/`, data),

  delete: (id: string) =>
    del(`/crm-folders/${id}/`),

  downloadFolder: async (id: string, folderName?: string) => {
    const res = await client.get(`/crm-folders/${id}/download/`, {
      responseType: "blob",
    });
    const blob = new Blob([res.data], { type: "application/zip" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const cleanName = (folderName || "folder").replace(/[/\\?%*:|"<>]/g, "_");
    link.setAttribute("download", `${cleanName}.zip`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};

export const crmDocumentsApi = {
  list: (params?: CrmDocumentListParams) =>
    get<{ count: number; results: CrmDocument[] }>("/crm-documents/", params),

  get: (id: string) =>
    get<CrmDocument>(`/crm-documents/${id}/`),

  upload: (data: { file: File; title?: string; folder?: string; lead?: string }) => {
    const formData = new FormData();
    formData.append("file", data.file);
    if (data.title) formData.append("title", data.title);
    if (data.folder) formData.append("folder", data.folder);
    if (data.lead) formData.append("lead", data.lead);
    return post<CrmDocument>("/crm-documents/", formData);
  },

  delete: (id: string) =>
    del(`/crm-documents/${id}/`),
};
