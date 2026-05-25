/**
 * 输入控制器
 *
 * 鼠标左键拖动 = 旋转视角（= 速度方向）
 * W 键加速 / 松开减速
 * 不依赖 Pointer Lock API，用 clientX/Y 差值计算旋转
 */
import { MOUSE_SENSITIVITY } from '../physics/constants.js';

export class InputController {
    constructor(canvas) {
        this.canvas = canvas;
        this.keys = Object.create(null);
        this.yaw   = 0;
        this.pitch = 0;

        this._lastX = 0;
        this._lastY = 0;
        this._dragging = false;

        this._onKeyDown = e => { this.keys[e.code] = true; };
        this._onKeyUp   = e => { this.keys[e.code] = false; };

        this._onMouseDown = e => {
            if (e.button === 0) {
                this._dragging = true;
                this._lastX = e.clientX;
                this._lastY = e.clientY;
                this.canvas.style.cursor = 'grabbing';
            }
        };
        this._onMouseMove = e => {
            if (!this._dragging) return;
            const dx = e.clientX - this._lastX;
            const dy = e.clientY - this._lastY;
            this._lastX = e.clientX;
            this._lastY = e.clientY;
            this.yaw   -= dx * MOUSE_SENSITIVITY;
            this.pitch -= dy * MOUSE_SENSITIVITY;
            this.pitch  = Math.max(-Math.PI/2 + 0.01, Math.min(Math.PI/2 - 0.01, this.pitch));
            this.yaw    = ((this.yaw % (Math.PI*2)) + Math.PI*2) % (Math.PI*2);
        };
        this._onMouseUp = e => {
            if (e.button === 0) {
                this._dragging = false;
                this.canvas.style.cursor = 'grab';
            }
        };

        document.addEventListener('keydown', this._onKeyDown);
        document.addEventListener('keyup',   this._onKeyUp);
        document.addEventListener('mousemove', this._onMouseMove);
        document.addEventListener('mousedown', this._onMouseDown);
        document.addEventListener('mouseup',   this._onMouseUp);

        this.canvas.style.cursor = 'grab';

        const el = document.getElementById('pointer-hint');
        if (el) {
            el.style.opacity = '1';
            setTimeout(() => { el.style.opacity = '0'; }, 5000);
        }
    }

    get accelerating() { return !!this.keys['KeyW']; }

    updateView() {}

    get forward() {
        const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
        const cy = Math.cos(this.yaw),   sy = Math.sin(this.yaw);
        return { x: -sy*cp, y: sp, z: -cy*cp };
    }
    get right() {
        const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
        return { x: cy, y: 0, z: -sy };
    }
    get up() {
        const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
        const cy = Math.cos(this.yaw),   sy = Math.sin(this.yaw);
        return { x: sy*sp, y: cp, z: cy*sp };
    }

    dispose() {
        document.removeEventListener('keydown',  this._onKeyDown);
        document.removeEventListener('keyup',    this._onKeyUp);
        document.removeEventListener('mousemove', this._onMouseMove);
        document.removeEventListener('mousedown', this._onMouseDown);
        document.removeEventListener('mouseup',   this._onMouseUp);
    }
}