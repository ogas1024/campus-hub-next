"use client";

import Link from "next/link";
import { type Dispatch, type SetStateAction, useMemo } from "react";

import { VisibilityScopeSelector } from "@/components/console/VisibilityScopeSelector";
import { NoticeEditor } from "@/components/notices/NoticeEditor";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { ConsoleMaterialDetail } from "@/lib/api/console-materials";
import type { SelectedScopes } from "@/lib/ui/visibilityScope";
import { createEmptySelectedScopes, selectedScopesToInputs } from "@/lib/ui/visibilityScope";
import { cn } from "@/lib/utils";

type MaterialItemState = ConsoleMaterialDetail["items"][number];

type Props = {
  mode: "create" | "edit";
  status: "draft" | "published" | "closed";
  archivedAt: string | null;
  canOperate: boolean;
  editableStructure: boolean;
  formDisabled: boolean;

  title: string;
  setTitle: (value: string) => void;
  descriptionMd: string;
  setDescriptionMd: (value: string) => void;
  noticeId: string;
  setNoticeId: (value: string) => void;
  noticeIdLocked: boolean;
  linkedNotice: ConsoleMaterialDetail["notice"];

  visibleAll: boolean;
  setVisibleAll: (value: boolean) => void;
  linkedToNotice: boolean;
  selected: SelectedScopes;
  setSelected: Dispatch<SetStateAction<SelectedScopes>>;
  scopeOptions: Parameters<typeof VisibilityScopeSelector>[0]["options"];
  scopeError?: string | null;

  maxFilesPerSubmission: number;
  setMaxFilesPerSubmission: (value: number) => void;
  dueAtLocal: string;
  setDueAtLocal: (value: string) => void;

  items: MaterialItemState[];
  setItems: Dispatch<SetStateAction<MaterialItemState[]>>;
  onAddItem: () => void;
  onUploadTemplate: (itemId: string, file: File) => Promise<void>;
  canUploadTemplate: boolean;
};

