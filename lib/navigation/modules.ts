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
    description: "在线预约与管理功能房（建设中）。",
    href: "/facilities",
    status: "comingSoon",
  },
  {
    id: "surveys",
    label: "问卷",
    description: "面向全校的问卷收集（建设中）。",
    href: "/surveys",
    status: "comingSoon",
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
  permCode: string;
};

export type ConsoleNavGroup = {
  id: string;
  label: string;
  items: ConsoleModule[];
};

export const consoleNavGroups: ConsoleNavGroup[] = [
  {
    id: "infra",
    label: "基础设施",
    items: [
      { id: "users", label: "用户", href: "/console/users", permCode: "campus:user:list" },
      { id: "roles", label: "角色", href: "/console/roles", permCode: "campus:role:*" },
      { id: "departments", label: "部门", href: "/console/departments", permCode: "campus:department:*" },
      { id: "positions", label: "岗位", href: "/console/positions", permCode: "campus:position:*" },
      { id: "permissions", label: "权限字典", href: "/console/permissions", permCode: "campus:permission:*" },
      { id: "audit", label: "审计", href: "/console/audit", permCode: "campus:audit:list" },
      { id: "config", label: "配置", href: "/console/config", permCode: "campus:config:update" },
    ],
  },
  {
    id: "course-resources",
    label: "课程资源分享",
    items: [
      { id: "cr-pending", label: "待审核", href: "/console/resources/pending", permCode: "campus:resource:review" },
      { id: "cr-published", label: "已发布", href: "/console/resources/published", permCode: "campus:resource:list" },
      { id: "cr-rejected", label: "已驳回", href: "/console/resources/rejected", permCode: "campus:resource:list" },
      { id: "cr-unpublished", label: "已下架", href: "/console/resources/unpublished", permCode: "campus:resource:list" },
      { id: "cr-leads", label: "专业负责人", href: "/console/resources/leads", permCode: "campus:resource:major_lead_update" },
      { id: "cr-majors", label: "专业管理", href: "/console/resources/majors", permCode: "campus:resource:major_list" },
      { id: "cr-courses", label: "课程管理", href: "/console/resources/courses", permCode: "campus:resource:course_list" },
    ],
  },
  {
    id: "business",
    label: "业务模块",
    items: [{ id: "notices", label: "公告管理", href: "/console/notices", permCode: "campus:notice:list" }],
  },
] satisfies ConsoleNavGroup[];

export const consoleModules: ConsoleModule[] = consoleNavGroups.flatMap((g) => g.items);
export const consoleEntryPermCodes = consoleModules.map((m) => m.permCode);
