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

