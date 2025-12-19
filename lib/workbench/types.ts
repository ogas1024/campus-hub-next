export type WorkbenchActionVariant = "default" | "outline";

export type WorkbenchContext = {
  actorUserId: string;
  now: Date;
  canPerm: (permCode: string) => Promise<boolean>;
  canAnyPerm: (permCodes: readonly string[]) => Promise<boolean>;
};

export type WorkbenchCardMetric = {
  id: string;
  label: string;
  value: number;
};

export type WorkbenchDialogItem = {
  id: string;
  title: string;
  meta?: string;
  href?: string;
};

export type WorkbenchDialog = {
  title: string;
  description?: string;
  items: WorkbenchDialogItem[];
  emptyText?: string;
};

export type WorkbenchCardAction =
  | {
      kind: "link";
      id: string;
      label: string;
      href: string;
      variant?: WorkbenchActionVariant;
    }
  | {
      kind: "dialog";
      id: string;
      label: string;
      variant?: WorkbenchActionVariant;
      dialog: WorkbenchDialog;
    };

export type WorkbenchCard = {
  id: string;
  title: string;
  description?: string;
  metrics: WorkbenchCardMetric[];
  actions: WorkbenchCardAction[];
  order?: number;
};

export type WorkbenchQuickLink = {
  id: string;
  label: string;
  href: string;
  variant?: WorkbenchActionVariant;
  order?: number;
};

export type WorkbenchProvider = {
  id: string;
  order?: number;
  getCards?: (ctx: WorkbenchContext) => Promise<WorkbenchCard[]>;
  getQuickLinks?: (ctx: WorkbenchContext) => Promise<WorkbenchQuickLink[]>;
};
