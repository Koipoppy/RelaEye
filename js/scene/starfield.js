/**
 * 星空场景生成器
 *
 * 生成等距矩形投影（Equirectangular）的天空纹理。
 * 包含恒星、星云、银河带、坐标网格等特征，
 * 以便在相对论变换中能明显观察到光行差和多普勒效应。
 */

/**
 * 星空场景配置
 */
const CONFIG = {
    textureWidth: 2048,
    textureHeight: 1024,
    starCount: 3000,
    nebulaCount: 5,
    gridLineWidth: 1.5,
    brightnessBoost: 1.0
};

/**
 * 生成完整的天空纹理
 * @returns {HTMLCanvasElement} 等距矩形投影的天空画布
 */
export function generateSkyTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = CONFIG.textureWidth;
    canvas.height = CONFIG.textureHeight;
    const ctx = canvas.getContext('2d');

    // 黑色背景
    ctx.fillStyle = '#000010';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 绘制银河带
    drawMilkyWay(ctx);

    // 绘制星云
    drawNebulae(ctx);

    // 绘制恒星
    drawStars(ctx);

    // 绘制坐标网格
    drawCoordinateGrid(ctx);

    return canvas;
}

/**
 * 等距矩形坐标转换
 * RA (赤经) = phi ∈ [0, 2π]  → x
 * Dec (赤纬) = π/2 - theta ∈ [-π/2, π/2]  → y
 * theta = π/2 - dec 是极角（从北极算）
 *
 * 等距矩形投影：
 *   x = phi / (2π) * width
 *   y = (1 - theta/π) * height
 */
function equirectToCanvas(theta, phi, width, height) {
    return {
        x: ((phi + Math.PI) % (2 * Math.PI)) / (2 * Math.PI) * width,
        y: theta / Math.PI * height
    };
}

/**
 * 绘制银河带
 */
function drawMilkyWay(ctx) {
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;

    // 用多个半透明渐变椭圆模拟银河带
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (let i = 0; i < 40; i++) {
        const cx = (i / 40) * w;
        const amplitude = 30 + Math.random() * 50;
        const y0 = h * 0.45 + Math.sin(i * 0.3) * 40 + (Math.random() - 0.5) * 60;

        const gradient = ctx.createRadialGradient(cx, y0, 0, cx, y0, amplitude);
        gradient.addColorStop(0, `rgba(180, 190, 220, ${0.12 + Math.random() * 0.08})`);
        gradient.addColorStop(0.4, `rgba(140, 150, 200, ${0.06 + Math.random() * 0.04})`);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(cx - amplitude, y0 - amplitude, amplitude * 2, amplitude * 2);
    }

    ctx.restore();
}

/**
 * 绘制星云（大型彩色弥漫斑块）
 */
function drawNebulae(ctx) {
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;

    const nebulae = [
        { x: w * 0.25, y: h * 0.3, r: 120, color: [255, 100, 80], alpha: 0.08 },
        { x: w * 0.6, y: h * 0.55, r: 150, color: [80, 120, 255], alpha: 0.07 },
        { x: w * 0.8, y: h * 0.4, r: 100, color: [255, 80, 200], alpha: 0.06 },
        { x: w * 0.15, y: h * 0.7, r: 130, color: [100, 200, 255], alpha: 0.07 },
        { x: w * 0.5, y: h * 0.2, r: 90, color: [200, 255, 100], alpha: 0.05 },
    ];

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (const neb of nebulae) {
        // 多层渐变模拟星云结构
        for (let layer = 0; layer < 5; layer++) {
            const r = neb.r * (0.3 + layer * 0.2);
            const gradient = ctx.createRadialGradient(neb.x, neb.y, 0, neb.x, neb.y, r);
            const alpha = neb.alpha * (1 - layer * 0.15);
            const [rr, gg, bb] = neb.color;
            gradient.addColorStop(0, `rgba(${rr},${gg},${bb},${alpha})`);
            gradient.addColorStop(0.5, `rgba(${Math.floor(rr*0.6)},${Math.floor(gg*0.6)},${Math.floor(bb*0.6)},${alpha*0.5})`);
            gradient.addColorStop(1, 'rgba(0,0,0,0)');

            ctx.fillStyle = gradient;
            ctx.fillRect(neb.x - r, neb.y - r, r * 2, r * 2);
        }
    }

    ctx.restore();
}

/**
 * 绘制恒星
 */
