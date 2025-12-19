export type PortalModuleStatus = "available" | "comingSoon";

export type PortalModule = {
  id: string;
  label: string;
  description: string;
  href: string;
  status: PortalModuleStatus;
};

export const portalModules = [
  {
    id: "notices",
    label: "通知公告",
    description: "查看校园通知、下载附件、自动记录已读。",
    href: "/notices",
    status: "available",
  },
  {
    id: "resources",
    label: "课程资源",
    description: "课程资料分享与检索。",
    href: "/resources",
    status: "available",
  },
  {
    id: "facilities",
    label: "功能房预约",
    description: "在线预约与管理功能房。",
    href: "/facilities",
    status: "available",
  },
  {
    id: "surveys",
    label: "问卷",
    description: "问卷收集、统计、导出与 AI 总结。",
    href: "/surveys",
    status: "available",
  },
  {
    id: "votes",
    label: "投票",
    description: "投票/评选活动（建设中）。",
    href: "/votes",
    status: "comingSoon",
  },
  {
    id: "library",
    label: "数字图书馆",
    description: "电子书与资料库（建设中）。",
    href: "/library",
    status: "comingSoon",
  },
  {
    id: "lost-found",
    label: "失物招领",
    description: "发布失物/拾物、认领处理（建设中）。",
    href: "/lost-found",
    status: "comingSoon",
  },
] as const satisfies PortalModule[];

export type PortalModuleId = (typeof portalModules)[number]["id"];

export const portalNavItems: Array<Pick<PortalModule, "id" | "label" | "href" | "status">> = [
  { id: "home", label: "首页", href: "/", status: "available" },
  ...portalModules.map(({ id, label, href, status }) => ({ id, label, href, status })),
];

export type ConsoleModule = {
  id: string;
  label: string;
  href: string;
  permCodes: string[];
};

export type ConsoleNavGroup = {
  id: string;
  label: string;
  items: ConsoleModule[];
};

export const courseResourcesConsoleEntryPermCodes = [
  "campus:resource:review",
  "campus:resource:list",
  "campus:resource:read",
  "campus:resource:major_list",
  "campus:resource:course_list",
  "campus:resource:major_lead_update",
] as const;

export const consoleNavGroups: ConsoleNavGroup[] = [
  {
    id: "life",
    label: "生活平台",
    items: [
      { id: "notices", label: "通知公告", href: "/console/notices", permCodes: ["campus:notice:list"] },
      {
        id: "facilities",
        label: "功能房预约",
        href: "/console/facilities",
        permCodes: ["campus:facility:*", "campus:facility:review", "campus:facility:config", "campus:facility:ban"],
      },
      {
        id: "resources",
        label: "课程资源分享",
        href: "/console/resources",
        permCodes: [...courseResourcesConsoleEntryPermCodes],
      },
      {
        id: "surveys",
        label: "问卷",
        href: "/console/surveys",
        permCodes: ["campus:survey:*", "campus:survey:list", "campus:survey:read", "campus:survey:create", "campus:survey:update"],
      },
    ],
  },
  {
    id: "infra",
    label: "基础设施",
    items: [
      { id: "users", label: "用户", href: "/console/users", permCodes: ["campus:user:list"] },
      { id: "roles", label: "角色", href: "/console/roles", permCodes: ["campus:role:*"] },
      { id: "departments", label: "部门", href: "/console/departments", permCodes: ["campus:department:*"] },
      { id: "positions", label: "岗位", href: "/console/positions", permCodes: ["campus:position:*"] },
      { id: "permissions", label: "权限字典", href: "/console/permissions", permCodes: ["campus:permission:*"] },
      { id: "audit", label: "审计", href: "/console/audit", permCodes: ["campus:audit:list"] },
      { id: "config", label: "配置", href: "/console/config", permCodes: ["campus:config:update"] },
    ],
  },
] satisfies ConsoleNavGroup[];

export const consoleModules: ConsoleModule[] = consoleNavGroups.flatMap((g) => g.items);
export const consoleEntryPermCodes = [...new Set(consoleModules.flatMap((m) => m.permCodes))];
