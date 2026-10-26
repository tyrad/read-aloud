# Testing Edge TTS Support

This guide helps you test the new Microsoft Edge TTS feature.

## Quick Start

### 1. Load the Extension

#### Chrome/Edge/Chromium-based browsers

```bash
# From the repository root:
npm run package -- --browser=chrome
```

Then:
1. Open `chrome://extensions` (or `edge://extensions`)
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the repository root directory
   - Or drag the generated `build/read-aloud-chrome-2.25.0.zip` onto the page

#### Firefox

```bash
npm run package -- --browser=firefox
```

Then:
1. Type `about:debugging` in the address bar
2. Click "This Firefox"
3. Click "Load Temporary Add-on"
4. Select the `manifest.json` file from the repository root
   - Or the packaged `.zip` file

### 2. Verify Edge Voices Appear

1. Click the Read Aloud extension icon (in the toolbar or extensions menu)
2. Click the **gear icon** (⚙️) to open Settings
3. Click the **Voice** dropdown
4. Look for voices prefixed with **"Edge"**:
   - `Edge Xiaoxiao - Chinese (Mainland)`
   - `Edge Aria - English (United States)`
   - etc.

**Expected**: You should see multiple Edge voices in the list.

**If voices don't appear**: Check the browser console (F12) for errors related to voice loading.

### 3. Test Speech Synthesis

#### Method A: Right-click menu

1. Navigate to any webpage (e.g., Wikipedia, news site)
2. Select some text
3. Right-click → **Read Aloud**
4. The extension popup should appear and start reading

#### Method B: Extension popup

1. Navigate to any webpage
2. Click the Read Aloud extension icon
3. Click the **Play** button (▶️)
4. The page content should start being read aloud

**Expected**: Audio should play using the selected Edge voice.

### 4. Test Voice Selection

1. Open Settings (gear icon)
2. Change the Voice to an Edge voice (e.g., "Edge Xiaoxiao - Chinese (Mainland)")
3. Close settings
4. Play some text
5. Verify the voice sounds correct

**Try different voices**:
- Chinese voices: Xiaoxiao (female), Yunyang (male)
- English voices: Aria (female), Guy (male)

### 5. Test Language Auto-detection

