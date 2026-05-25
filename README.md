# RelaEye - 相对论光学仿真

基于 GPU 光线步进的真实相对论光学现象渲染器。

![Relativistic Optics](https://img.shields.io/badge/Relativistic-Optics-brightgreen)
![WebGL](https://img.shields.io/badge/WebGL-2.0-blue)
![License](https://img.shields.io/badge/License-MIT-yellow)

## 特性

### 真实相对论光学渲染

- **逆光行差** (Light Aberration)：运动观测者前方光子汇聚，后方发散
- **多普勒频移** (Doppler Shift)：蓝移/红移真实反映物体相对速度
- **前灯效应** (Headlight Effect)：前方物体亮度增强，后方变暗
- **无限生成场景**：球体与立方体随机分布于空间，观察者可在其中自由穿梭

### 操作方式

| 操作 | 功能 |
|------|------|
| **鼠标左键拖动** | 控制飞行方向（视角方向 = 速度方向） |
| **W 键** | 按住加速，松开自动减速 |
| **滚轮** | 缩放视野（FOV） |
| **模式切换** | 自由探索 / 瞬间观察 |

### 物理单位

- 距离单位：光秒（光在真空中 1 秒行进的距离）
- 速度单位：光速倍数 β = v/c ∈ [0, 1)
- 默认最大速度：0.9c（γ ≈ 2.29）

## 技术架构

```
├── index.html          # 入口页面
├── css/style.css       # 新拟态风格样式
└── js/
    ├── main.js         # 主程序与渲染循环
    ├── input/
    │   └── controls.js # 鼠标键盘输入控制
    ├── physics/
    │   ├── constants.js # 物理常量 (c=1)
    │   └── fourVector.js # 四维时空矢量运算
    ├── renderer/
    │   └── relRenderer.js # GPU 光线步进着色器
    ├── ui/
    │   └── panel.js    # 控制面板 UI
    └── world/
        ├── chunkManager.js # 无限分块生成系统
        └── geometryGen.js # 确定性几何体生成
```

### 核心技术

- **GPU Ray Marching**：每像素 SDF 光线步进，数学精确的相对论变换
- **DataTexture**：384 个物体参数通过 Float32 纹理传入 GLSL
- **分块系统**：观察者驱动，动态生成周边区块，遗忘远端区块
- **Lorentz 不变性**：所有光学效果从逆光行差公式严格推导

## 相对论光学原理

### 逆光行差

观察者系方向 → 静止系方向：

```
n_rest = normalize(n_obs + (γ-1)(n_obs·β̂)β̂ + γβ̂) / (γ(1 + β·n_obs))
```

### 多普勒频移

```
ω_rest / ω_obs = γ(1 + β·n_obs)
```

### 前灯效应

相对论情况下，运动物体前方光子朝锥角压缩，强度与 Doppler² 成正比。

## 启动

```bash
# Python 内置服务器
python -m http.server 8000

# 或 Node.js
npx serve .
```

然后打开 http://localhost:8000

## 开发

本项目为纯前端，无构建步骤。所有代码使用 ES Module 直接运行。

### 着色器编译要求

- WebGL 2.0
- GLSL ES 3.0
- Three.js r160+

## License

MIT
