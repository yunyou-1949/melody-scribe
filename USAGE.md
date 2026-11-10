# 使用声明 / Third-party Credits

## 完全免费，原创代码 MIT 开源

本项目**完全免费**，没有付费版、激活码或内购。

本项目原创代码使用 [MIT License](LICENSE)，可以自由使用、修改、分发，
包括商业使用，只要保留版权声明和许可证文本。

> 注意：MIT 只覆盖本项目原创代码，**不覆盖**下面列出的第三方组件。
> 第三方组件仍受各自许可证约束，尤其是 SheetSage2 / MERT 的
> CC BY-NC 4.0（仅限非商业）权重。

## 其他人的成果

本项目的识别、窗口、音频与格式解析建立在其他人的成果上，必须保留以下署名：

### Basic Pitch

- 作者 / 版权：Spotify AB
- 许可证：Apache License 2.0
- 项目：https://github.com/spotify/basic-pitch-ts
- 用途：复音 / 伴奏识别
- 本项目包含其打包后的 JS bundle 与模型权重

### TensorFlow.js

- 作者 / 版权：Google LLC
- 许可证：Apache License 2.0
- 项目：https://github.com/tensorflow/tfjs
- 用途：在浏览器 / WebView2 中运行 Basic Pitch

### Microsoft Edge WebView2

- 作者 / 版权：Microsoft Corporation
- 许可证：Microsoft Software License Terms
- 项目：https://learn.microsoft.com/microsoft-edge/webview2/
- 用途：Windows 独立窗口

### SheetSage2 / MERT-v2（外部工具，不随本项目分发）

本项目**不包含** SheetSage2 或 MERT 的代码和权重。只提供“导入它导出的 MIDI”的工作流。

- SheetSage2 模型：https://huggingface.co/m-a-p/SheetSage2
- MERT-v2-FullSong：https://huggingface.co/m-a-p/MERT-v2-FullSong
- 权重许可证：**CC BY-NC 4.0（仅限非商业用途）**
- 署名要求：使用时请标明 **MERT2**、模型名与来源仓库
- 其代码、模型、Python 运行时、FFmpeg 等版权归各自作者

如果你使用 SheetSage2 工作流，请遵守它的非商业许可；不要把它生成的模型/权重
当作本项目的一部分再分发。

### NCM 解密

NCM 容器格式与解密流程参考了公开的 ncmdump 实现：

- https://github.com/taurusxin/ncmdump
- https://github.com/Johnserf-Seed/ncm2mp3
- https://github.com/allenfrostline/pyNCMDUMP

仅建议转换你已获得合法使用权的文件。

### 图标与封面

项目图标、鲸鱼头像与封面由本项目作者提供；二次分发时请保留作者署名。

## 音频与测试素材

仓库不包含任何商业音乐、NCM 文件或用户音频。

`docs/score-comparison.png` 中的参考旋律为公有领域《欢乐颂》的简易三声部测试编配。

## 联系作者

- （小马利亚）Maneightout / 游云
- 反馈 QQ：2171227679

## 大钢琴采样

- FluidR3 GM by Frank Wen
- License: CC BY 3.0 US
- Source: https://github.com/paulrosen/midi-js-soundfonts
- 用于「大钢琴」试听音色，经变调覆盖键盘
