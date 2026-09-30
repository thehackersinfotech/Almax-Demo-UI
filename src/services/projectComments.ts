import { get, post, patch, del } from "./api";
import { ENDPOINTS } from "@/constants/api";

export interface CommentAcknowledgement {
  id: string;
  acknowledged_by: string;
  acknowledged_by_name: string;
  acknowledged_at: string;
}

export interface ProjectComment {
  id: string;
  project: string;
  body: string;
  is_pinned: boolean;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  acknowledgements: CommentAcknowledgement[];
  ack_count: number;
  current_user_acked: boolean;
}

export interface CreateCommentPayload {
  project: string;
  body: string;
  is_pinned?: boolean;
}

export const projectCommentsApi = {
  list: (projectId: string) =>
    get<ProjectComment[]>(ENDPOINTS.PROJECT_COMMENTS, { project: projectId }),

  create: (payload: CreateCommentPayload) =>
    post<ProjectComment>(ENDPOINTS.PROJECT_COMMENTS, payload),

  update: (id: string, body: string) =>
    patch<ProjectComment>(`${ENDPOINTS.PROJECT_COMMENTS}${id}/`, { body }),

  delete: (id: string) =>
    del<void>(`${ENDPOINTS.PROJECT_COMMENTS}${id}/`),

  acknowledge: (id: string) =>
    post<ProjectComment>(`${ENDPOINTS.PROJECT_COMMENTS}${id}/acknowledge/`),

  unacknowledge: (id: string) =>
    del<ProjectComment>(`${ENDPOINTS.PROJECT_COMMENTS}${id}/unacknowledge/`),
};
