# v2.25.0-edge.1: Edge TTS Support / Edge TTS 支持

## 🎉 主要功能 / Key Features

### ✨ 免费 Microsoft Edge 神经 TTS / Free Microsoft Edge Neural TTS
- ✅ **无需 Azure API 密钥** / **No Azure API key required**
- ✅ **250+ 神经语音**，支持 **130+ 语言** / **250+ neural voices**, **130+ languages**
- ✅ 直连 `speech.platform.bing.com` 端点 / Direct connection to `speech.platform.bing.com` endpoint

### 🔧 技术实现 / Technical Implementation

#### 1. **Sec-MS-GEC v2 DRM Token 生成** / **Sec-MS-GEC v2 DRM Token Generation**
- 📦 新增文件 `js/sec-ms-gec.js` / New file `js/sec-ms-gec.js`
- 🔢 基于 BigInt 的 JavaScript 实现 / BigInt-based JavaScript implementation
- 📝 移植自 [rany2/edge-tts](https://github.com/rany2/edge-tts) (Python) / Ported from [rany2/edge-tts](https://github.com/rany2/edge-tts) (Python)
- ✅ 通过所有 7 个测试向量 / Passes all 7 test vectors
- 🔄 每 5 分钟自动刷新 / Auto-refreshes every 5 minutes

**修复的 Bug / Fixed Bugs:**
- ❌ **旧实现**: JavaScript `Number` 导致 64 位 CS64 计算溢出 / **Old**: JavaScript `Number` caused 64-bit CS64 overflow
- ❌ **旧实现**: 错误的字节序（大端 → 小端）/ **Old**: Wrong byte order (big-endian → little-endian)
- ✅ **新实现**: BigInt 精确计算 + 正确的小端字节序 / **New**: BigInt precise calculation + correct little-endian byte order

#### 2. **User-Agent 改写** / **User-Agent Rewrite**
- 🔧 使用 `declarativeNetRequest` 将 Chrome UA 伪装为 Edge / Uses `declarativeNetRequest` to masquerade Chrome UA as Edge
- ⚠️ **必需**: Microsoft 对非 Edge 浏览器返回 HTTP 403 / **Required**: Microsoft returns HTTP 403 for non-Edge browsers
- 🎯 仅针对 `speech.platform.bing.com` WebSocket 请求 / Only for `speech.platform.bing.com` WebSocket requests

#### 3. **完整的测试套件** / **Complete Test Suite**
- ✅ 155 项测试全部通过 / All 155 tests passing
- ✅ 7 个 DRM 向量测试 / 7 DRM vector tests
- ✅ 独立测试脚本 `test-edge-drm.js` / Standalone test script `test-edge-drm.js`

## 📦 安装 / Installation

### 从此 Release 安装 / Install from This Release

1. 下载附件中的 `read-aloud-chrome-edge-tts.zip` / Download `read-aloud-chrome-edge-tts.zip` from assets below
2. 解压缩 ZIP 文件 / Extract the ZIP file
3. 在 Chrome 打开 `chrome://extensions/` / Open `chrome://extensions/` in Chrome
4. 启用"开发者模式" / Enable "Developer mode"
5. 点击"加载已解压的扩展程序" / Click "Load unpacked"
6. 选择解压后的文件夹 / Select the extracted folder

### 使用 Edge TTS 语音 / Using Edge TTS Voices

1. 点击浏览器工具栏上的 Read Aloud 图标 / Click Read Aloud icon in toolbar
2. 点击设置（齿轮图标）/ Click Settings (gear icon)
3. 选择以 "Edge" 开头的语音 / Select a voice starting with "Edge"
   - 例如 / For example: `Edge Xiaoxiao (Chinese (Simplified, PRC))`
   - 例如 / For example: `Edge Jenny (English (United States))`

## 🔗 相关链接 / Related Links

- **Pull Request**: [#1](https://github.com/tyrad/read-aloud/pull/1)
- **上游项目 / Upstream**: [ken107/read-aloud](https://github.com/ken107/read-aloud)
- **DRM 参考 / DRM Reference**: [rany2/edge-tts](https://github.com/rany2/edge-tts)

## ⚠️ 重要声明 / Important Notice

- ⚠️ **非官方 API** / **Unofficial API**: 使用非官方 Microsoft 端点 / Uses unofficial Microsoft endpoint
- ⚠️ **可能失效** / **May Break**: Microsoft 可能随时更改或阻止访问 / Microsoft may change or block access at any time
- ⚠️ **仅供个人使用** / **Personal Use Only**: 此项目仅供个人学习和使用 / This project is for personal learning and use only
- ⚠️ **非 Microsoft 认可** / **Not Microsoft-Endorsed**: 与 Microsoft Corporation 无关联 / Not affiliated with Microsoft Corporation

## 🐛 已知问题 / Known Issues

1. **仅支持基于 Chromium 的浏览器** / **Chromium-based browsers only**
   - Chrome, Edge, Brave, Vivaldi 等 / Chrome, Edge, Brave, Vivaldi, etc.
   - Firefox 不支持 Manifest V3 的 `declarativeNetRequest` / Firefox doesn't support Manifest V3 `declarativeNetRequest`

2. **WebSocket 连接限制** / **WebSocket Connection Limits**
   - 每个连接最多 30 秒音频 / Maximum 30 seconds per connection
   - 长文本自动分段 / Long text automatically segmented

## 🧪 测试结果 / Test Results

```bash
npm test
# ✅ 155 tests passing
# ✅ 7 DRM vector tests passing

node test-edge-drm.js
# ✅ 1729900000: PASS
# ✅ 1730000000: PASS
# ✅ 1761460000: PASS
# ✅ 1761463800: PASS
# ✅ 1761465600: PASS
# ✅ 1700000000: PASS
# ✅ 1800000000: PASS
```

## 📝 更新日志 / Changelog

### Added / 新增
- Edge TTS 引擎 (`js/tts-engines.js`) / Edge TTS engine (`js/tts-engines.js`)
- Sec-MS-GEC v2 DRM 实现 (`js/sec-ms-gec.js`) / Sec-MS-GEC v2 DRM implementation (`js/sec-ms-gec.js`)
- User-Agent 改写规则 (`background.js`) / User-Agent rewrite rules (`background.js`)
- 默认 Edge 语音列表 (`js/defaults.js`) / Default Edge voice list (`js/defaults.js`)
- DRM 测试套件 (`tests/edge-tts-drm.test.js`, `test-edge-drm.js`) / DRM test suite
- 完整技术文档 / Complete technical documentation

### Changed / 修改
- 添加 `declarativeNetRequestWithHostAccess` 权限 / Added `declarativeNetRequestWithHostAccess` permission
- 添加 `speech.platform.bing.com` host 权限 / Added `speech.platform.bing.com` host permission
- 所有 HTML 页面加载 `sec-ms-gec.js` / All HTML pages load `sec-ms-gec.js`

## 🙏 致谢 / Credits

- **[ken107/read-aloud](https://github.com/ken107/read-aloud)** - 原始 Read Aloud 扩展 / Original Read Aloud extension
- **[rany2/edge-tts](https://github.com/rany2/edge-tts)** - DRM 实现参考 / DRM implementation reference

---

**Commit SHA**: `d6c6961`  
**Tag**: `v2.25.0-edge.1`  
**Release Date**: 2026-10-26

---

<div align="center">
  <sub>
    Fork maintained by <a href="https://github.com/tyrad">@tyrad</a><br>
    Original project by <a href="https://github.com/ken107">Hai Phan</a>
  </sub>
</div>