function drawStars(ctx) {
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;

    // 光谱类型分布（O B A F G K M）
    const spectralTypes = [
        { type: 'O', color: [180, 200, 255], weight: 0.02, sizeRange: [2.5, 4.0], brightness: [0.8, 1.0] },
        { type: 'B', color: [190, 210, 255], weight: 0.08, sizeRange: [2.0, 3.5], brightness: [0.7, 0.95] },
        { type: 'A', color: [220, 230, 255], weight: 0.10, sizeRange: [1.8, 3.0], brightness: [0.6, 0.9] },
        { type: 'F', color: [255, 245, 230], weight: 0.15, sizeRange: [1.5, 2.5], brightness: [0.5, 0.85] },
        { type: 'G', color: [255, 235, 200], weight: 0.20, sizeRange: [1.2, 2.2], brightness: [0.4, 0.8] },
        { type: 'K', color: [255, 200, 140], weight: 0.25, sizeRange: [1.0, 2.0], brightness: [0.3, 0.7] },
        { type: 'M', color: [255, 160, 120], weight: 0.20, sizeRange: [0.8, 1.5], brightness: [0.2, 0.5] },
    ];

    const stars = [];

    // 生成恒星数据
    for (let i = 0; i < CONFIG.starCount; i++) {
        // 均匀分布在球面上
        const theta = Math.acos(2 * Math.random() - 1);  // [0, π]
        const phi = Math.random() * 2 * Math.PI;          // [0, 2π]

        // 银河带权重：增加靠近银河平面（Dec ≈ 0, theta ≈ π/2）的恒星密度
        const galacticLatitude = Math.abs(theta - Math.PI / 2);
        const galacticWeight = 1.0 + 3.0 * Math.exp(-galacticLatitude * 8);

        if (Math.random() > galacticWeight / 4.0) continue;

        // 选择光谱类型
        const r = Math.random();
        let cumWeight = 0;
        let spec = spectralTypes[0];
        for (const s of spectralTypes) {
            cumWeight += s.weight;
            if (r <= cumWeight) {
                spec = s;
                break;
            }
        }

        const size = spec.sizeRange[0] + Math.random() * (spec.sizeRange[1] - spec.sizeRange[0]);
        const brightness = spec.brightness[0] + Math.random() * (spec.brightness[1] - spec.brightness[0]);

        stars.push({ theta, phi, color: spec.color, size, brightness });
    }

    // 按亮度排序（暗的先画，亮的后画）
    stars.sort((a, b) => a.brightness - b.brightness);

    // 绘制恒星
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (const star of stars) {
        const pos = equirectToCanvas(star.theta, star.phi, w, h);

        // 光晕
        const glowGrad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, star.size * 3);
        glowGrad.addColorStop(0, `rgba(${star.color[0]},${star.color[1]},${star.color[2]},${star.brightness})`);
        glowGrad.addColorStop(0.3, `rgba(${star.color[0]},${star.color[1]},${star.color[2]},${star.brightness * 0.3})`);
        glowGrad.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.fillStyle = glowGrad;
        ctx.fillRect(pos.x - star.size * 3, pos.y - star.size * 3, star.size * 6, star.size * 6);

        // 核心亮点
        ctx.fillStyle = `rgba(${Math.min(255, star.color[0]+30)},${Math.min(255, star.color[1]+30)},${Math.min(255, star.color[2]+30)},${Math.min(1, star.brightness + 0.2)})`;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, star.size * 0.6, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

/**
 * 绘制坐标网格（赤经/赤纬线）
 * 帮助观察光行差效应
 */
function drawCoordinateGrid(ctx) {
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;

    ctx.save();
    ctx.strokeStyle = 'rgba(50, 80, 120, 0.25)';
    ctx.lineWidth = CONFIG.gridLineWidth;

    // 赤纬线（常数 theta）
    const decSteps = 18;  // 每10度
    for (let i = 0; i <= decSteps; i++) {
        const theta = (i / decSteps) * Math.PI;  // [0, π]
        const y = (theta / Math.PI) * h;

        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
    }

    // 赤经线（常数 phi）
    const raSteps = 24;  // 每15度（1小时）
    for (let i = 0; i < raSteps; i++) {
        const phi = (i / raSteps) * 2 * Math.PI;
        const x = (phi / (2 * Math.PI)) * w;

        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
    }

    // 天赤道加粗
    ctx.strokeStyle = 'rgba(80, 120, 180, 0.4)';
    ctx.lineWidth = CONFIG.gridLineWidth * 2;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.5);
    ctx.lineTo(w, h * 0.5);
    ctx.stroke();

    ctx.restore();
}

// 星空画布可直接作为 WebGL 纹理数据源传给 texImage2D