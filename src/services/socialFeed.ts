import { get, post, patch, del, upload } from "./api";
import client from "./api";

export interface SocialPostItem {
  id: string;
  title: string;
  content: string;
  image: string | null;
  image_url: string | null;
  attachment: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  created_by_name: string;
  created_by_avatar: string | null;
  created_by_id: string | null;
  is_company_wide: boolean;
  workflow_state: string | null;
  workflow_state_name: string;
  workflow_state_slug: string;
  workflow_state_color: string;
  like_count: number;
  comment_count: number;
  is_liked_by_me: boolean;
  can_transition: boolean;
  allowed_destination_slugs?: string[];
  created_at: string;
  updated_at: string;
  comments?: SocialPostComment[];
  available_states?: Array<{ id: string; name: string; slug: string; color: string }>;
}

export interface SocialPostCreate {
  title: string;
  content?: string;
  image?: File | null;
  attachment?: File | null;
  is_company_wide?: boolean;
}

export interface SocialPostComment {
  id: string;
  post: string;
  content: string;
  created_by_name: string;
  created_by_avatar: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaginatedResponse<T> {
  results: T[];
  count: number;
}

export interface PaginatedFeedResponse {
  count: number;
  total_pages: number;
  next: string | null;
  previous: string | null;
  current_page: number;
  results: SocialPostItem[];
}

export const socialFeedApi = {
  list: async (params?: Record<string, string>) => {
    const res = await get<PaginatedResponse<SocialPostItem> | SocialPostItem[]>("/social-feed/", {
      ...params,
      page_size: params?.page_size ?? "50",
    });
    return Array.isArray(res) ? res : res.results;
  },

  feed: (params?: { page?: number; page_size?: number }) =>
    get<PaginatedFeedResponse>("/social-feed/feed/", {
      page: String(params?.page ?? 1),
      page_size: String(params?.page_size ?? 10),
    }),

  myPosts: async (params?: Record<string, string>) => {
    const res = await get<PaginatedResponse<SocialPostItem> | SocialPostItem[]>("/social-feed/my-posts/", {
      ...params,
      page_size: params?.page_size ?? "50",
    });
    return Array.isArray(res) ? res : res.results;
  },

  retrieve: (id: string) =>
    get<SocialPostItem>(`/social-feed/${id}/`),

  create: (data: SocialPostCreate) => {
    const formData = new FormData();
    formData.append("title", data.title);
    if (data.content) formData.append("content", data.content);
    if (data.image) formData.append("image", data.image);
    if (data.attachment) formData.append("attachment", data.attachment);
    formData.append("is_company_wide", String(data.is_company_wide ?? true));
    return upload<SocialPostItem>("/social-feed/", formData);
  },

  update: async (id: string, data: Partial<SocialPostCreate>) => {
    const formData = new FormData();
    if (data.title) formData.append("title", data.title);
    if (data.content !== undefined) formData.append("content", data.content);
    if (data.image) formData.append("image", data.image);
    if (data.attachment) formData.append("attachment", data.attachment);
    formData.append("is_company_wide", String(data.is_company_wide ?? true));
    const res = await client.patch<SocialPostItem>(`/social-feed/${id}/`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },

  delete: (id: string) =>
    del(`/social-feed/${id}/`),

  transition: (id: string, destination_state: string, comments = "") =>
    post<{ message: string; workflow_state_name: string; workflow_state_slug: string }>(
      `/social-feed/${id}/transition/`,
      { destination_state, comments },
    ),

  like: (id: string) =>
    post<{ liked: boolean; like_count: number }>(`/social-feed/${id}/like/`),

  comment: (id: string, content: string) =>
    post<SocialPostComment>(`/social-feed/${id}/comment/`, { content }),

  listComments: (id: string) =>
    get<SocialPostComment[]>(`/social-feed/${id}/comments/`),
};

export const SOCIAL_POST_WORKFLOW_LABELS: Record<string, string> = {
  draft: "Draft",
  pending_approval: "Pending Approval",
  approved: "Approved",
  rejected: "Rejected",
  published: "Published",
};

export const SOCIAL_POST_WORKFLOW_COLORS: Record<string, string> = {
  draft: "#6B7280",
  pending_approval: "#F59E0B",
  approved: "#10B981",
  rejected: "#EF4444",
  published: "#3B82F6",
};
