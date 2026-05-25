/**
 * 随机几何体参数生成器（增强版）
 *
 * 生成更密集、更多样的静止系场景物体。
 * 包含球体、正方体，以及用于辨识方位的特殊标记物体。
 */

/**
 * 几何体类型
 */
export const GeomType = {
    SPHERE: 0,
    BOX: 1,
};

/**
 * 颜色方案：从明亮到深沉，覆盖广泛色相
 */
const COLOR_PALETTES = [
    // 暖色系
    [0, 40,    { r: 255, g: 80,  b: 60  }],   // 红
    [40, 80,   { r: 255, g: 140, b: 40  }],   // 橙
    [80, 120,  { r: 255, g: 210, b: 50  }],   // 黄
    [120, 160, { r: 200, g: 255, b: 80  }],   // 黄绿
    // 冷色系
    [160, 200, { r: 70,  g: 230, b: 100 }],   // 绿
    [200, 240, { r: 50,  g: 200, b: 220 }],   // 青
    [240, 280, { r: 60,  g: 120, b: 255 }],   // 蓝
    [280, 320, { r: 120, g: 60,  b: 255 }],   // 紫
    [320, 360, { r: 255, g: 60,  b: 180 }],   // 粉
];

/** 选取色板颜色 */
function pickColor(hue) {
    for (const [lo, hi, color] of COLOR_PALETTES) {
        if (hue >= lo && hue < hi) return { ...color };
    }
    return { r: 180, g: 180, b: 200 };
}

/** 在范围内随机变化颜色 */
function varyColor(base, amount) {
    return {
        r: Math.min(255, Math.max(30, base.r + (Math.random() - 0.5) * amount * 2)),
        g: Math.min(255, Math.max(30, base.g + (Math.random() - 0.5) * amount * 2)),
        b: Math.min(255, Math.max(30, base.b + (Math.random() - 0.5) * amount * 2)),
    };
}

/**
 * 为分块生成物体配置
 * @param {number} cx,cy,cz - 分块中心
 * @param {number} chunkSize - 分块边长
 * @param {number} count - 物体数量
 * @param {number} seed - 确定性种子
 * @returns {Array<{type, position, size, color, rotation}>}
 */
export function generateChunkObjects(cx, cy, cz, chunkSize, count, seed) {
    // 简易种子随机
    let s = seed;
    const rand = () => {
        s = (s * 16807 + 0) % 2147483647;
        return (s - 1) / 2147483646;
    };

    const objects = [];
    const half = chunkSize / 2;

    for (let i = 0; i < count; i++) {
        const rx = (rand() - 0.5) * chunkSize;
        const ry = (rand() - 0.5) * chunkSize;
        const rz = (rand() - 0.5) * chunkSize;

        const x = cx + rx;
        const y = cy + ry;
        const z = cz + rz;

        // 类型：60% 球，40% 方块
        const type = rand() < 0.6 ? GeomType.SPHERE : GeomType.BOX;

        // 大小分布：多数中小物体 + 少数大型
        let size;
        const r2 = rand();
        if (r2 < 0.7) {
            size = 3 + rand() * 12;       // 小：3-15
        } else if (r2 < 0.95) {
            size = 12 + rand() * 20;      // 中：12-32
        } else {
            size = 25 + rand() * 40;      // 大：25-65
        }

        // 颜色：按空间位置确定性取色相
        const hue = ((cx * 137 + cy * 71 + cz * 53 + i * 17) % 360 + 360) % 360;
        let color = pickColor(hue);
        color = varyColor(color, 40);

        // 10% 概率为金属灰
        if (rand() < 0.08) {
            const g = 80 + rand() * 130;
            color = { r: g, g: g, b: g };
        }

        // 正方体随机旋转
        let rotation = null;
        if (type === GeomType.BOX) {
            rotation = {
                x: rand() * Math.PI * 2,
                y: rand() * Math.PI * 2,
                z: rand() * Math.PI * 2,
            };
        }

        objects.push({
            type,
            position: { x, y, z },
            size,
            color,
            rotation,
        });
    }

    return objects;
}