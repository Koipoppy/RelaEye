/**
 * 分块系统管理器
 *
 * 在观察者周围动态生成物体。
 * 关键：flatList 存储绝对世界坐标，getObjects() 每帧实时计算相对坐标。
 */
import { generateChunkObjects } from './geometryGen.js';

const CHUNK_SIZE    = 200;
const CHUNK_RADIUS  = 4;
const PER_CHUNK     = 12;
const MAX_TOTAL     = 384;
const VISIBLE_RANGE = 600;

export class ChunkManager {
    constructor() {
        this.activeChunks = new Map();
        this.flatList     = [];     // 存绝对世界坐标
        this._lastCx = NaN;
        this._lastCy = NaN;
        this._lastCz = NaN;
    }

    /**
     * 每帧调用，确保分块正确
     * @param {{x,y,z}} obs - 观察者位置
     * @param {{x,y,z}} fwd - 前向
     */
    update(obs, fwd) {
        const cx = Math.floor(obs.x / CHUNK_SIZE);
        const cy = Math.floor(obs.y / CHUNK_SIZE);
        const cz = Math.floor(obs.z / CHUNK_SIZE);

        if (cx === this._lastCx && cy === this._lastCy && cz === this._lastCz) {
            return;
        }
        this._lastCx = cx;
        this._lastCy = cy;
        this._lastCz = cz;

        const desired = new Set();
        for (let dx = -CHUNK_RADIUS; dx <= CHUNK_RADIUS; dx++) {
            for (let dy = -CHUNK_RADIUS; dy <= CHUNK_RADIUS; dy++) {
                for (let dz = -CHUNK_RADIUS; dz <= CHUNK_RADIUS; dz++) {
                    desired.add(`${cx+dx},${cy+dy},${cz+dz}`);
                }
            }
        }

        for (const [key] of this.activeChunks) {
            if (!desired.has(key)) this.activeChunks.delete(key);
        }

        for (const key of desired) {
            if (!this.activeChunks.has(key)) {
                const [gx, gy, gz] = key.split(',').map(Number);
                const seed = (gx * 73856093 ^ gy * 19349663 ^ gz * 83492791) >>> 0;
                this.activeChunks.set(key,
                    generateChunkObjects(gx * CHUNK_SIZE, gy * CHUNK_SIZE, gz * CHUNK_SIZE, CHUNK_SIZE, PER_CHUNK, seed));
            }
        }

        this._rebuild(fwd || { x: 0, y: 0, z: -1 });
    }

    /**
     * 获取物体列表（每帧调用，传入观测者位置，返回相对坐标）
     * @param {{x,y,z}} obs - 观测者位置
     * @returns {Array}
     */
    getObjects(obs) {
        const result = [];
        for (let i = 0; i < this.flatList.length; i++) {
            const o = this.flatList[i];
            result.push({
                type: o.type,
                position: {
                    x: o.position.x - obs.x,
                    y: o.position.y - obs.y,
                    z: o.position.z - obs.z,
                },
                size: o.size,
                color: o.color,
            });
        }
        return result;
    }

    _rebuild(fwd) {
        const all = [];
        for (const [, objs] of this.activeChunks) {
            for (const o of objs) {
                all.push(o);
            }
        }

        // 简单按大小排序（大物体优先）
        all.sort((a, b) => b.size - a.size);
        this.flatList = all.slice(0, MAX_TOTAL);
    }
}