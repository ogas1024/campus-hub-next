import { redirect } from "next/navigation";

import { PageHeader } from "@/components/common/PageHeader";
import { ProfileSettingsClient } from "@/components/profile/ProfileSettingsClient";
import { getCurrentUser } from "@/lib/auth/session";
import { getMyProfile } from "@/lib/modules/profile/profile.service";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const profile = await getMyProfile(user.id);

  return (
    <div className="space-y-4">
      <PageHeader title="个人资料" description="维护头像与基础信息；账号安全操作在弹窗中完成。" />

      <ProfileSettingsClient
        initialProfile={{
          id: profile.id,
          email: profile.email,
          name: profile.name,
          username: profile.username,
          studentId: profile.studentId,
          avatarUrl: profile.avatarUrl,
          status: profile.status,
          createdAt: profile.createdAt.toISOString(),
          updatedAt: profile.updatedAt.toISOString(),
          lastLoginAt: profile.lastLoginAt ? profile.lastLoginAt.toISOString() : null,
        }}
      />
    </div>
  );
}
