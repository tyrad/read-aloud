try {
  importScripts(
    "js/rxjs.umd.min.js",
    "js/defaults.js",
    "js/messaging.js",
    "js/content-handlers.js",
    "js/offscreen-manager.js",
    "js/reader-manager.js",
    "js/events.js"
  )
}
catch (err) {
  console.error(err)
}

async function ensureEdgeTtsUserAgentRule() {
  if (!chrome.declarativeNetRequest) return
  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [880901],
      addRules: [{
        id: 880901,
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

ensureEdgeTtsUserAgentRule()

chrome.runtime.onInstalled.addListener(() => {
  ensureEdgeTtsUserAgentRule()
})
