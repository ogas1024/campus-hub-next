import { handleConsoleScopeOptionsRequest } from "@/lib/http/scopeOptions";

export async function GET() {
  return handleConsoleScopeOptionsRequest(["campus:material:create", "campus:material:update"]);
}
