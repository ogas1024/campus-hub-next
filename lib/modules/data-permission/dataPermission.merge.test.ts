import { describe, expect, it, vi } from "vitest";

import { mergeConfiguredDataScope } from "./dataPermission.merge";

describe("mergeConfiguredDataScope", () => {
  it("scopeTypes 包含 all 时直接返回 ALL", async () => {
    const expandToDescendants = vi.fn(async () => ["x"]);

    const res = await mergeConfiguredDataScope({
      scopeTypes: ["all", "self"],
      customDepartmentIds: ["a"],
      userDepartmentIds: ["b"],
      expandToDescendants,
    });

    expect(res).toEqual({ scopeType: "ALL" });
    expect(expandToDescendants).not.toHaveBeenCalled();
  });

  it("custom 优先于 dept_and_child", async () => {
    const res = await mergeConfiguredDataScope({
      scopeTypes: ["dept_and_child", "custom"],
      customDepartmentIds: ["a"],
      userDepartmentIds: ["b"],
      expandToDescendants: async (ids) => ids,
    });

    expect(res).toEqual({ scopeType: "CUSTOM", departmentIds: ["a"] });
  });

  it("dept_and_child 会扩展到子部门", async () => {
    const res = await mergeConfiguredDataScope({
      scopeTypes: ["dept_and_child"],
      customDepartmentIds: [],
      userDepartmentIds: ["a"],
      expandToDescendants: async () => ["a", "a1", "a2"],
    });

    expect(res).toEqual({ scopeType: "DEPT_AND_CHILD", departmentIds: ["a", "a1", "a2"] });
  });

  it("dept 不做子部门扩展", async () => {
    const res = await mergeConfiguredDataScope({
      scopeTypes: ["dept"],
      customDepartmentIds: [],
      userDepartmentIds: ["a"],
      expandToDescendants: async () => ["a", "a1"],
    });

    expect(res).toEqual({ scopeType: "DEPT", departmentIds: ["a"] });
  });

  it("无匹配时返回 NONE", async () => {
    const res = await mergeConfiguredDataScope({
      scopeTypes: ["none"],
      customDepartmentIds: [],
      userDepartmentIds: [],
      expandToDescendants: async () => [],
    });

    expect(res).toEqual({ scopeType: "NONE" });
  });
});

