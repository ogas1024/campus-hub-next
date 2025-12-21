"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { InlineError } from "@/components/common/InlineError";
import { Button } from "@/components/ui/button";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";
import { setLibraryBookFavorite } from "@/lib/api/library";

export function LibraryFavoriteButton(props: { bookId: string; initialFavorite: boolean }) {
  const router = useRouter();
  const action = useAsyncAction();
  const [favorite, setFavorite] = useState(props.initialFavorite);

  return (
    <div className="space-y-2">
      <Button
        variant={favorite ? "default" : "outline"}
        size="sm"
        disabled={action.pending}
        onClick={() => {
          void action.run(
            async () => {
              const next = !favorite;
              const res = await setLibraryBookFavorite(props.bookId, { favorite: next });
              setFavorite(res.favorite);
              router.refresh();
            },
            { fallbackErrorMessage: "操作失败" },
          );
        }}
      >
        {action.pending ? "处理中..." : favorite ? "已收藏" : "收藏"}
      </Button>
      <InlineError message={action.error} />
    </div>
  );
}

