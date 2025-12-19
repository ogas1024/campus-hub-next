/**
 * 将楼层编号格式化为展示用字符串。
 *
 * 约定：
 * - 负数：地下（B1/B2...）
 * - 0/正数：地上（F0/F1...）
 */
export function formatFacilityFloorLabel(floorNo: number) {
  if (floorNo < 0) return `B${Math.abs(floorNo)}`;
  return `F${floorNo}`;
}

/**
 * Portal 时间轴常用窗口（天）。
 *
 * 说明：后续如需调整常用值，仅修改此处即可。
 */
export const FACILITY_TIMELINE_WINDOW_DAYS = [5, 7, 30] as const;
export const DEFAULT_FACILITY_TIMELINE_DAYS: (typeof FACILITY_TIMELINE_WINDOW_DAYS)[number] = 7;

/**
 * Portal 时间轴刻度（小时）。
 *
 * 说明：后续如需调整常用值，仅修改此处即可。
 */
export const FACILITY_TIMELINE_TICK_HOURS = [1, 2, 4, 6] as const;
export const DEFAULT_FACILITY_TIMELINE_TICK_HOURS: (typeof FACILITY_TIMELINE_TICK_HOURS)[number] = 2;