1. Navigate to a Chinese webpage (e.g., https://zh.wikipedia.org)
2. Click the extension icon → Play
3. With auto-voice-selection enabled, it should pick an Edge Chinese voice

**Expected**: Chinese text should be read with a Chinese voice.

## Testing Scenarios

### Scenario 1: Voice List Loading

**Purpose**: Verify voice list loads from Microsoft's API

**Steps**:
1. Open browser DevTools (F12)
2. Go to Application → Storage → Clear site data (for the extension)
3. Reload the extension
4. Open Settings → Voice dropdown
5. Check Network tab for request to `speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list`

**Expected**: 
- Network request succeeds (200 OK)
- Voice list populates with many Edge voices (50+)

**Fallback Test**:
- If network request fails, default voices (26) should still appear

### Scenario 2: Audio Caching

**Purpose**: Verify audio is cached for performance

**Steps**:
1. Select and play the same text twice
2. Check Network tab in DevTools

**Expected**: 
- First playback: WebSocket connection to speech.platform.bing.com
- Second playback: No new network requests (audio served from cache)

### Scenario 3: Engine Coexistence

**Purpose**: Verify Edge TTS doesn't break other engines

**Test with each engine**:
- Browser native TTS (voices without any prefix)
- Google Translate (prefix "GoogleTranslate")
- Azure TTS (if configured, prefix "Azure")
- OpenAI (if configured, prefix "OpenAI")

**Steps**:
1. Select a voice from each engine type
2. Play text
3. Verify audio plays correctly

**Expected**: All engines should work independently.

### Scenario 4: Long Text

**Purpose**: Test WebSocket stability with longer content

**Steps**:
1. Navigate to a long article (e.g., Wikipedia article)
2. Select an Edge voice
3. Click Play to read the entire page

**Expected**: 
- Audio should play continuously
- No WebSocket timeouts (30s timeout per chunk)
- Prefetching should improve playback smoothness

### Scenario 5: Edge vs Azure Voice Distinction

**Purpose**: Ensure users can differentiate free Edge voices from paid Azure voices

**Setup**:
- If you have Azure credentials configured, voices from both services will appear

**Steps**:
1. Open voice dropdown
2. Compare voice names

**Expected**:
- Edge voices: `Edge Xiaoxiao - Chinese (Mainland)`
- Azure voices: `Azure Chinese (Simplified, PRC) - Xiaoxiao`
- Clear visual distinction with "Edge" prefix

## Troubleshooting

### Issue: No Edge voices appear

**Check**:
1. Browser console errors (F12 → Console)
2. Network tab: requests to `speech.platform.bing.com` blocked?
3. Extension has host permissions (manifest.json includes speech.platform.bing.com)

**Resolution**:
- Ensure network access to speech.platform.bing.com
- Check corporate firewall/proxy settings
- Default voices (26) should appear even if API fails

### Issue: Audio doesn't play

**Check**:
1. Console errors mentioning WebSocket
2. Network tab: WebSocket connection to speech.platform.bing.com
3. Audio permissions in browser

**Resolution**:
- Test with browser native voices first
- Verify WebSocket connections not blocked
- Check browser audio isn't muted

### Issue: WebSocket timeout

**Symptoms**: "WebSocket timeout" error after 30 seconds

**Causes**:
- Very long text segment
- Slow network connection
- Service temporarily unavailable

**Resolution**:
- Try shorter text segments
- Check network latency to Microsoft servers
- Retry later if service is down

### Issue: Voice quality unexpected

**Note**: Edge TTS voices are neural voices from Microsoft, same quality as Azure TTS. However:
- Voice characteristics may differ from Azure versions
- Microsoft may update voices without notice
- Some voices may be regional variants

**Verification**:
- Compare with Microsoft Edge browser's native Read Aloud feature
- Edge TTS should sound identical to Edge browser's voices

## Developer Testing

### Console Logging

Add logging to trace execution:

```javascript
// In EdgeTtsEngine.speak()
console.log("Edge TTS: Synthesizing", text.substring(0, 50), "with voice", voiceName)

// In pickEngine()
console.log("Selected engine:", engine.constructor.name)
```

### Network Inspection

**Voice list fetch**:
```
GET https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list?trustedclienttoken=6A5AA1D4EAFF4E9FB37E23D68491D6F4
```

**WebSocket connection**:
```
WSS wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=...&ConnectionId=...
```

### Testing Edge Cases

1. **Empty text**: Should handle gracefully (no-op or error)
2. **Very long text** (>5000 chars): Should complete without timeout
3. **Special characters**: XML entities should be escaped properly
4. **Rapid voice switching**: Should cancel previous synthesis
5. **Offline mode**: Should fail gracefully, not crash

## Performance Expectations

- **Voice list loading**: < 2 seconds
- **First synthesis**: 1-3 seconds (WebSocket connection + synthesis)
- **Cached synthesis**: < 100ms (from cache)
- **Prefetch**: Next chunk should be ready before current finishes

## Reporting Issues

When reporting issues, include:

1. Browser and version
2. Operating system
3. Console errors (F12 → Console)
4. Network tab screenshot (if connection-related)
5. Voice selected
6. Text being synthesized (first 100 characters)
7. Steps to reproduce

## Success Criteria

✅ Edge voices appear in voice list
✅ Audio plays correctly with Edge voices
✅ Other engines (Browser, Azure, OpenAI) still work
✅ Voice list loads or falls back to defaults
✅ Audio is cached for repeat playback
✅ UI shows Edge TTS information card
✅ No console errors during normal operation
✅ Extension packages successfully

If all criteria are met, the feature is working as expected!