export function ConsoleMaterialEditorFormFields(props: Props) {
  const scopes = useMemo(() => selectedScopesToInputs(props.selected), [props.selected]);
  const scopeDisabled = props.linkedToNotice || !props.editableStructure;

  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <Label>标题</Label>
        <Input uiSize="sm" value={props.title} onChange={(e) => props.setTitle(e.target.value)} maxLength={200} required disabled={!props.editableStructure || props.formDisabled} />
      </div>

      <div className="grid gap-1.5">
        <Label>关联公告（可选）</Label>
        <Input
          uiSize="sm"
          value={props.noticeId}
          onChange={(e) => props.setNoticeId(e.target.value)}
          placeholder="填写公告 ID（UUID），或从公告编辑页进入自动带入"
          disabled={props.noticeIdLocked || props.formDisabled || (props.mode === "edit" && !props.editableStructure)}
        />
        {props.linkedToNotice ? (
          <div className="text-xs text-muted-foreground">
            已关联公告：可见范围继承公告设置。
            <Link
              className={cn("ml-2 underline underline-offset-2 hover:text-foreground", props.linkedNotice ? "" : "font-mono")}
              href={`/console/notices?dialog=notice-edit&id=${encodeURIComponent(props.noticeId.trim())}`}
            >
              {props.linkedNotice?.title ?? props.noticeId.trim()}
            </Link>
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="grid gap-1.5">
          <Label>截止时间{props.status === "draft" ? "（发布必填）" : ""}</Label>
          <Input
            uiSize="sm"
            type="datetime-local"
            value={props.dueAtLocal}
            onChange={(e) => props.setDueAtLocal(e.target.value)}
            required
            disabled={props.formDisabled || (props.mode === "edit" && (!props.canOperate || !!props.archivedAt))}
          />
        </div>
        <div className="grid gap-1.5">
          <Label>每次提交最多文件数</Label>
          <Select
            uiSize="sm"
            value={String(props.maxFilesPerSubmission)}
            disabled={props.formDisabled || !props.editableStructure}
            onChange={(e) => props.setMaxFilesPerSubmission(Number(e.target.value))}
          >
            {[5, 10, 20, 30, 50].map((n) => (
              <option key={n} value={String(n)}>
                {n} 个
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Checkbox
          id="visibleAll"
          checked={props.visibleAll}
          disabled={props.formDisabled || scopeDisabled}
          onCheckedChange={(v) => {
            const next = v === true;
            props.setVisibleAll(next);
            if (next) props.setSelected(createEmptySelectedScopes());
          }}
        />
        <Label htmlFor="visibleAll" className="text-sm font-normal">
          全员可见
        </Label>
        {!props.visibleAll && !props.linkedToNotice ? <span className="text-xs text-muted-foreground">（role/department/position 任一命中即可见）</span> : null}
      </div>

      {!props.visibleAll && !props.linkedToNotice ? (
        <div className="space-y-2">
          <VisibilityScopeSelector options={props.scopeOptions} selected={props.selected} setSelected={props.setSelected} disabled={props.formDisabled || scopeDisabled} />
          {props.scopeError ? <div className="text-sm text-destructive">{props.scopeError}</div> : null}
        </div>
      ) : null}

      {!props.visibleAll && scopes.length === 0 && !props.linkedToNotice ? <div className="text-sm text-destructive">请至少选择 1 个可见范围</div> : null}

      <div className="space-y-2">
        <Label>说明（可选）</Label>
        <div className="rounded-lg border border-input">
          <NoticeEditor value={props.descriptionMd} onChange={props.setDescriptionMd} />
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-muted p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-medium">材料项</div>
          <Button size="sm" variant="outline" disabled={props.formDisabled || !props.editableStructure} onClick={() => props.onAddItem()}>
            添加材料项
          </Button>
        </div>

        {props.items.length === 0 ? <div className="text-sm text-muted-foreground">至少需要 1 个材料项（发布前校验）。</div> : null}

        <div className="space-y-3">
          {props.items.map((it, idx) => (
            <div key={it.id} className="rounded-lg border border-border bg-background p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="grid gap-1.5">
                    <Label>标题</Label>
                    <Input
                      value={it.title}
                      disabled={!props.editableStructure || props.formDisabled}
                      onChange={(e) => props.setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, title: e.target.value } : x)))}
                      maxLength={200}
                      required
                    />
                  </div>

                  <div className="grid gap-1.5">
                    <Label>说明（可选）</Label>
                    <Input
                      value={it.description ?? ""}
                      disabled={!props.editableStructure || props.formDisabled}
                      onChange={(e) =>
                        props.setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, description: e.target.value.trim() ? e.target.value : null } : x)))
                      }
                      maxLength={2000}
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <Checkbox
                      id={`${it.id}-required`}
                      checked={it.required}
                      disabled={!props.editableStructure || props.formDisabled}
                      onCheckedChange={(v) => props.setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, required: v === true } : x)))}
                    />
                    <Label htmlFor={`${it.id}-required`} className="text-sm font-normal">
                      必交
                    </Label>
                  </div>

                  {props.mode === "edit" ? (
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-muted-foreground">模板</div>
                      {it.template ? (
                        <div className="text-sm">
                          <span className="font-medium">{it.template.fileName}</span>{" "}
                          <span className="text-xs text-muted-foreground">（{Math.ceil(it.template.size / 1024)} KB）</span>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">未上传</div>
                      )}

                      <Input
                        type="file"
                        disabled={!props.canUploadTemplate}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (!file) return;
                          await props.onUploadTemplate(it.id, file);
                        }}
                      />
                      {props.status === "closed" ? <div className="text-xs text-muted-foreground">已关闭任务不允许上传模板。</div> : null}
                    </div>
                  ) : null}
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  disabled={props.formDisabled || !props.editableStructure || props.items.length <= 1}
                  onClick={() => props.setItems((prev) => prev.filter((x) => x.id !== it.id).map((x, i) => ({ ...x, sort: i })))}
                >
                  移除
                </Button>
              </div>

              <div className="mt-3 text-xs text-muted-foreground">排序：{idx + 1}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
