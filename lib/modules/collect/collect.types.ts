export type CollectTaskStatus = "draft" | "published" | "closed";
export type CollectSubmissionStatus = "pending" | "complete" | "need_more" | "approved" | "rejected";

export type CollectScopeType = "role" | "department" | "position";
export type CollectScopeInput = { scopeType: CollectScopeType; refId: string };

export type CollectItemKind = "file";

export type CollectSourceType = "notice";
export type CollectSource = { type: CollectSourceType; id: string };

export type CollectModuleConfig = {
  module: string;
  templateBucket: string;
  submissionBucket: string;
};

