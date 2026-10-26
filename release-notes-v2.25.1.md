# v2.25.1-edge.1: Fix WebSocket Error on Same-Version Reload

## 🐛 Bug Fix / 问题修复

**Fixes "WebSocket error: Unknown" when User-Agent rule was not registered after same-version unpacked reload.**

**修复同版本重载后未注册 User-Agent 规则导致的 "WebSocket error: Unknown" 错误。**

---

## 🔍 Problem / 问题描述

### Symptoms / 症状
- ✅ Voice list loads successfully / 语音列表加载成功
- ✅ Edge voices show in dropdown / Edge 语音显示在下拉列表中
- ❌ **Speak fails with "WebSocket error: Unknown"** / **朗读失败，显示 "WebSocket error: Unknown"**

### Root Cause / 根本原因
In v2.25.0-edge.1, the `declarativeNetRequest` User-Agent rewrite rule was only registered inside `chrome.runtime.onInstalled`:

在 v2.25.0-edge.1 中，`declarativeNetRequest` User-Agent 改写规则仅在 `chrome.runtime.onInstalled` 中注册：

```javascript
// 旧代码 / Old code (v2.25.0-edge.1)
chrome.runtime.onInstalled.addListener(() => {
  chrome.declarativeNetRequest.updateDynamicRules({ ... })
})
```

**Issue / 问题**: When reloading an unpacked extension with the **same manifest version** (e.g., during development or after re-extracting the same zip), Chrome does **not** fire `onInstalled` again, so the Edge User-Agent rule never gets registered.

**问题**：当使用**相同的 manifest 版本号**重新加载解压扩展时（例如开发过程中或重新解压相同的 zip），Chrome **不会**再次触发 `onInstalled`，因此 Edge User-Agent 规则永远不会被注册。

