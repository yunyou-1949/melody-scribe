# Third-party notices / 第三方声明

本项目原创代码使用 MIT License，但包含或依赖以下第三方组件。

## Basic Pitch

- Package: `@spotify/basic-pitch` 1.0.1
- Copyright 2022 Spotify AB
- License: Apache License 2.0
- Project: https://github.com/spotify/basic-pitch-ts
- Model: https://github.com/spotify/basic-pitch-ts/tree/main/model

`js/basicpitch-bundle.js` 包含 Basic Pitch 及其模型权重。

## TensorFlow.js

- Package: `@tensorflow/tfjs` 3.21.0
- Copyright 2018 Google LLC
- License: Apache License 2.0
- Project: https://github.com/tensorflow/tfjs

## Microsoft Edge WebView2

- SDK: Microsoft.Web.WebView2
- Copyright Microsoft Corporation
- License: Microsoft Software License Terms
- Project: https://learn.microsoft.com/microsoft-edge/webview2/

仓库不提交 `Microsoft.Web.WebView2.*.dll` 与 `WebView2Loader.dll`，构建时请自行从 NuGet 获取。

## SheetSage2 / MERT-v2（外部工具，不随本项目分发）

- SheetSage2: https://huggingface.co/m-a-p/SheetSage2
- MERT-v2-FullSong: https://huggingface.co/m-a-p/MERT-v2-FullSong
- 权重许可证：CC BY-NC 4.0（仅限非商业）
- 本项目只支持导入其导出的 MIDI，不包含其代码或模型权重
- 使用时应标明 MERT2、模型名与来源仓库

## NCM 格式参考

NCM 容器与解密流程参考以下公开实现：

- https://github.com/taurusxin/ncmdump
- https://github.com/Johnserf-Seed/ncm2mp3
- https://github.com/allenfrostline/pyNCMDUMP

仅建议转换你已获得合法使用权的文件。

## 音频与测试素材

仓库不包含任何商业音乐、NCM 文件或用户音频。

`docs/score-comparison.png` 中的参考旋律为公有领域《欢乐颂》的简易三声部测试编配。

Apache License 2.0 全文见 [licenses/Apache-2.0.txt](licenses/Apache-2.0.txt)。

---

The MIT license above applies only to original project code. Third-party
components remain under their respective licenses.
