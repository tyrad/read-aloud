<div align="center">
	<img src="img/icon.png" width="128" height="128">
	<br>
	<img src="docs/images/logo-text-trans.png" width="391" height="66">
	<br>
	A <b>Text to Speech Voice Reader</b> extension for your browser!
	<br><br>
	<b>🍴 Personal Fork with Free Microsoft Edge TTS Support</b>
</div>

---

## 🔔 关于此 Fork / About This Fork

**This is a personal fork of [ken107/read-aloud](https://github.com/ken107/read-aloud)** maintained by [@tyrad](https://github.com/tyrad) for **personal use only**.

**这是 [ken107/read-aloud](https://github.com/ken107/read-aloud) 的个人分支**，由 [@tyrad](https://github.com/tyrad) 维护，**仅供个人使用**。

### ⚡ 主要差异 / Key Differences

与上游 ken107/read-aloud 相比，此 fork 添加了以下功能：

Compared to upstream ken107/read-aloud, this fork adds:

#### 1. **免费 Microsoft Edge 神经 TTS / Free Microsoft Edge Neural TTS**
- ✅ 无需 Azure API 密钥 / No Azure API key required
- ✅ 250+ 神经语音，支持 130+ 语言 / 250+ neural voices, 130+ languages
- ✅ 直连 `speech.platform.bing.com` 端点（非官方）/ Direct connection to `speech.platform.bing.com` endpoint (unofficial)
- ⚠️ **非 Microsoft 官方 API** / **Not an official Microsoft API**
- ⚠️ **可能随时失效** / **May break if Microsoft changes the endpoint**

#### 2. **Sec-MS-GEC v2 DRM 实现 / Sec-MS-GEC v2 DRM Implementation**
- 📦 新增文件 `js/sec-ms-gec.js` / New file `js/sec-ms-gec.js`
- 🔢 基于 BigInt 的 JavaScript 移植（源自 [rany2/edge-tts](https://github.com/rany2/edge-tts)）/ BigInt-based JavaScript port (from [rany2/edge-tts](https://github.com/rany2/edge-tts))
- ✅ 通过所有 7 个测试向量 / Passes all 7 test vectors

#### 3. **Chrome User-Agent 改写 / Chrome User-Agent Rewrite**
- 🔧 使用 `declarativeNetRequest` 将 Chrome UA 改写为 Edge UA / Uses `declarativeNetRequest` to rewrite Chrome UA to Edge UA
- ⚠️ **必需**：Microsoft 服务器对非 Edge 浏览器返回 HTTP 403 / **Required**: Microsoft server returns HTTP 403 for non-Edge browsers
- 🎯 仅针对 `speech.platform.bing.com` 的 WebSocket 请求 / Only for WebSocket requests to `speech.platform.bing.com`

#### 4. **默认 Edge 语音列表 / Default Edge Voice List**
- 📝 实时从 Microsoft 端点获取语音列表 / Live voice list fetched from Microsoft endpoint
- 🔄 每 24 小时刷新一次 / Refreshed every 24 hours

### 📌 重要声明 / Important Notice

- **仅供个人学习和使用** / **For personal learning and use only**
- **非 Microsoft 官方认可** / **Not affiliated with or endorsed by Microsoft**
- **不保证稳定性和可用性** / **No guarantee of stability or availability**
- **此 fork 的更改不会向上游贡献** / **Changes in this fork are not intended for upstream contribution**
  - 除非所有者另有决定 / Unless the owner decides otherwise in the future

---

## 🚀 安装 / Installation

### 方法 1：从 Releases 安装 / Method 1: Install from Releases

1. 访问 [Releases 页面](https://github.com/tyrad/read-aloud/releases) / Visit [Releases page](https://github.com/tyrad/read-aloud/releases)
2. 下载最新的 `read-aloud-chrome-edge-tts.zip` / Download the latest `read-aloud-chrome-edge-tts.zip`
3. 解压缩 ZIP 文件 / Extract the ZIP file
4. 在 Chrome 打开 `chrome://extensions/` / Open `chrome://extensions/` in Chrome
5. 启用"开发者模式" / Enable "Developer mode"
6. 点击"加载已解压的扩展程序" / Click "Load unpacked"
7. 选择解压后的文件夹 / Select the extracted folder

### 方法 2：从源码构建 / Method 2: Build from Source

```bash
# 克隆仓库 / Clone repository
git clone https://github.com/tyrad/read-aloud.git
cd read-aloud

# 安装依赖 / Install dependencies
npm install

# 运行测试（可选）/ Run tests (optional)
npm test

# 打包扩展 / Package extension
npm run package -- --browser=chrome

# 输出位于 / Output in:
# build/read-aloud-chrome-2.25.0.zip
```

---

## 🎯 使用 Edge TTS 语音 / Using Edge TTS Voices

### 选择语音 / Select Voice

1. 点击浏览器工具栏上的 Read Aloud 图标 / Click the Read Aloud icon in the browser toolbar
2. 点击设置（齿轮图标）/ Click Settings (gear icon)
3. 在语音列表中选择以 "Edge" 开头的语音 / Select a voice starting with "Edge" in the voice list
   - 例如 / For example: `Edge Xiaoxiao (Chinese (Simplified, PRC))`

### 测试 DRM 实现 / Test DRM Implementation

```bash
# 运行独立测试脚本 / Run standalone test script
node test-edge-drm.js

# 预期输出 / Expected output:
# ✅ 1729900000: PASS
# ✅ 1730000000: PASS
# ... (7 vectors, all passing)
```

---

## 📚 技术文档 / Technical Documentation

详细的技术实现文档请参见：/ For detailed technical documentation, see:

- [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) - 完整实现总结 / Complete implementation summary
- [QUICKSTART.md](QUICKSTART.md) - 快速开始指南 / Quick start guide
- [docs/EDGE_TTS.md](docs/EDGE_TTS.md) - Edge TTS 集成说明 / Edge TTS integration guide
- [docs/EDGE_TTS_DRM_FIX.md](docs/EDGE_TTS_DRM_FIX.md) - DRM 修复详情 / DRM fix details
- [Pull Request #1](https://github.com/tyrad/read-aloud/pull/1) - 原始实现 PR / Original implementation PR

---

## 🔗 链接 / Links

- **上游项目 / Upstream Project**: [ken107/read-aloud](https://github.com/ken107/read-aloud)
- **官方 Chrome 扩展 / Official Chrome Extension**: [Chrome Web Store](https://chromewebstore.google.com/detail/read-aloud-a-text-to-spee/hdhinadidafjejdhmfkjgnolgimiaplp)
- **官方 Firefox 扩展 / Official Firefox Addon**: [Mozilla Add-ons](https://addons.mozilla.org/en-US/firefox/addon/read-aloud/)
- **官方网站 / Official Website**: [readaloud.app](https://readaloud.app/)
- **DRM 参考实现 / DRM Reference**: [rany2/edge-tts](https://github.com/rany2/edge-tts) (Python)

---

## ⚙️ 技术实现细节 / Technical Implementation Details

### 核心组件 / Core Components

#### 1. `js/sec-ms-gec.js` - DRM Token Generator
```javascript
// 生成 Sec-MS-GEC v2 token / Generate Sec-MS-GEC v2 token
const { generateSecMsGecV2 } = require('./js/sec-ms-gec.js')
const token = generateSecMsGecV2(Date.now() / 1000)
// 格式 / Format: "8350A5B1232C2B03-103B2FE3AC01F6E41589E122B054FEAA29908FF87A67426A52501CBAD60BCE89"
```

- **BigInt 实现** / **BigInt implementation**: 避免 JavaScript Number 的精度问题 / Avoids JavaScript Number precision issues
- **CS64 + SHA256**: 自定义 64 位校验和 + 标准 SHA-256 / Custom 64-bit checksum + standard SHA-256
- **5 分钟刷新** / **5-minute refresh**: Token 每 300 秒自动更新 / Token auto-refreshes every 300 seconds

#### 2. `background.js` - User-Agent Rewrite
```javascript
chrome.declarativeNetRequest.updateDynamicRules({
  addRules: [{
    action: {
      type: "modifyHeaders",
      requestHeaders: [{
        header: "User-Agent",
        value: "Mozilla/5.0 (...) Edg/143.0.0.0"  // 伪装为 Edge / Masquerade as Edge
      }]
    },
    condition: {
      urlFilter: "||speech.platform.bing.com/",
      resourceTypes: ["websocket", "xmlhttprequest", "other"]
    }
  }]
})
```

#### 3. `js/tts-engines.js` - EdgeTtsEngine
- WebSocket 连接到 `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1`
- SSML 格式文本输入 / SSML format text input
- 二进制音频帧解析（2 字节大端头 + 音频数据）/ Binary audio frame parsing (2-byte big-endian header + audio data)

### 权限要求 / Required Permissions

```json
{
  "permissions": [
    "declarativeNetRequestWithHostAccess",  // 用于 UA 改写 / For UA rewrite
    "storage",                              // 用于缓存语音列表 / For caching voice list
    ...
  ],
  "host_permissions": [
    "https://speech.platform.bing.com/"     // Edge TTS 端点 / Edge TTS endpoint
  ]
}
```

---

## 🐛 已知问题 / Known Issues

1. **仅支持基于 Chromium 的浏览器** / **Chromium-based browsers only**
   - Firefox 不支持 Manifest V3 的 `declarativeNetRequest` / Firefox doesn't support Manifest V3 `declarativeNetRequest`

2. **非官方 API** / **Unofficial API**
   - Microsoft 可能随时更改端点或阻止访问 / Microsoft may change endpoint or block access at any time
   - 不保证长期可用性 / No long-term availability guarantee

3. **WebSocket 连接限制** / **WebSocket Connection Limits**
   - 每个连接最多合成 30 秒音频 / Maximum 30 seconds of audio per connection
   - 长文本自动分段处理 / Long text automatically segmented

---

## 🧪 测试 / Testing

```bash
# 运行所有测试 / Run all tests
npm test

# 快速 DRM 测试 / Quick DRM test
node test-edge-drm.js

# 测试单个时间戳 / Test single timestamp
node test-edge-drm.js 1729900000.0
```

**测试覆盖率 / Test Coverage:**
- ✅ 155 项测试全部通过 / All 155 tests passing
- ✅ 7 个 DRM 向量测试 / 7 DRM vector tests
- ✅ Edge TTS 集成测试 / Edge TTS integration tests

---

## 📦 打包 / Packaging

```bash
# Chrome/Edge
npm run package -- --browser=chrome

# 输出 / Output:
# build/read-aloud-chrome-2.25.0.zip
```

---

## 🙏 致谢 / Credits

### 上游项目 / Upstream Project
- **[ken107/read-aloud](https://github.com/ken107/read-aloud)** by [@ken107](https://github.com/ken107) - 原始 Read Aloud 扩展 / Original Read Aloud extension
- All [upstream contributors](https://github.com/ken107/read-aloud/graphs/contributors)

### DRM 实现参考 / DRM Implementation Reference
- **[rany2/edge-tts](https://github.com/rany2/edge-tts)** by [@rany2](https://github.com/rany2) - Python Edge TTS with Sec-MS-GEC v2

### Images / 图像
- [Streamline Labs](https://lab.streamlineicons.com/)
- [Freepik](https://www.freepik.com/free-vector/colorful-memphis-design-background-vector_3893585.htm)

---

## 📄 许可 / License

Same as upstream [ken107/read-aloud](https://github.com/ken107/read-aloud): [GPL-3.0](LICENSE)

---

## ⚠️ 免责声明 / Disclaimer

**English:**
This fork is an independent personal project and is not affiliated with, endorsed by, or associated with Microsoft Corporation or the original Read Aloud project. The Microsoft Edge TTS integration uses unofficial endpoints and may stop working at any time if Microsoft changes their API or implements additional restrictions. Use at your own risk.

**中文：**
此分支是独立的个人项目，与 Microsoft Corporation 或原始 Read Aloud 项目无关联、无背书、无关系。Microsoft Edge TTS 集成使用非官方端点，如果 Microsoft 更改其 API 或实施额外限制，可能随时停止工作。使用风险自负。

---

<div align="center">
	<sub>
		Fork maintained by <a href="https://github.com/tyrad">@tyrad</a><br>
		Original project by <a href="https://github.com/ken107">Hai Phan</a> and <a href="https://github.com/ken107/read-aloud/graphs/contributors">contributors</a>
	</sub>
</div>
