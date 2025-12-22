import { handleConsoleScopeOptionsRequest } from "@/lib/http/scopeOptions";

export async function GET() {
  return handleConsoleScopeOptionsRequest(["campus:survey:create", "campus:survey:update"]);
}
