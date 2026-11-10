# 使用声明 / Usage Notice

## 完全免费

本项目**完全免费**，没有付费版、没有激活码、没有内购。

## 请勿用于商业用途

本项目原创代码从 **v1.4.4** 起使用 **PolyForm Noncommercial License 1.0.0**，
仅允许个人学习、研究、测试、兴趣项目等**非商业用途**。

- 不得销售本软件或基于本软件的修改版
- 不得作为付费服务、商业产品、商业外包交付的一部分
- 不得用于有直接或间接商业收益的产品
- 如你不确定是否属于商业用途，请先联系作者获得书面许可
- 如已误用于商业用途，请立即停止并删除相关分发

这不是 OSI 定义下的“开源许可证”，而是**源码公开、非商业使用**许可。
第三方组件仍按各自许可证授权，见 [NOTICE.md](NOTICE.md)。

## 其他人的成果

本项目的识别、窗口、音频与格式解析建立在其他人的成果上：

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
- 用途：在浏览器/WebView2 中运行 Basic Pitch

### Microsoft Edge WebView2

- 作者 / 版权：Microsoft Corporation
- 许可证：Microsoft Software License Terms
- 项目：https://learn.microsoft.com/microsoft-edge/webview2/
- 用途：Windows 独立窗口

### SheetSage2 / MERT-v2

本项目**不包含** SheetSage2 或 MERT 的代码和权重，只提供“导入它导出的 MIDI”的工作流。

如果你使用 SheetSage2：

- SheetSage2 模型：https://huggingface.co/m-a-p/SheetSage2
- MERT-v2-FullSong：https://huggingface.co/m-a-p/MERT-v2-FullSong
- 权重许可证：**CC BY-NC 4.0（仅限非商业用途）**
- 署名要求：使用时请标明 **MERT2**、模型名与来源仓库
- 其代码、模型、Python 运行时、FFmpeg 等版权归各自作者

### NCM 解密

NCM 容器格式与解密流程参考了公开的 ncmdump 实现：

- https://github.com/taurusxin/ncmdump
- https://github.com/Johnserf-Seed/ncm2mp3
- https://github.com/allenfrostline/pyNCMDUMP

仅建议转换你已获得合法使用权的文件。

### 图标与封面

项目图标、鲸鱼头像与封面由本项目作者提供；如你二次分发，请保留作者署名。

## 音频与测试素材

仓库不包含任何商业音乐、NCM 文件或用户音频。

`docs/score-comparison.png` 中的参考旋律为公有领域《欢乐颂》的简易三声部测试编配。

## 联系作者

- （小马利亚）Maneightout / 游云
- 反馈 QQ：2171227679

商业授权、二次分发或其他用途，请先联系作者。
