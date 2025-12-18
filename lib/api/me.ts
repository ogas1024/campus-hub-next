import { apiDeleteJson, apiGetJson, apiPatchJson, apiPostForm } from "@/lib/api/http";

export type MyProfileResponse = {
  id: string;
  email: string | null;
  name: string;
  username: string | null;
  studentId: string;
  avatarUrl: string | null;
  status: "active" | "disabled" | "banned" | "pending_approval" | "pending_email_verification";
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
};

export function fetchMyProfile() {
  return apiGetJson<MyProfileResponse>("/api/me/profile");
}

export function patchMyProfile(body: { name?: string; username?: string | null }) {
  return apiPatchJson<MyProfileResponse>("/api/me/profile", body);
}

export function uploadMyAvatar(file: File) {
  const form = new FormData();
  form.append("file", file);
  return apiPostForm<MyProfileResponse>("/api/me/avatar", form);
}

export function deleteMyAvatar() {
  return apiDeleteJson<MyProfileResponse>("/api/me/avatar");
}
