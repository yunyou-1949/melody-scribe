# Third-party notices

本项目的复音/伴奏识别模式使用以下开源组件，均以 Apache License 2.0 授权：

## Basic Pitch

- Package: `@spotify/basic-pitch` 1.0.1
- Copyright 2022 Spotify AB
- License: Apache License 2.0
- Project: https://github.com/spotify/basic-pitch-ts
- Bundled model: https://github.com/spotify/basic-pitch-ts/tree/main/model

## TensorFlow.js

- Package: `@tensorflow/tfjs` 3.21.0
- Copyright 2018 Google LLC
- License: Apache License 2.0
- Project: https://github.com/tensorflow/tfjs

Apache License 2.0 全文：https://www.apache.org/licenses/LICENSE-2.0

这些组件被打包进 `js/basicpitch-bundle.js`，完全在浏览器本地运行，不会上传音频。

## 大钢琴采样

- FluidR3 GM by Frank Wen
- License: CC BY 3.0 US
- Source: https://github.com/paulrosen/midi-js-soundfonts
- 用于「大钢琴」试听音色，经变调覆盖键盘
