/**
 * UI 控制面板
 *
 * 管理界面元素：速度滑块、模式切换、HUD 信息显示
 */

import { DEFAULT_MAX_BETA, MIN_BETA, MAX_BETA } from '../physics/constants.js';

/**
 * 仿真模式
 */
export const SimMode = {
    FREE_EXPLORE: 'free',     // 模式一：自由探索
    SNAPSHOT: 'snapshot'      // 模式二：瞬间观察
};

export class UIPanel {
    constructor() {
        this.mode = SimMode.FREE_EXPLORE;
        this.maxBeta = DEFAULT_MAX_BETA;

        // 回调
        this._onModeChange = null;
        this._onMaxBetaChange = null;

        this._createDOM();
    }

    /**
     * 创建界面元素
     */
    _createDOM() {
        const container = document.createElement('div');
        container.id = 'ui-panel';
        container.innerHTML = `
            <div class="panel-section">
                <div class="panel-title">相对论光学仿真</div>
            </div>

            <div class="panel-section">
                <label class="panel-label">仿真模式</label>
                <div class="mode-buttons">
                    <button id="btn-free" class="mode-btn active" data-mode="free">
                        自由探索
                    </button>
                    <button id="btn-snapshot" class="mode-btn" data-mode="snapshot">
                        瞬间观察
                    </button>
                </div>
            </div>

            <div class="panel-section" id="section-max-speed">
                <label class="panel-label">
                    最大速度 β<sub>max</sub> = <span id="val-max-beta">${DEFAULT_MAX_BETA.toFixed(2)}</span> c
                </label>
                <input type="range" id="slider-max-beta"
                    min="${MIN_BETA}" max="${MAX_BETA}" step="0.01"
                    value="${DEFAULT_MAX_BETA}">
            </div>

            <div class="panel-section">
                <label class="panel-label">操作说明</label>
                <div class="help-text" id="help-free">
                    <b>W 键</b>：相对论加速（按住）<br>
                    <b>松开 W</b>：自动减速<br>
                    <b>鼠标</b>：控制速度方向<br>
                    <b>滚轮</b>：缩放视野
                </div>
                <div class="help-text" id="help-snapshot" style="display:none">
                    <b>鼠标拖动</b>：自由旋转视角<br>
                    <b>滚轮</b>：缩放视野<br>
                    <span style="color:#6ab0ff;">速度与位置已冻结</span>
                </div>
            </div>
        `;

        document.body.appendChild(container);

        // 绑定事件
        this._bindEvents();
    }

    _bindEvents() {
        // 模式按钮
        document.getElementById('btn-free').addEventListener('click', () => {
            this.setMode(SimMode.FREE_EXPLORE);
        });
        document.getElementById('btn-snapshot').addEventListener('click', () => {
            this.setMode(SimMode.SNAPSHOT);
        });

        // 最大速度滑块
        const slider = document.getElementById('slider-max-beta');
        slider.addEventListener('input', () => {
            this.maxBeta = parseFloat(slider.value);
            document.getElementById('val-max-beta').textContent = this.maxBeta.toFixed(2);
            if (this._onMaxBetaChange) {
                this._onMaxBetaChange(this.maxBeta);
            }
        });
    }

    /**
     * 切换模式
     */
    setMode(mode) {
        this.mode = mode;

        // 更新按钮状态
        document.getElementById('btn-free').classList.toggle('active', mode === SimMode.FREE_EXPLORE);
        document.getElementById('btn-snapshot').classList.toggle('active', mode === SimMode.SNAPSHOT);

        // 切换帮助文本
        document.getElementById('help-free').style.display = mode === SimMode.FREE_EXPLORE ? 'block' : 'none';
        document.getElementById('help-snapshot').style.display = mode === SimMode.SNAPSHOT ? 'block' : 'none';

        if (this._onModeChange) {
            this._onModeChange(mode);
        }
    }

    /**
     * 模式变更回调
     */
    onModeChange(callback) {
        this._onModeChange = callback;
    }

    /**
     * 最大速度变更回调
     */
    onMaxBetaChange(callback) {
        this._onMaxBetaChange = callback;
    }

    /**
     * 获取当前模式
     */
    getMode() {
        return this.mode;
    }

    /**
     * 获取最大速度
     */
    getMaxBeta() {
        return this.maxBeta;
    }
}