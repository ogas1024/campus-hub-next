import { handleConsoleScopeOptionsRequest } from "@/lib/http/scopeOptions";

export async function GET() {
  return handleConsoleScopeOptionsRequest(["campus:notice:create", "campus:notice:update"]);
}
