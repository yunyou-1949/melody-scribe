# Contributing

欢迎 Issue 和 PR。

## 开发

1. 修改 `js/core.js` 或 `js/app.js`
2. 运行 `python tools/build-web.py`
3. 直接打开根目录 `index.html` 验证
4. 不要提交构建产物、用户音频、NCM 或商业音乐

## 识别相关的改动

- 修改阈值、分段、后处理时，请同时说明是提升准确率还是速度
- 不要为了“看起来干净”而静默删除低置信度音符
- 涉及 Note-level 分轨的改动，请附一段公开版权测试素材的结果
- 改动 Basic Pitch 后，请更新 `NOTICE.md`

## 提交信息

建议使用：

- `feat: ...`
- `fix: ...`
- `docs: ...`
- `refactor: ...`

## 许可证

提交 PR 即表示你同意将代码以 MIT License 授权。
