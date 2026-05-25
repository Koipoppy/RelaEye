/**
 * 物理常量 —— 自然单位制 (c = 1)
 *
 * 距离单位：光秒（光在真空中1秒行进的距离）
 * 速度单位：光速 c 的倍数 β = v/c ∈ [0, 1)
 * 时间单位：秒
 */

export const C = 1.0;                     // 光速（自然单位制）

export const MIN_BETA = 0.0;              // 最小速度系数
export const MAX_BETA = 0.9999;           // 最大速度系数（γ ≈ 70.7）
export const DEFAULT_BETA = 0.0;          // 默认静止
export const DEFAULT_MAX_BETA = 0.9;      // 默认最大速度

export const ACCELERATION = 0.3;          // 加速度（每秒钟 β 增量）
export const DECELERATION = 0.5;          // 自然减速（每秒钟 β 减量）

// 鼠标灵敏度
export const MOUSE_SENSITIVITY = 0.002;