/**
 * 四维矢量运算工具
 *
 * 使用自然单位制 (c = 1)
 * 度规符号：(+,-,-,-) 即类时分量在前，类空分量在后
 *
 * 四维矢量形式：
 *   X^μ = (t, x, y, z)    —— 逆变分量（类时 t，类空 xyz）
 *   X_μ = (t, -x, -y, -z) —— 协变分量
 *
 * 四维波矢（光子）：
 *   k^μ = (ω, kx, ky, kz)，其中 |k⃗| = ω
 */

/**
 * 计算洛伦兹因子 γ = 1/√(1-β²)
 * @param {number} beta - 速度大小（以 c 为单位）
 * @returns {number} 洛伦兹因子
 */
export function gamma(beta) {
    if (beta >= 1.0) return Infinity;
    return 1.0 / Math.sqrt(1.0 - beta * beta);
}

/**
 * 从 beta 和方向创建三维速度矢量
 * @param {number} beta - 速度大小
 * @param {number} theta - 极角（与 z 轴的夹角）
 * @param {number} phi - 方位角（在 xy 平面内与 x 轴的夹角）
 * @returns {{x: number, y: number, z: number}} 速度矢量
 */
export function velocityFromSpherical(beta, theta, phi) {
    return {
        x: beta * Math.sin(theta) * Math.cos(phi),
        y: beta * Math.sin(theta) * Math.sin(phi),
        z: beta * Math.cos(theta)
    };
}

/**
 * 单位方向矢量从球坐标
 * @param {number} theta - 极角
 * @param {number} phi - 方位角
 * @returns {{x: number, y: number, z: number}} 单位矢量
 */
export function directionFromSpherical(theta, phi) {
    return {
        x: Math.sin(theta) * Math.cos(phi),
        y: Math.sin(theta) * Math.sin(phi),
        z: Math.cos(theta)
    };
}

/**
 * 方向矢量转球坐标
 * @param {{x: number, y: number, z: number}} dir - 方向矢量
 * @returns {{theta: number, phi: number}}
 */
export function sphericalFromDirection(dir) {
    const r = Math.sqrt(dir.x * dir.x + dir.y * dir.y + dir.z * dir.z);
    return {
        theta: Math.acos(dir.z / r),
        phi: Math.atan2(dir.y, dir.x)
    };
}

/**
 * 矢量点积
 */
export function dot3(a, b) {
    return a.x * b.x + a.y * b.y + a.z * b.z;
}

/**
 * 三维矢量长度
 */
export function norm3(v) {
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

/**
 * 三维矢量归一化（返回新对象）
 */
export function normalize3(v) {
    const n = norm3(v);
    if (n < 1e-15) return { x: 0, y: 0, z: 1 };
    return { x: v.x / n, y: v.y / n, z: v.z / n };
}

/**
 * 四维矢量点积（闵可夫斯基度规 +---）
 * X·Y = t1*t2 - x1*x2 - y1*y2 - z1*z2
 */
export function dot4(a, b) {
    return a.t * b.t - a.x * b.x - a.y * b.y - a.z * b.z;
}

/**
 * 四维矢量模方
 */
export function norm4Sq(v) {
    return dot4(v, v);
}