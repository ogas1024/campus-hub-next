import { apiGetJson, apiPutJson } from "@/lib/api/http";

export type RegistrationConfig = { requiresApproval: boolean };

export function fetchRegistrationConfig() {
  return apiGetJson<RegistrationConfig>("/api/console/config/registration");
}

export function updateRegistrationConfig(body: { requiresApproval: boolean; reason?: string }) {
  return apiPutJson<RegistrationConfig>("/api/console/config/registration", body);
}

