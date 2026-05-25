/**
 * 洛伦兹变换与相对论光学效应
 *
 * 核心公式（自然单位制 c=1）：
 *
 * 1. 光行差（Aberration）—— 静止系 → 观察者系
 *    n̂' = [n̂ + (γ-1)(n̂·β̂)β̂ - γβ⃗] / [γ(1 - β⃗·n̂)]
 *
 * 2. 逆光行差 —— 观察者系 → 静止系（用于渲染采样）
 *    n̂ = [n̂' + (γ-1)(n̂'·β̂)β̂ + γβ⃗] / [γ(1 + β⃗·n̂')]
 *
 * 3. 多普勒因子（静止系 → 观察者系）
 *    D = ω'/ω = γ(1 - β⃗·n̂)
 *
 * 4. 逆多普勒因子（观察者系 → 静止系）
 *    D_inv = ω/ω' = γ(1 + β⃗·n̂')
 *
 * 5. 辐射强度变换（比强度 I_ν/ν³ 为洛伦兹不变量）
 *    I'_ν' = I_ν · D³
 *
 * 6. 立体角变换（前灯效应）
 *    dΩ'/dΩ = D⁻²
 */

import { gamma, dot3, normalize3, norm3 } from './fourVector.js';

/**
 * 逆光行差：将观察者系中的方向 n̂' 转换到静止系方向 n̂
 *
 * 用于渲染：屏幕像素对应的观察方向 n̂'，
 * 需要知道在静止系中对应哪个方向来采样天空纹理。
 *
 * @param {{x:number, y:number, z:number}} nPrime - 观察者系中的单位方向矢量
 * @param {{x:number, y:number, z:number}} betaVec - 观察者速度矢量（β⃗ = v⃗/c）
 * @returns {{
 *   direction: {x:number, y:number, z:number},
 *   dopplerFactor: number,
 *   gamma: number
 * }} 静止系方向、逆多普勒因子 D_inv = ω/ω'、γ
 */
export function inverseAberration(nPrime, betaVec) {
    const beta = norm3(betaVec);
    if (beta < 1e-10) {
        // 静止情况，无变换
        return {
            direction: { ...nPrime },
            dopplerFactor: 1.0,
            gamma: 1.0
        };
    }

    const gam = gamma(beta);
    const betaHat = normalize3(betaVec);

    // n̂'·β̂
    const nDotBeta = dot3(nPrime, betaHat);

    // 分母：γ(1 + β⃗·n̂')
    const denominator = gam * (1.0 + nDotBeta * beta);

    if (Math.abs(denominator) < 1e-15) {
        // 数值退化，返回前向
        return {
            direction: { ...betaHat },
            dopplerFactor: Infinity,
            gamma: gam
        };
    }

    // 分子：n̂' + (γ-1)(n̂'·β̂)β̂ + γβ⃗
    const gammaMinus1 = gam - 1.0;
    const coeff = gammaMinus1 * nDotBeta;

    const restDir = {
        x: (nPrime.x + coeff * betaHat.x + gam * betaVec.x) / denominator,
        y: (nPrime.y + coeff * betaHat.y + gam * betaVec.y) / denominator,
        z: (nPrime.z + coeff * betaHat.z + gam * betaVec.z) / denominator
    };

    // 归一化（消除数值误差）
    const nRest = normalize3(restDir);

    // 逆多普勒因子：D_inv = ω/ω' = γ(1 + β⃗·n̂')
    const dopplerInv = denominator;

    return {
        direction: nRest,
        dopplerFactor: dopplerInv,  // ω/ω'，即静止频率/观察频率
        gamma: gam
    };
}

/**
 * 正向光行差：静止系方向 n̂ → 观察者系方向 n̂'
 * （用于验证和调试）
 */
