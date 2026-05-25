/**
 * 主程序（光线步进版）
 *
 * 模式一（free）：W 加速 / 松开减速，鼠标控制速度方向
 * 模式二（snapshot）：冻结当前速度和位置，自由旋转观察
 */

import { RelativisticRenderer } from './renderer/relRenderer.js';
import { InputController } from './input/controls.js';
import { UIPanel, SimMode } from './ui/panel.js';
import { ChunkManager } from './world/chunkManager.js';
import { gamma } from './physics/fourVector.js';
import { ACCELERATION, DECELERATION, MIN_BETA, DEFAULT_MAX_BETA, DEFAULT_BETA } from './physics/constants.js';

// ── 全局状态 ──
const S = {
    mode:           SimMode.FREE_EXPLORE,
    beta:           DEFAULT_BETA,
    maxBeta:        DEFAULT_MAX_BETA,
    fov:            Math.PI / 3,
    pos:            { x: 0, y: 0, z: 0 },
    frozenPos:      { x: 0, y: 0, z: 0 },
    frozenBeta:     0,
    frozenForward:  { x: 0, y: 0, z: -1 },
};

// ── 启动 ──
async function main() {
    createHUD();

    const canvas   = document.getElementById('render-canvas');
    const renderer = new RelativisticRenderer(canvas);
    const input    = new InputController(canvas);
    const chunks   = new ChunkManager();

    // UI
    const ui = new UIPanel();
    ui.onModeChange(mode => switchMode(mode, input));
    ui.onMaxBetaChange(v => { S.maxBeta = v; });

    // 滚轮 FOV
    canvas.addEventListener('wheel', e => {
        e.preventDefault();
        S.fov = Math.max(0.15, Math.min(Math.PI * 0.8, S.fov + e.deltaY * 0.0008));
    }, { passive: false });

    // 窗口大小
    window.addEventListener('resize', () => renderer.resize(window.innerWidth, window.innerHeight));

    // ── 主循环 ──
    let prev = performance.now();
    function loop(now) {
        requestAnimationFrame(loop);
        const dt = Math.min((now - prev) / 1000, 0.1);
        prev = now;

        input.updateView();

        if (S.mode === SimMode.FREE_EXPLORE) {
            updateFree(dt, input, chunks);
        }

        render(renderer, input, chunks);
        refreshHUD();
    }
    requestAnimationFrame(loop);
}

// ── 模式切换 ──
function switchMode(mode, input) {
    if (mode === SimMode.SNAPSHOT) {
        S.frozenPos     = { ...S.pos };
        S.frozenBeta    = S.beta;
        S.frozenForward = input.forward;
        S.mode = SimMode.SNAPSHOT;
        toast('瞬间观察 — 速度与位置已冻结');
    } else {
        S.pos  = { ...S.frozenPos };
        S.beta = S.frozenBeta;
        S.mode = SimMode.FREE_EXPLORE;
        toast('自由探索 — W 加速 / 鼠标转向');
    }
}

// ── 自由探索更新 ──
function updateFree(dt, input, chunks) {
    // W 加速 / 松开减速
    if (input.accelerating) {
        S.beta = Math.min(S.beta + ACCELERATION * dt, S.maxBeta);
    } else {
        S.beta = Math.max(S.beta - DECELERATION * dt, MIN_BETA);
    }

    // 速度方向 = 相机前向
    const fwd = input.forward;
    // 观察者位置沿速度方向推进
    const speed = S.beta;  // 以光速为单位
    S.pos.x += fwd.x * speed * dt;
    S.pos.y += fwd.y * speed * dt;
    S.pos.z += fwd.z * speed * dt;

    // 分块系统（传入前向方向以优先排序前方物体）
    chunks.update(S.pos, input.forward);
}

// ── 渲染 ──
function render(renderer, input, chunks) {
    // 上传物体数据（传入观测者位置以动态计算相对坐标）
    const pos = S.mode === SimMode.SNAPSHOT ? S.frozenPos : S.pos;
    const objs = chunks.getObjects(pos);
    renderer.updateObjects(objs);
    window.__objCount = objs.length;

    let beta, fwd, gam;
    if (S.mode === SimMode.SNAPSHOT) {
        beta = S.frozenBeta;
        fwd  = S.frozenForward;
        gam  = gamma(beta);
    } else {
        beta = S.beta;
        fwd  = input.forward;
        gam  = gamma(beta);
    }

    const right = input.right;
    const up    = input.up;

    renderer.render(fwd, right, up, fwd, beta, gam, S.fov);
}

// ── HUD ──
function createHUD() {
    document.body.insertAdjacentHTML('beforeend', `
        <div id="pointer-hint">鼠标左键拖动旋转 · W键加速</div>
        <div id="mode-toast"></div>
        <div id="hud">
            <div class="hud-item"><div class="hud-label">速度 β</div><div class="hud-value speed" id="hu-beta">0.00</div><div class="hud-unit">c</div></div>
            <div class="hud-item"><div class="hud-label">γ 因子</div><div class="hud-value" id="hu-gamma">1.00</div></div>
            <div class="hud-item"><div class="hud-label">蓝移峰值</div><div class="hud-value" id="hu-blue">1.00</div></div>
            <div class="hud-item"><div class="hud-label">位置</div><div class="hud-value" id="hu-pos" style="font-size:13px">0,0,0</div></div>
            <div class="hud-item"><div class="hud-label">物体</div><div class="hud-value" id="hu-obj">0</div></div>
        </div>
        <div id="speed-bar-container"><div id="speed-bar-fill"></div></div>
    `);
}

function refreshHUD() {
    let beta = S.beta, pos = S.pos;
    if (S.mode === SimMode.SNAPSHOT) {
        beta = S.frozenBeta;
        pos  = S.frozenPos;
    }
    const g = gamma(beta);
    document.getElementById('hu-beta').textContent  = beta.toFixed(3);
    document.getElementById('hu-gamma').textContent = g < 1000 ? g.toFixed(2) : '∞';
    document.getElementById('hu-blue').textContent  = (Math.sqrt((1+beta)/Math.max(1-beta,1e-10))).toFixed(2);
    document.getElementById('hu-pos').textContent   = `${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`;
    document.getElementById('hu-obj').textContent   = window.__objCount ?? 0;
    const pct = Math.min(100, (beta / (S.mode === SimMode.FREE_EXPLORE ? S.maxBeta : 1)) * 100);
    document.getElementById('speed-bar-fill').style.width = pct + '%';
}

function toast(msg) {
    const el = document.getElementById('mode-toast');
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2000);
}

// ── 入口 ──
document.addEventListener('DOMContentLoaded', () => {
    main().catch(e => {
        document.body.innerHTML = `<div style="color:#f66;text-align:center;padding-top:40vh;font-size:18px;">
            启动失败<br><span style="font-size:14px;color:#889;">${e.message}</span></div>`;
        console.error(e);
    });
});