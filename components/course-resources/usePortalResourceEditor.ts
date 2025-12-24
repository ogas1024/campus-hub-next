"use client";

import { useEffect, useMemo, useState } from "react";

import type { Course, CourseResourceDetail, Major, ResourceType } from "@/lib/api/course-resources";
import {
  createMyResourceDraft,
  createMyResourceUploadUrl,
  deleteMyResource,
  fetchMyResourceDetail,
  fetchPortalCourses,
  fetchPortalMajors,
  submitMyResource,
  unpublishMyResource,
  updateMyResource,
} from "@/lib/api/course-resources";
import { ApiResponseError, getApiErrorMessage } from "@/lib/api/http";
import { COURSE_RESOURCES_MAX_FILE_SIZE, isAllowedArchiveFileName, normalizeExternalUrl } from "@/lib/modules/course-resources/courseResources.utils";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

import type { FixedCourseContext } from "./PortalResourceEditorDialog";

type Mode = "create" | "edit";

type Snapshot = {
  majorId: string;
  courseId: string;
  resourceType: ResourceType;
  title: string;
  description: string;
  linkUrl: string;
};

async function sha256Hex(file: File) {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function snapshotKey(snapshot: Snapshot) {
  return JSON.stringify({
    majorId: snapshot.majorId,
    courseId: snapshot.courseId,
    resourceType: snapshot.resourceType,
    title: snapshot.title.trim(),
    description: snapshot.description.trim(),
    linkUrl: snapshot.linkUrl.trim(),
  });
}

export function usePortalResourceEditor(params: {
  open: boolean;
  mode: Mode;
  resourceId?: string;
  fixedContext?: FixedCourseContext;
}) {
  const effectiveResourceId = params.mode === "edit" ? (params.resourceId?.trim() ? params.resourceId.trim() : null) : null;
  const selectionLocked = params.mode === "create" && !!params.fixedContext;

  const [majors, setMajors] = useState<Major[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);

  const [resource, setResource] = useState<CourseResourceDetail | null>(null);

  const [majorId, setMajorId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [resourceType, setResourceType] = useState<ResourceType>("file");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [hashing, setHashing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [initialSnapshot, setInitialSnapshot] = useState<Snapshot | null>(null);

  const currentSnapshot = useMemo<Snapshot>(
    () => ({ majorId, courseId, resourceType, title, description, linkUrl }),
    [courseId, description, linkUrl, majorId, resourceType, title],
  );

  const dirty = useMemo(() => {
    if (!params.open) return false;
    if (!initialSnapshot) return false;
    return snapshotKey(currentSnapshot) !== snapshotKey(initialSnapshot);
  }, [currentSnapshot, initialSnapshot, params.open]);

  const editable = useMemo(() => {
    if (params.mode === "create") return true;
    const status = resource?.status;
    return status === "draft" || status === "rejected" || status === "unpublished";
  }, [params.mode, resource?.status]);

  const canCreate = useMemo(() => {
    if (!majorId || !courseId) return false;
    if (!title.trim() || !description.trim()) return false;
    return true;
  }, [courseId, description, majorId, title]);

  const canSave = useMemo(() => {
    if (!editable) return false;
    if (!majorId || !courseId) return false;
    if (!title.trim() || !description.trim()) return false;
    if (resourceType === "link" && !linkUrl.trim()) return false;
    return true;
  }, [courseId, description, editable, linkUrl, majorId, resourceType, title]);

  const canSubmit = useMemo(() => {
    if (!editable) return false;
    if (!canSave) return false;
    if (!resource) return false;
    if (resourceType === "file" && !resource.file) return false;
    return true;
  }, [canSave, editable, resource, resourceType]);

  function resetCreate() {
    setMajors([]);
    setCourses([]);
    setResource(null);
    setMajorId("");
    setCourseId("");
    setResourceType("file");
    setTitle("");
    setDescription("");
    setLinkUrl("");
    setError(null);
    setInfo(null);
    setLoading(false);
    setCreating(false);
    setSaving(false);
    setSubmitting(false);
    setUnpublishing(false);
    setUploading(false);
    setHashing(false);
    setDeleting(false);
    setInitialSnapshot(null);
  }

  function applyDetail(detail: CourseResourceDetail) {
    setResource(detail);
    setMajorId(detail.majorId);
    setCourseId(detail.courseId);
    setResourceType(detail.resourceType);
    setTitle(detail.title);
    setDescription(detail.description);
    setLinkUrl(detail.link?.url ?? "");
    setInitialSnapshot({
      majorId: detail.majorId,
      courseId: detail.courseId,
      resourceType: detail.resourceType,
      title: detail.title,
      description: detail.description,
      linkUrl: detail.link?.url ?? "",
    });
  }

  useEffect(() => {
    if (!params.open) return;
    if (params.mode !== "create") return;

    resetCreate();

    if (params.fixedContext) {
      setMajorId(params.fixedContext.major.id);
      setCourseId(params.fixedContext.course.id);
      setInitialSnapshot({
        majorId: params.fixedContext.major.id,
        courseId: params.fixedContext.course.id,
        resourceType: "file",
        title: "",
        description: "",
        linkUrl: "",
      });
      return;
    }

    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await fetchPortalMajors();
        if (cancelled) return;
        setMajors(list);
        const firstMajorId = list[0]?.id ?? "";
        setMajorId(firstMajorId);
      } catch (err) {
        if (cancelled) return;
        setError(getApiErrorMessage(err, "加载专业列表失败"));
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.open, params.mode]);

  useEffect(() => {
    if (!params.open) return;
    if (params.mode !== "edit") return;
    if (!effectiveResourceId) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      setInfo(null);
      try {
        const [detail, majorList] = await Promise.all([fetchMyResourceDetail(effectiveResourceId), fetchPortalMajors()]);
        if (cancelled) return;
        setMajors(majorList);
        applyDetail(detail);
      } catch (err) {
        if (cancelled) return;
        setError(getApiErrorMessage(err, "加载资源详情失败"));
        setResource(null);
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [effectiveResourceId, params.mode, params.open]);

  useEffect(() => {
    if (!params.open) return;
    if (selectionLocked) return;
    let cancelled = false;
    void (async () => {
      if (!majorId) {
        setCourses([]);
        setCourseId("");
        return;
      }
      try {
        const list = await fetchPortalCourses(majorId);
        if (cancelled) return;
        setCourses(list);
        setCourseId((prev) => (list.some((c) => c.id === prev) ? prev : (list[0]?.id ?? "")));

        if (params.mode === "create" && !initialSnapshot) {
          const nextCourseId = list.some((c) => c.id === courseId) ? courseId : (list[0]?.id ?? "");
          setInitialSnapshot({
            majorId,
            courseId: nextCourseId,
            resourceType,
            title,
            description,
            linkUrl,
          });
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiResponseError ? err.message : "加载课程列表失败");
        setCourses([]);
        setCourseId("");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [majorId, params.open, selectionLocked]);

  async function createDraft() {
    setError(null);
    setInfo(null);
    if (!canCreate) {
      setError("请先填写专业/课程、标题与描述");
      return null;
    }

    setCreating(true);
    try {
      const created = await createMyResourceDraft({
        majorId,
        courseId,
        resourceType,
        title: title.trim(),
        description: description.trim(),
      });
      setInfo("草稿已创建");
      return created.id;
    } catch (err) {
      setError(getApiErrorMessage(err, "创建草稿失败"));
      return null;
    } finally {
      setCreating(false);
    }
  }

  async function save() {
    if (!resource) return false;
    setError(null);
    setInfo(null);
    if (!canSave) {
      setError(resourceType === "link" ? "请补全标题/描述并填写外链 URL" : "请补全标题/描述");
      return false;
    }

    setSaving(true);
    try {
      const body: Parameters<typeof updateMyResource>[1] = {
        majorId,
        courseId,
        title: title.trim(),
        description: description.trim(),
        resourceType,
      };
      body.linkUrl = resourceType === "link" ? normalizeExternalUrl(linkUrl) : null;

      const next = await updateMyResource(resource.id, body);
      applyDetail(next);
      setInfo("已保存");
      return true;
    } catch (err) {
      setError(getApiErrorMessage(err, "保存失败"));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function submit() {
    if (!resource) return false;
    setError(null);
    setInfo(null);

    if (!canSubmit) {
      if (resourceType === "file" && !resource.file) {
        setError("请先上传压缩包，再提交审核");
        return false;
      }
      setError("请先补全内容并保存，再提交审核");
      return false;
    }

    setSubmitting(true);
    try {
      const body: Parameters<typeof updateMyResource>[1] = {
        majorId,
        courseId,
        title: title.trim(),
        description: description.trim(),
        resourceType,
      };
      body.linkUrl = resourceType === "link" ? normalizeExternalUrl(linkUrl) : null;

      const saved = await updateMyResource(resource.id, body);
      setResource(saved);
      setInitialSnapshot({
        majorId: saved.majorId,
        courseId: saved.courseId,
        resourceType: saved.resourceType,
        title: saved.title,
        description: saved.description,
        linkUrl: saved.link?.url ?? "",
      });

      const next = await submitMyResource(resource.id);
      setResource(next);
      setInfo("已提交审核");
      return true;
    } catch (err) {
      setError(getApiErrorMessage(err, "提交审核失败"));
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  async function unpublish() {
    if (!resource) return false;
    setError(null);
    setInfo(null);

    setUnpublishing(true);
    try {
      const next = await unpublishMyResource(resource.id);
      setResource(next);
      setInfo("已下架，可编辑后重新提交审核");
      return true;
    } catch (err) {
      setError(getApiErrorMessage(err, "下架失败"));
      return false;
    } finally {
      setUnpublishing(false);
    }
  }

  async function deleteResource() {
    if (!resource) return false;
    setError(null);
    setInfo(null);

    setDeleting(true);
    try {
      await deleteMyResource(resource.id);
      setInfo("已删除");
      return true;
    } catch (err) {
      setError(getApiErrorMessage(err, "删除失败"));
      return false;
    } finally {
      setDeleting(false);
    }
  }

  async function uploadFile(file: File) {
    if (!resource) return false;
    setError(null);
    setInfo(null);

    if (!isAllowedArchiveFileName(file.name)) {
      setError("仅允许 zip/rar/7z 压缩包");
      return false;
    }
    if (file.size <= 0 || file.size > COURSE_RESOURCES_MAX_FILE_SIZE) {
      setError("文件大小必须在 0~200MB 之间");
      return false;
    }

    setHashing(true);
    let hash: string;
    try {
      hash = await sha256Hex(file);
    } catch {
      setError("计算 SHA-256 失败");
      return false;
    } finally {
      setHashing(false);
    }

    setUploading(true);
    try {
      const signed = await createMyResourceUploadUrl(resource.id, { fileName: file.name, size: file.size, sha256: hash });
      const supabase = createSupabaseBrowserClient();
      const { error: uploadError } = await supabase.storage.from(signed.bucket).uploadToSignedUrl(signed.key, signed.token, file);
      if (uploadError) throw new Error(uploadError.message);
      setInfo("上传完成（可继续编辑并提交审核）");
      const refreshed = await fetchMyResourceDetail(resource.id);
      applyDetail(refreshed);
      return true;
    } catch (err) {
      setError(getApiErrorMessage(err, "上传失败"));
      return false;
    } finally {
      setUploading(false);
    }
  }

  return {
    majors,
    courses,
    resource,
    loading,
    creating,
    saving,
    submitting,
    unpublishing,
    uploading,
    hashing,
    deleting,
    error,
    info,
    dirty,
    editable,
    canCreate,
    canSave,
    canSubmit,
    majorId,
    setMajorId,
    courseId,
    setCourseId,
    resourceType,
    setResourceType,
    title,
    setTitle,
    description,
    setDescription,
    linkUrl,
    setLinkUrl,
    createDraft,
    save,
    submit,
    unpublish,
    uploadFile,
    deleteResource,
  };
}