export function forwardAberration(nRest, betaVec) {
    const beta = norm3(betaVec);
    if (beta < 1e-10) {
        return {
            direction: { ...nRest },
            dopplerFactor: 1.0,
            gamma: 1.0
        };
    }

    const gam = gamma(beta);
    const betaHat = normalize3(betaVec);
    const nDotBeta = dot3(nRest, betaHat);

    // 分母：γ(1 - β⃗·n̂)
    const denominator = gam * (1.0 - nDotBeta * beta);

    if (Math.abs(denominator) < 1e-15) {
        return {
            direction: { x: -betaHat.x, y: -betaHat.y, z: -betaHat.z },
            dopplerFactor: Infinity,
            gamma: gam
        };
    }

    const gammaMinus1 = gam - 1.0;
    const coeff = gammaMinus1 * nDotBeta;

    const obsDir = {
        x: (nRest.x + coeff * betaHat.x - gam * betaVec.x) / denominator,
        y: (nRest.y + coeff * betaHat.y - gam * betaVec.y) / denominator,
        z: (nRest.z + coeff * betaHat.z - gam * betaVec.z) / denominator
    };

    return {
        direction: normalize3(obsDir),
        dopplerFactor: denominator,  // ω'/ω = γ(1 - β⃗·n̂)
        gamma: gam
    };
}

/**
 * 计算辐射强度变换因子
 *
 * 比强度变换：I'_ν' = I_ν · D³
 * 其中 D = γ(1 - β⃗·n̂) 为正向多普勒因子
 *
 * 此处使用逆多普勒因子 D_inv = γ(1 + β⃗·n̂') = ω/ω'
 * 故 D = 1/D_inv
 * I' = I · (1/D_inv)³
 *
 * @param {number} dopplerInv - 逆多普勒因子 ω/ω'
 * @returns {number} 强度缩放因子
 */
export function intensityFactor(dopplerInv) {
    if (dopplerInv <= 0) return 0;
    return 1.0 / (dopplerInv * dopplerInv * dopplerInv);
}

/**
 * 将多普勒频移映射到颜色偏移
 *
 * 简化模型：将频率变化映射为色温变化
 * D_inv = ω/ω' < 1 → 蓝移（观察频率更高）
 * D_inv = ω/ω' > 1 → 红移（观察频率更低）
 *
 * @param {{r:number, g:number, b:number}} color - 静止系颜色 (0-1)
 * @param {number} dopplerInv - 逆多普勒因子 ω/ω'
 * @param {number} intensity - 强度因子
 * @returns {{r:number, g:number, b:number}} 偏移后颜色
 */
export function applyDopplerShift(color, dopplerInv, intensity) {
    if (dopplerInv <= 0) return { r: 0, g: 0, b: 0 };

    // D_obs = 1/dopplerInv = ω'/ω，即观察频率/静止频率
    const dObs = 1.0 / dopplerInv;

    // 对数频率偏移量
    const shift = Math.log2(Math.max(dObs, 0.01));

    // 蓝移（shift > 0）：加强蓝通道，减弱红通道
    // 红移（shift < 0）：加强红通道，减弱蓝通道
    const blueBoost = Math.max(0, Math.min(1, shift * 0.7));
    const redBoost = Math.max(0, Math.min(1, -shift * 0.7));

    let r = color.r;
    let g = color.g;
    let b = color.b;

    // 应用颜色偏移
    r += redBoost * 0.4 - blueBoost * 0.3;
    g -= Math.abs(shift) * 0.15;
    b += blueBoost * 0.4 - redBoost * 0.3;

    // 应用强度
    const int = Math.min(intensity, 5.0);
    r *= int;
    g *= int;
    b *= int;

    // 钳制
    return {
        r: Math.max(0, Math.min(1, r)),
        g: Math.max(0, Math.min(1, g)),
        b: Math.max(0, Math.min(1, b))
    };
}

/**
 * 计算前灯效应的可视角度压缩
 *
 * 在观察者参考系中，原本半张角为 θ 的锥体会被压缩
 * 到半张角为 θ' = 2·arctan( tan(θ/2) / √((1+β)/(1-β)) )
 *
 * 返回观察者参考系中的新半角
 *
 * @param {number} theta - 静止系半张角（弧度）
 * @param {number} beta - 速度大小
 * @returns {number} 观察者系半张角
 */
export function headlightAngle(theta, beta) {
    const ratio = Math.sqrt((1.0 + beta) / Math.max(1.0 - beta, 1e-10));
    return 2.0 * Math.atan(Math.tan(theta / 2.0) / ratio);
}