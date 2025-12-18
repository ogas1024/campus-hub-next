"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { getApiErrorMessage } from "@/lib/api/http";
import { deleteMyAvatar, patchMyProfile, uploadMyAvatar, type MyProfileResponse } from "@/lib/api/me";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  initialProfile: MyProfileResponse;
};

export function ProfileSettingsClient({ initialProfile }: Props) {
  const router = useRouter();

  const [profile, setProfile] = useState<MyProfileResponse>(initialProfile);
  const [name, setName] = useState(profile.name);
  const [username, setUsername] = useState(profile.username ?? "");
  const [profileEditing, setProfileEditing] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarRemoving, setAvatarRemoving] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarMessage, setAvatarMessage] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);

  const normalized = useMemo(() => {
    const normalizedName = name.trim();
    const normalizedUsername = username.trim() ? username.trim() : null;
    return { normalizedName, normalizedUsername };
  }, [name, username]);

  const profileDirty = normalized.normalizedName !== profile.name || normalized.normalizedUsername !== profile.username;

  function validateAvatar(file: File) {
    if (file.size <= 0) return "头像文件为空";
    if (file.size > 2 * 1024 * 1024) return "头像文件过大（最大 2MB）";
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return "头像仅支持 PNG/JPEG/WEBP";
    return null;
  }

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(avatarFile);
    setAvatarPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [avatarFile]);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);

  function resetProfileDraft() {
    setName(profile.name);
    setUsername(profile.username ?? "");
  }

  function resetPasswordDraft() {
    setCurrentPassword("");
    setNewPassword("");
    setNewPasswordConfirm("");
    setPasswordError(null);
    setPasswordMessage(null);
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>基本资料</CardTitle>
          <CardDescription>点击“编辑”后修改姓名/用户名；邮箱与学号为只读字段；头像可独立上传/移除。</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setProfileError(null);
              setProfileMessage(null);

              if (!profileEditing) return;

              if (!profileDirty) {
                setProfileMessage("没有需要保存的变更。");
                return;
              }

              if (!normalized.normalizedName) {
                setProfileError("姓名不能为空。");
                return;
              }

              const patch: Parameters<typeof patchMyProfile>[0] = {};
              if (normalized.normalizedName !== profile.name) patch.name = normalized.normalizedName;
              if (normalized.normalizedUsername !== profile.username) patch.username = normalized.normalizedUsername;

              setSaving(true);
              try {
                const updated = await patchMyProfile(patch);
                setProfile(updated);
                setName(updated.name);
                setUsername(updated.username ?? "");
                setProfileEditing(false);
                setProfileMessage("已保存。");
                router.refresh();
              } catch (err) {
                setProfileError(getApiErrorMessage(err, "保存失败"));
              } finally {
                setSaving(false);
              }
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 p-3">
              <div className="flex min-w-0 items-center gap-3">
                {avatarPreviewUrl ? (
                  <Image
                    alt="头像预览"
                    src={avatarPreviewUrl}
                    width={48}
                    height={48}
                    className="h-12 w-12 rounded-full border border-border object-cover"
                    unoptimized
                  />
                ) : profile.avatarUrl ? (
                  <Image
                    alt="头像"
                    src={profile.avatarUrl}
                    width={48}
                    height={48}
                    className="h-12 w-12 rounded-full border border-border object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-background text-sm font-semibold">
                    {(profile.name.trim()[0] ?? "?").toUpperCase()}
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
                    setAvatarError(null);
                    setAvatarMessage(null);
                    const next = e.target.files?.[0] ?? null;
                    if (!next) {
                      setAvatarFile(null);
                      return;
                    }

                    const err = validateAvatar(next);
                    if (err) {
                      setAvatarFile(null);
                      e.target.value = "";
                      setAvatarError(err);
                      return;
                    }

                    setAvatarFile(next);
                  }}
                />

                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  disabled={avatarUploading || avatarRemoving}
                  onClick={() => avatarInputRef.current?.click()}
                >
                  选择图片
                </Button>

                <Button
                  size="sm"
                  type="button"
                  disabled={!avatarFile || avatarUploading || avatarRemoving}
                  onClick={async () => {
                    setAvatarError(null);
                    setAvatarMessage(null);
                    if (!avatarFile) return;

                    const err = validateAvatar(avatarFile);
                    if (err) {
                      setAvatarError(err);
                      setAvatarFile(null);
                      if (avatarInputRef.current) avatarInputRef.current.value = "";
                      return;
                    }

                    setAvatarUploading(true);
                    try {
                      const updated = await uploadMyAvatar(avatarFile);
                      setProfile(updated);
                      setAvatarFile(null);
                      if (avatarInputRef.current) avatarInputRef.current.value = "";
                      setAvatarMessage("头像已更新。");
                      router.refresh();
                    } catch (err) {
                      setAvatarError(getApiErrorMessage(err, "头像上传失败"));
                    } finally {
                      setAvatarUploading(false);
                    }
                  }}
                >
                  {avatarUploading ? "上传中..." : "上传"}
                </Button>

                {profile.avatarUrl ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" type="button" disabled={avatarUploading || avatarRemoving}>
                        移除头像
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>确认移除头像？</AlertDialogTitle>
                        <AlertDialogDescription>将清空头像并删除存储中的头像文件。</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancelButton disabled={avatarRemoving}>取消</AlertDialogCancelButton>
                        <AlertDialogActionButton
                          disabled={avatarRemoving}
                          onClick={async () => {
                            setAvatarError(null);
                            setAvatarMessage(null);
                            setAvatarRemoving(true);
                            try {
                              const updated = await deleteMyAvatar();
                              setProfile(updated);
                              setAvatarFile(null);
                              if (avatarInputRef.current) avatarInputRef.current.value = "";
                              setAvatarMessage("头像已移除。");
                              router.refresh();
                            } catch (err) {
                              setAvatarError(getApiErrorMessage(err, "移除头像失败"));
                            } finally {
                              setAvatarRemoving(false);
                            }
                          }}
                        >
                          {avatarRemoving ? "移除中..." : "确认移除"}
                        </AlertDialogActionButton>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : null}
              </div>
            </div>

            {avatarError ? (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {avatarError}
              </div>
            ) : null}
            {avatarMessage ? <div className="rounded-lg border border-border bg-muted p-3 text-sm">{avatarMessage}</div> : null}

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
                <Input value={name} onChange={(e) => setName(e.target.value)} required disabled={!profileEditing} />
              </div>
              <div className="grid gap-1.5">
                <Label>用户名（可选）</Label>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="例如：zhangsan"
                  disabled={!profileEditing}
                />
              </div>
            </div>

            {profileError ? (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {profileError}
              </div>
            ) : null}
            {profileMessage ? <div className="rounded-lg border border-border bg-muted p-3 text-sm">{profileMessage}</div> : null}

            <div className="flex items-center justify-end gap-2">
              {profileEditing ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={saving}
                    onClick={() => {
                      setProfileError(null);
                      setProfileMessage(null);
                      resetProfileDraft();
                      setProfileEditing(false);
                    }}
                  >
                    取消
                  </Button>
                  <Button type="submit" disabled={saving || !profileDirty}>
                    {saving ? "保存中..." : "保存"}
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setProfileError(null);
                    setProfileMessage(null);
                    resetProfileDraft();
                    setProfileEditing(true);
                  }}
                >
                  编辑
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>账号安全</CardTitle>
          <CardDescription>修改密码会先校验当前密码；找回密码使用 Supabase Auth 邮件流程。</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-muted-foreground">
              忘记密码？{" "}
              <Link className="font-medium underline underline-offset-2" href="/forgot-password">
                通过邮箱找回
              </Link>
            </div>
            <Dialog
              open={passwordDialogOpen}
              onOpenChange={(open) => {
                setPasswordDialogOpen(open);
                resetPasswordDraft();
              }}
            >
              <DialogTrigger asChild>
                <Button variant="outline" type="button">
                  修改密码
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>修改密码</DialogTitle>
                  <DialogDescription>需要先校验当前密码；修改成功后将退出登录。</DialogDescription>
                </DialogHeader>

                <form
                  className="mt-4 grid gap-4"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setPasswordError(null);
                    setPasswordMessage(null);

                    if (!currentPassword.trim()) {
                      setPasswordError("请输入当前密码。");
                      return;
                    }
                    if (newPassword.length < 8) {
                      setPasswordError("新密码至少 8 位。");
                      return;
                    }
                    if (newPassword !== newPasswordConfirm) {
                      setPasswordError("两次输入的新密码不一致。");
                      return;
                    }

                    setChangingPassword(true);
                    try {
                      const supabase = createSupabaseBrowserClient();
                      const { data: userData, error: userError } = await supabase.auth.getUser();
                      if (userError) throw userError;
                      const email = userData.user?.email;
                      if (!email) {
                        setPasswordError("当前会话无邮箱信息，请重新登录后再试。");
                        return;
                      }

                      const { error: verifyError } = await supabase.auth.signInWithPassword({
                        email,
                        password: currentPassword,
                      });
                      if (verifyError) {
                        setPasswordError("当前密码不正确。");
                        return;
                      }

                      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
                      if (updateError) throw updateError;

                      setPasswordMessage("密码已更新，请重新登录。");
                      await supabase.auth.signOut();
                      router.push("/login");
                      router.refresh();
                    } catch (err) {
                      setPasswordError(getApiErrorMessage(err, "修改密码失败"));
                    } finally {
                      setChangingPassword(false);
                    }
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

                  {passwordError ? (
                    <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                      {passwordError}
                    </div>
                  ) : null}
                  {passwordMessage ? <div className="rounded-lg border border-border bg-muted p-3 text-sm">{passwordMessage}</div> : null}

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={changingPassword}
                      onClick={() => setPasswordDialogOpen(false)}
                    >
                      取消
                    </Button>
                    <Button type="submit" disabled={changingPassword}>
                      {changingPassword ? "修改中..." : "确认修改"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
