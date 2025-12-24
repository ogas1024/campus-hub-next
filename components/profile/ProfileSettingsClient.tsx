"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { getApiErrorMessage } from "@/lib/api/http";
import { deleteMyAvatar, patchMyProfile, uploadMyAvatar, type MyProfileResponse } from "@/lib/api/me";
import { withDialogHref } from "@/lib/navigation/dialog";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { InlineMessage } from "@/components/common/InlineMessage";
import { StickyFormDialog } from "@/components/common/StickyFormDialog";
import { UnsavedChangesAlertDialog } from "@/components/common/UnsavedChangesAlertDialog";
import {
  AlertDialog,
  AlertDialogActionButton,
  AlertDialogCancelButton,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";

type Props = {
  initialProfile: MyProfileResponse;
};

function buildHref(pathname: string, nextSearchParams: URLSearchParams) {
  const qs = nextSearchParams.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function ProfileSettingsClient({ initialProfile }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();

  const [profile, setProfile] = useState<MyProfileResponse>(initialProfile);
  useEffect(() => {
    setProfile(initialProfile);
  }, [initialProfile]);

  const dialog = searchParams.get("dialog") ?? "";
  const editOpen = dialog === "profile-edit";
  const passwordOpen = dialog === "password-change";

  function closeDialog() {
    const next = new URLSearchParams(searchParamsString);
    next.delete("dialog");
    next.delete("id");
    router.replace(buildHref(pathname, next), { scroll: false });
  }

  const baseHref = useMemo(() => {
    const next = new URLSearchParams(searchParamsString);
    next.delete("dialog");
    next.delete("id");
    return buildHref(pathname, next);
  }, [pathname, searchParamsString]);

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
          <div className="space-y-1.5">
            <CardTitle>基本资料</CardTitle>
            <CardDescription>头像与姓名/用户名在弹窗中编辑（支持复制 URL）。</CardDescription>
          </div>
          <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={withDialogHref(baseHref, { dialog: "profile-edit" })} scroll={false}>
            编辑资料
          </Link>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 p-3">
            <div className="flex min-w-0 items-center gap-3">
              {profile.avatarUrl ? (
                <Image alt="头像" src={profile.avatarUrl} width={48} height={48} className="h-12 w-12 rounded-full border border-border object-cover" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-background text-sm font-semibold">
                  {(profile.name.trim()[0] ?? "?").toUpperCase()}
                </div>
              )}

              <div className="min-w-0">
                <div className="text-sm font-medium">{profile.name}</div>
                <div className="truncate text-xs text-muted-foreground">{profile.email ?? profile.id}</div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">在“编辑资料”中更新头像与用户名。</div>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>邮箱（只读）</Label>
              <Input value={profile.email ?? "-"} disabled />
            </div>
            <div className="grid gap-1.5">
              <Label>学号（只读）</Label>
              <Input value={profile.studentId} disabled />
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>姓名</Label>
              <Input value={profile.name} disabled />
            </div>
            <div className="grid gap-1.5">
              <Label>用户名（可选）</Label>
              <Input value={profile.username ?? ""} placeholder="未设置" disabled />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
          <div className="space-y-1.5">
            <CardTitle>账号安全</CardTitle>
            <CardDescription>修改密码会先校验当前密码；找回密码使用 Supabase Auth 邮件流程。</CardDescription>
          </div>
          <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={withDialogHref(baseHref, { dialog: "password-change" })} scroll={false}>
            修改密码
          </Link>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            忘记密码？{" "}
            <Link className="font-medium underline underline-offset-2" href="/forgot-password">
              通过邮箱找回
            </Link>
          </div>
        </CardContent>
      </Card>

      <ProfileEditDialog
        open={editOpen}
        profile={profile}
        onProfileUpdated={(next) => setProfile(next)}
        onRequestClose={closeDialog}
      />
      <PasswordChangeDialog open={passwordOpen} profile={profile} onRequestClose={closeDialog} />
    </div>
  );
}

function validateAvatar(file: File) {
  if (file.size <= 0) return "头像文件为空";
  if (file.size > 2 * 1024 * 1024) return "头像文件过大（最大 2MB）";
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return "头像仅支持 PNG/JPEG/WEBP";
  return null;
}

function ProfileEditDialog(props: {
  open: boolean;
  profile: MyProfileResponse;
  onProfileUpdated: (profile: MyProfileResponse) => void;
  onRequestClose: () => void;
}) {
  const router = useRouter();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [saving, setSaving] = useState(false);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarRemoving, setAvatarRemoving] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [unsavedAlertOpen, setUnsavedAlertOpen] = useState(false);

  const pending = saving || avatarUploading || avatarRemoving;

  useEffect(() => {
    if (!props.open) return;
    setName(props.profile.name);
    setUsername(props.profile.username ?? "");
    setAvatarFile(null);
    if (avatarInputRef.current) avatarInputRef.current.value = "";
    setError(null);
    setMessage(null);
  }, [props.open, props.profile.name, props.profile.username]);

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(avatarFile);
    setAvatarPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  const normalizedName = useMemo(() => name.trim(), [name]);
  const normalizedUsername = useMemo(() => (username.trim() ? username.trim() : null), [username]);

  const profileDirty = normalizedName !== props.profile.name || normalizedUsername !== props.profile.username;
  const dirty = profileDirty || !!avatarFile;

  function requestClose() {
    if (pending) return;
    if (dirty) {
      setUnsavedAlertOpen(true);
      return;
    }
    props.onRequestClose();
  }

  async function saveProfile() {
    setError(null);
    setMessage(null);

    if (!profileDirty) return;
    if (!normalizedName) {
      setError("姓名不能为空。");
      return;
    }

    const patch: Parameters<typeof patchMyProfile>[0] = {};
    if (normalizedName !== props.profile.name) patch.name = normalizedName;
    if (normalizedUsername !== props.profile.username) patch.username = normalizedUsername;

    setSaving(true);
    try {
      const updated = await patchMyProfile(patch);
      props.onProfileUpdated(updated);
      toast.success("资料已保存", { description: normalizedName });
      router.refresh();
      props.onRequestClose();
    } catch (err) {
      setError(getApiErrorMessage(err, "保存失败"));
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar() {
    setError(null);
    setMessage(null);
    if (!avatarFile) return;

    const err = validateAvatar(avatarFile);
    if (err) {
      setError(err);
      setAvatarFile(null);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
      return;
    }

    setAvatarUploading(true);
    try {
      const updated = await uploadMyAvatar(avatarFile);
      props.onProfileUpdated(updated);
      setAvatarFile(null);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
      setMessage("头像已更新。");
      toast.success("头像已更新", { description: avatarFile.name });
      router.refresh();
    } catch (err) {
      setError(getApiErrorMessage(err, "头像上传失败"));
    } finally {
      setAvatarUploading(false);
    }
  }

  async function removeAvatar() {
    setError(null);
    setMessage(null);

    setAvatarRemoving(true);
    try {
      const updated = await deleteMyAvatar();
      props.onProfileUpdated(updated);
      setAvatarFile(null);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
      setMessage("头像已移除。");
      toast.success("头像已移除");
      router.refresh();
    } catch (err) {
      setError(getApiErrorMessage(err, "移除头像失败"));
    } finally {
      setAvatarRemoving(false);
    }
  }

  const footer = (
    <div className="flex w-full flex-wrap items-center gap-2">
      <Button variant="outline" disabled={pending} onClick={() => requestClose()}>
        取消
      </Button>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Button disabled={pending || !profileDirty || !normalizedName} onClick={() => void saveProfile()}>
          {saving ? "保存中..." : "保存"}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <StickyFormDialog
        open={props.open}
        onOpenChange={(open) => {
          if (open) return;
          requestClose();
        }}
        title="编辑资料"
        description="头像支持 PNG/JPEG/WEBP，≤ 2MB；用户名可选。"
        error={error}
        footer={footer}
        contentClassName="max-w-2xl"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 p-3">
          <div className="flex min-w-0 items-center gap-3">
            {avatarPreviewUrl ? (
              <Image alt="头像预览" src={avatarPreviewUrl} width={48} height={48} className="h-12 w-12 rounded-full border border-border object-cover" unoptimized />
            ) : props.profile.avatarUrl ? (
              <Image alt="头像" src={props.profile.avatarUrl} width={48} height={48} className="h-12 w-12 rounded-full border border-border object-cover" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-background text-sm font-semibold">
                {(props.profile.name.trim()[0] ?? "?").toUpperCase()}
              </div>
            )}

            <div className="min-w-0">
              <div className="text-sm font-medium">头像</div>
              <div className="text-xs text-muted-foreground">PNG/JPEG/WEBP，≤ 2MB</div>
              {avatarFile ? (
                <div className="mt-1 truncate text-xs text-muted-foreground" title={avatarFile.name}>
                  已选择：{avatarFile.name}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                setError(null);
                setMessage(null);
                const next = e.target.files?.[0] ?? null;
                if (!next) {
                  setAvatarFile(null);
                  return;
                }

                const err = validateAvatar(next);
                if (err) {
                  setAvatarFile(null);
                  e.target.value = "";
                  setError(err);
                  return;
                }

                setAvatarFile(next);
              }}
            />

            <Button variant="outline" size="sm" disabled={pending} onClick={() => avatarInputRef.current?.click()}>
              选择图片
            </Button>
            <Button size="sm" disabled={pending || !avatarFile} onClick={() => void uploadAvatar()}>
              {avatarUploading ? "上传中..." : "上传"}
            </Button>

            {props.profile.avatarUrl ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={pending}>
                    移除头像
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>确认移除头像？</AlertDialogTitle>
                    <AlertDialogDescription>将清空头像并删除存储中的头像文件。</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancelButton disabled={pending}>取消</AlertDialogCancelButton>
                    <AlertDialogActionButton disabled={pending} onClick={() => void removeAvatar()}>
                      {avatarRemoving ? "移除中..." : "确认移除"}
                    </AlertDialogActionButton>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}
          </div>
        </div>

        <InlineMessage message={message} />

        <div className="grid gap-2 md:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>邮箱（只读）</Label>
            <Input value={props.profile.email ?? "-"} disabled />
          </div>
          <div className="grid gap-1.5">
            <Label>学号（只读）</Label>
            <Input value={props.profile.studentId} disabled />
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>姓名</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required disabled={pending} />
          </div>
          <div className="grid gap-1.5">
            <Label>用户名（可选）</Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="例如：zhangsan" disabled={pending} />
          </div>
        </div>
      </StickyFormDialog>

      <UnsavedChangesAlertDialog
        open={unsavedAlertOpen}
        onOpenChange={setUnsavedAlertOpen}
        onDiscard={() => {
          setUnsavedAlertOpen(false);
          props.onRequestClose();
        }}
      />
    </>
  );
}

function PasswordChangeDialog(props: { open: boolean; profile: MyProfileResponse; onRequestClose: () => void }) {
  const router = useRouter();
  const formId = "profile-password-change-form";

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unsavedAlertOpen, setUnsavedAlertOpen] = useState(false);

  const dirty = !!currentPassword.trim() || !!newPassword || !!newPasswordConfirm;

  useEffect(() => {
    if (!props.open) return;
    setCurrentPassword("");
    setNewPassword("");
    setNewPasswordConfirm("");
    setError(null);
  }, [props.open]);

  function requestClose() {
    if (changingPassword) return;
    if (dirty) {
      setUnsavedAlertOpen(true);
      return;
    }
    props.onRequestClose();
  }

  async function submit() {
    setError(null);

    if (!currentPassword.trim()) {
      setError("请输入当前密码。");
      return;
    }
    if (newPassword.length < 8) {
      setError("新密码至少 8 位。");
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setError("两次输入的新密码不一致。");
      return;
    }

    setChangingPassword(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const email = userData.user?.email;
      if (!email) {
        setError("当前会话无邮箱信息，请重新登录后再试。");
        return;
      }

      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (verifyError) {
        setError("当前密码不正确。");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;

      toast.success("密码已修改，请重新登录");
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    } catch (err) {
      setError(getApiErrorMessage(err, "修改密码失败"));
    } finally {
      setChangingPassword(false);
    }
  }

  const footer = (
    <div className="flex w-full flex-wrap items-center gap-2">
      <Button variant="outline" disabled={changingPassword} onClick={() => requestClose()}>
        取消
      </Button>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Button type="submit" form={formId} disabled={changingPassword}>
          {changingPassword ? "修改中..." : "确认修改"}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <StickyFormDialog
        open={props.open}
        onOpenChange={(open) => {
          if (open) return;
          requestClose();
        }}
        title="修改密码"
        description={`将修改当前账号密码并退出登录（${props.profile.email ?? props.profile.id}）。`}
        error={error}
        footer={footer}
        contentClassName="max-w-xl"
      >
        <form
          id={formId}
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="grid gap-1.5">
            <Label>当前密码</Label>
            <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" required />
          </div>
          <div className="grid gap-1.5">
            <Label>新密码</Label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" required />
          </div>
          <div className="grid gap-1.5">
            <Label>确认新密码</Label>
            <Input type="password" value={newPasswordConfirm} onChange={(e) => setNewPasswordConfirm(e.target.value)} autoComplete="new-password" required />
          </div>
        </form>
      </StickyFormDialog>

      <UnsavedChangesAlertDialog
        open={unsavedAlertOpen}
        onOpenChange={setUnsavedAlertOpen}
        onDiscard={() => {
          setUnsavedAlertOpen(false);
          props.onRequestClose();
        }}
      />
    </>
  );
}
