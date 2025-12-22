import { handleConsoleScopeOptionsRequest } from "@/lib/http/scopeOptions";

export async function GET() {
  return handleConsoleScopeOptionsRequest(["campus:vote:create", "campus:vote:update"]);
}