**Result / 结果**:
- ❌ Missing User-Agent rule → Microsoft server returns HTTP 403 for WebSocket → UI shows "WebSocket error: Unknown"
- ❌ 缺少 User-Agent 规则 → Microsoft 服务器对 WebSocket 返回 HTTP 403 → UI 显示 "WebSocket error: Unknown"
- ✅ Voice list HTTP endpoint is more lenient (doesn't require Edge UA) → list still loads
- ✅ 语音列表 HTTP 端点更宽松（不需要 Edge UA）→ 列表仍然可以加载

---

## ✅ Solution / 解决方案

### Changes in v2.25.1-edge.1 / v2.25.1-edge.1 的更改

#### 1. **Register DNR rule on every service worker startup** / **在每次 service worker 启动时注册 DNR 规则**

```javascript
// 新代码 / New code (v2.25.1-edge.1)
async function ensureEdgeTtsUserAgentRule() {
  if (!chrome.declarativeNetRequest) return
  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [880901],
      addRules: [{
        id: 880901,  // Stable unique ID / 稳定的唯一 ID
        priority: 1,
        action: {
          type: "modifyHeaders",
          requestHeaders: [{
            header: "User-Agent",
            operation: "set",
            value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0"
          }]
        },
        condition: {
          urlFilter: "||speech.platform.bing.com/",
          resourceTypes: ["websocket", "xmlhttprequest", "other"]
        }
      }]
    })
  }
  catch (err) {
    console.error("Failed to register Edge TTS User-Agent rule:", err)
  }
}

// Call on service worker startup / 在 service worker 启动时调用
ensureEdgeTtsUserAgentRule()

// Also call on install/update / 同时在安装/更新时调用
chrome.runtime.onInstalled.addListener(() => {
  ensureEdgeTtsUserAgentRule()
})
```

#### 2. **Bump manifest version to 2.25.1** / **提升 manifest 版本到 2.25.1**
- Ensures `onInstalled` fires for existing v2.25.0 installs / 确保现有 v2.25.0 安装会触发 `onInstalled`
- Triggers automatic update for users who installed from previous release / 为从之前版本安装的用户触发自动更新

---

## 📦 Installation / 安装

### Option 1: Update from v2.25.0-edge.1 / 从 v2.25.0-edge.1 更新

If you already installed v2.25.0-edge.1:

如果您已经安装了 v2.25.0-edge.1：

1. Download `read-aloud-chrome-edge-tts.zip` from this release / 从此版本下载 `read-aloud-chrome-edge-tts.zip`
2. Extract the zip / 解压缩 zip 文件
3. In Chrome, go to `chrome://extensions/` / 在 Chrome 中打开 `chrome://extensions/`
4. Click "Remove" on the old version / 点击旧版本的"移除"
5. Enable "Developer mode" / 启用"开发者模式"
6. Click "Load unpacked" / 点击"加载已解压的扩展程序"
7. Select the extracted folder / 选择解压后的文件夹

### Option 2: Fresh Install / 全新安装

1. Download `read-aloud-chrome-edge-tts.zip` from assets below / 从下方资源下载 `read-aloud-chrome-edge-tts.zip`
2. Extract the zip / 解压缩 zip 文件
3. In Chrome, open `chrome://extensions/` / 在 Chrome 中打开 `chrome://extensions/`
4. Enable "Developer mode" / 启用"开发者模式"
5. Click "Load unpacked" / 点击"加载已解压的扩展程序"
6. Select the extracted folder / 选择解压后的文件夹

---

## ✅ Verification / 验证

After installing v2.25.1-edge.1, Edge TTS should work correctly:

安装 v2.25.1-edge.1 后，Edge TTS 应该可以正常工作：

1. ✅ Voice list loads (Edge voices appear) / 语音列表加载（Edge 语音出现）
2. ✅ **Speak button works without "WebSocket error"** / **朗读按钮可以正常工作，没有 "WebSocket error"**
3. ✅ Audio plays through speakers / 音频通过扬声器播放

### Test Steps / 测试步骤
1. Open any webpage / 打开任意网页
2. Select text / 选择文本
3. Right-click → "Read Aloud" / 右键 → "Read Aloud"
4. In settings, select an Edge voice (e.g., "Edge Xiaoxiao") / 在设置中选择 Edge 语音（例如 "Edge Xiaoxiao"）
5. Click Play / 点击播放
6. ✅ Should hear audio / 应该能听到音频
7. ❌ Should NOT see "WebSocket error: Unknown" / 不应看到 "WebSocket error: Unknown"

---

## 🔗 Related Links / 相关链接

- **Previous Release**: [v2.25.0-edge.1](https://github.com/tyrad/read-aloud/releases/tag/v2.25.0-edge.1)
- **Upstream Project**: [ken107/read-aloud](https://github.com/ken107/read-aloud)
- **DRM Reference**: [rany2/edge-tts](https://github.com/rany2/edge-tts)

---

## 📝 Changelog / 更新日志

### Fixed / 修复
- ✅ **DNR User-Agent rule now registers on every service worker startup** / **DNR User-Agent 规则现在在每次 service worker 启动时注册**
- ✅ **No more "WebSocket error: Unknown" after same-version reload** / **同版本重载后不再出现 "WebSocket error: Unknown"**
- ✅ **Stable rule ID 880901 (instead of 1)** / **稳定的规则 ID 880901（而不是 1）**
- ✅ **Error handling with try/catch** / **添加 try/catch 错误处理**

### Changed / 更改
- ✅ **Manifest version bumped to 2.25.1** / **Manifest 版本提升到 2.25.1**

---

## ⚠️ Important Notes / 重要说明

- ⚠️ **Unofficial API** / **非官方 API**: Uses unofficial Microsoft endpoint / 使用非官方 Microsoft 端点
- ⚠️ **May Break** / **可能失效**: Microsoft may change or block access at any time / Microsoft 可能随时更改或阻止访问
- ⚠️ **Personal Use Only** / **仅供个人使用**: Not affiliated with Microsoft / 与 Microsoft 无关联

---

## 🙏 Credits / 致谢

Thanks to the user who reported the WebSocket error on Mac Chrome, enabling us to identify and fix this critical bug.

感谢在 Mac Chrome 上报告 WebSocket 错误的用户，使我们能够识别并修复此关键 bug。

---

**Commit SHA**: `7be3454`  
**Tag**: `v2.25.1-edge.1`  
**Release Date**: 2026-10-26

---

<div align="center">
  <sub>
    Fork maintained by <a href="https://github.com/tyrad">@tyrad</a><br>
    Original project by <a href="https://github.com/ken107">Hai Phan</a>
  </sub>
</div>
