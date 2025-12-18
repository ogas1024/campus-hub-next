import { Suspense } from "react";

import ResetPasswordClient from "./ResetPasswordClient";

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-lg border border-border bg-muted p-3 text-sm text-muted-foreground">
          正在加载...
        </div>
      }
    >
      <ResetPasswordClient />
    </Suspense>
  );
}

