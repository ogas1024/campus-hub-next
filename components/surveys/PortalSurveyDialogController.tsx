"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { PortalSurveyFillDialog } from "@/components/surveys/PortalSurveyFillDialog";

function buildHref(pathname: string, searchParams: URLSearchParams) {
  const qs = searchParams.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function PortalSurveyDialogController() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const dialog = searchParams.get("dialog") ?? "";
  const id = searchParams.get("id") ?? "";

  const state = useMemo(() => {
    if (dialog === "survey-fill" && id) return { open: true as const, surveyId: id };
    return { open: false as const, surveyId: "" };
  }, [dialog, id]);

  function close() {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("dialog");
    next.delete("id");
    router.replace(buildHref(pathname, next), { scroll: false });
  }

  useEffect(() => {
    if (dialog === "survey-fill" && !id) close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog, id]);

  return <PortalSurveyFillDialog open={state.open} surveyId={state.surveyId} onRequestClose={close} />;
}

