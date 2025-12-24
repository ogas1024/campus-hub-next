"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Course, CourseResourceDetail, Major, ResourceType } from "@/lib/api/course-resources";
import { formatFileSize, getCourseResourceTypeLabel } from "@/lib/modules/course-resources/courseResources.ui";
import { COURSE_RESOURCES_MAX_FILE_SIZE } from "@/lib/modules/course-resources/courseResources.utils";

import type { FixedCourseContext } from "./PortalResourceEditorDialog";

type SharedProps = {
  fixedContext?: FixedCourseContext;
  majors: Major[];
  courses: Course[];
  majorId: string;
  setMajorId: (value: string) => void;
  courseId: string;
  setCourseId: (value: string) => void;
  resourceType: ResourceType;
  setResourceType: (value: ResourceType) => void;
  title: string;
  setTitle: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  editable: boolean;
};

type CreateProps = SharedProps & {
  mode: "create";
};

type EditProps = SharedProps & {
  mode: "edit";
  linkUrl: string;
  setLinkUrl: (value: string) => void;
  uploading: boolean;
  hashing: boolean;
  onUploadFile: (file: File) => Promise<void>;
  resource: CourseResourceDetail;
};

type Props = CreateProps | EditProps;

export function PortalResourceEditorFormFields(props: Props) {
  const selectionLocked = props.mode === "create" && !!props.fixedContext;
  const showFileSection = props.mode === "edit" && props.resourceType === "file";
  const showLinkSection = props.mode === "edit" && props.resourceType === "link";

  return (
    <>
      {props.mode === "edit" && props.resource.status === "rejected" && props.resource.review?.comment ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">驳回原因</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm text-muted-foreground">{props.resource.review.comment}</CardContent>
        </Card>
      ) : null}

      {props.mode === "edit" && !props.editable ? (
        <div className="rounded-lg border border-border bg-muted p-3 text-sm text-muted-foreground">
          {props.resource.status === "pending"
            ? "待审核状态不可修改。"
            : props.resource.status === "published"
              ? "已发布不可直接修改；请先下架到“已下架”，再编辑并重新提交审核。"
              : "当前状态不可编辑。"}
        </div>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{props.mode === "create" ? "基本信息" : "元数据"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectionLocked ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="secondary">{props.fixedContext!.major.name}</Badge>
              <Badge variant="secondary">{props.fixedContext!.course.name}</Badge>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>专业</Label>
                <Select uiSize="sm" value={props.majorId} onChange={(e) => props.setMajorId(e.target.value)} disabled={!props.editable || props.majors.length === 0}>
                  {props.majors.length === 0 ? <option value="">暂无专业</option> : null}
                  {props.majors.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>课程</Label>
                <Select uiSize="sm" value={props.courseId} onChange={(e) => props.setCourseId(e.target.value)} disabled={!props.editable || !props.majorId || props.courses.length === 0}>
                  {props.courses.length === 0 ? <option value="">该专业暂无课程</option> : null}
                  {props.courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          )}

          <div className="grid gap-1.5">
            <Label>资源类型</Label>
            <Select
              uiSize="sm"
              value={props.resourceType}
              onChange={(e) => props.setResourceType(e.target.value as ResourceType)}
              disabled={!props.editable}
            >
              <option value="file">{getCourseResourceTypeLabel("file")}（zip/rar/7z，≤{formatFileSize(COURSE_RESOURCES_MAX_FILE_SIZE)}）</option>
              <option value="link">{getCourseResourceTypeLabel("link")}（URL）</option>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label>标题</Label>
            <Input uiSize="sm" value={props.title} onChange={(e) => props.setTitle(e.target.value)} maxLength={200} disabled={!props.editable} />
          </div>

          <div className="grid gap-1.5">
            <Label>描述</Label>
            <Textarea value={props.description} onChange={(e) => props.setDescription(e.target.value)} maxLength={2000} disabled={!props.editable} />
          </div>

          {props.mode === "create" ? (
            <div className="text-sm text-muted-foreground">
              创建草稿后，可继续上传压缩包或填写外链，并在弹窗底部提交审核。
            </div>
          ) : null}
        </CardContent>
      </Card>

      {showLinkSection ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">外链（URL）</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-1.5">
              <Label>外链 URL</Label>
              <Input
                uiSize="sm"
                value={props.linkUrl}
                onChange={(e) => props.setLinkUrl(e.target.value)}
                maxLength={2000}
                disabled={!props.editable}
                placeholder="https://..."
              />
              <div className="text-xs text-muted-foreground">提交时会进行 URL 规范化与去重校验；下载将通过下载入口计数并跳转。</div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {showFileSection ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">文件上传</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 rounded-lg border border-border bg-muted p-4">
              <div className="text-sm font-medium">压缩包（zip/rar/7z）</div>
              <div className="text-xs text-muted-foreground">≤ {formatFileSize(COURSE_RESOURCES_MAX_FILE_SIZE)}；将计算 SHA-256 用于去重。</div>
              <div className="text-xs text-muted-foreground">
                {props.resource?.file ? (
                  <>
                    当前：{props.resource.file.fileName} · {formatFileSize(props.resource.file.size)}
                  </>
                ) : (
                  "尚未上传"
                )}
              </div>
              <input
                type="file"
                accept=".zip,.rar,.7z"
                disabled={!props.editable || props.uploading || props.hashing}
                onChange={async (e) => {
                  const file = e.target.files?.[0] ?? null;
                  e.target.value = "";
                  if (!file) return;
                  await props.onUploadFile(file);
                }}
              />
              {props.hashing ? <div className="text-xs text-muted-foreground">计算 SHA-256 中…</div> : null}
              {props.uploading ? <div className="text-xs text-muted-foreground">上传中…</div> : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {props.mode === "edit" && props.resource.resourceType === "file" && !props.resource.file ? (
        <div className="text-sm text-muted-foreground">提示：请先上传压缩包，再提交审核。</div>
      ) : null}

      {props.mode === "edit" && props.resource.resourceType === "link" && !props.linkUrl.trim() ? (
        <div className="text-sm text-muted-foreground">提示：请先填写外链 URL，再提交审核。</div>
      ) : null}

      {props.mode === "edit" && props.resource.file?.downloadUrl ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Button
            variant="outline"
            size="sm"
            disabled={!props.resource.file?.downloadUrl}
            onClick={() => {
              if (!props.resource.file?.downloadUrl) return;
              window.open(props.resource.file.downloadUrl, "_blank", "noopener,noreferrer");
            }}
          >
            预览下载链接
          </Button>
          <span className="text-xs text-muted-foreground">（仅用于自检，最终下载以“下载”按钮计数）</span>
        </div>
      ) : null}
    </>
  );
}
