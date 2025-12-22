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
    id: "materials",
    label: "材料收集",
    description: "在线提交申请材料，支持模板下载与撤回。",
    href: "/materials",
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
    description: "多题单选/多选投票，支持置顶、延期与归档。",
    href: "/votes",
    status: "available",
  },
  {
    id: "library",
    label: "数字图书馆",
    description: "电子书/资料的检索、收藏与下载。",
    href: "/library",
    status: "available",
  },
  {
    id: "lostfound",
    label: "失物招领",
    description: "发布失物/拾物信息、审核与状态流转。",
    href: "/lostfound",
    status: "available",
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

export const noticesConsoleEntryPermCodes = ["campus:notice:list"] as const;

export const materialsConsoleEntryPermCodes = [
  "campus:material:*",
  "campus:material:manage",
  "campus:material:list",
  "campus:material:read",
  "campus:material:create",
  "campus:material:update",
  "campus:material:process",
] as const;

export const facilitiesConsoleEntryPermCodes = [
  "campus:facility:*",
  "campus:facility:review",
  "campus:facility:config",
  "campus:facility:ban",
] as const;

export const libraryConsoleEntryPermCodes = [
  "campus:library:*",
  "campus:library:list",
  "campus:library:read",
  "campus:library:review",
  "campus:library:offline",
  "campus:library:delete",
] as const;

export const surveysConsoleEntryPermCodes = [
  "campus:survey:*",
  "campus:survey:list",
  "campus:survey:read",
  "campus:survey:create",
  "campus:survey:update",
] as const;

export const votesConsoleEntryPermCodes = [
  "campus:vote:*",
  "campus:vote:list",
  "campus:vote:read",
  "campus:vote:create",
  "campus:vote:update",
] as const;

export const lostfoundConsoleEntryPermCodes = [
  "campus:lostfound:*",
  "campus:lostfound:list",
  "campus:lostfound:review",
  "campus:lostfound:offline",
  "campus:lostfound:restore",
  "campus:lostfound:delete",
] as const;

export const consoleNavGroups: ConsoleNavGroup[] = [
  {
    id: "life",
    label: "生活平台",
    items: [
      { id: "notices", label: "通知公告", href: "/console/notices", permCodes: [...noticesConsoleEntryPermCodes] },
      {
        id: "materials",
        label: "材料收集",
        href: "/console/materials",
        permCodes: [...materialsConsoleEntryPermCodes],
      },
      {
        id: "facilities",
        label: "功能房预约",
        href: "/console/facilities",
        permCodes: [...facilitiesConsoleEntryPermCodes],
      },
      {
        id: "resources",
        label: "课程资源分享",
        href: "/console/resources",
        permCodes: [...courseResourcesConsoleEntryPermCodes],
      },
      {
        id: "library",
        label: "数字图书馆",
        href: "/console/library",
        permCodes: [...libraryConsoleEntryPermCodes],
      },
      {
        id: "surveys",
        label: "问卷",
        href: "/console/surveys",
        permCodes: [...surveysConsoleEntryPermCodes],
      },
      {
        id: "votes",
        label: "投票",
        href: "/console/votes",
        permCodes: [...votesConsoleEntryPermCodes],
      },
      {
        id: "lostfound",
        label: "失物招领",
        href: "/console/lostfound",
        permCodes: [...lostfoundConsoleEntryPermCodes],
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
