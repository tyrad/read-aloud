# Microsoft Edge TTS Support

## Overview

This fork adds free Microsoft Edge Text-to-Speech (TTS) support to the Read Aloud extension. Unlike the paid Azure Cognitive Services TTS, Edge TTS requires **no API key or subscription** and provides high-quality neural voices.

## Features

- ✅ **No API key required** - Works out of the box
- ✅ **High-quality neural voices** - Same quality as Microsoft Azure TTS
- ✅ **Extensive language support** - Including Chinese (Mandarin, Cantonese, Taiwan), English (US, UK, Australia, Canada), and many more
- ✅ **Free to use** - No cost or usage limits
- ✅ **Easy voice selection** - Edge voices appear in the voice picker with "Edge" prefix

## How It Works

Edge TTS uses the same speech synthesis service that powers Microsoft Edge's built-in "Read Aloud" feature. This implementation:

1. Connects to the Edge TTS WebSocket endpoint at `speech.platform.bing.com`
2. Sends text with the selected voice name
3. Receives synthesized audio in MP3 format
4. Plays the audio through the extension's audio player

## Usage

### Voice Selection

1. Click the Read Aloud extension icon
2. Open Settings (gear icon)
3. In the voice dropdown, look for voices prefixed with "Edge"
   - Example: "Edge Xiaoxiao - Chinese (Mainland)"
   - Example: "Edge Aria - English (United States)"

### Automatic Voice Loading

- Edge TTS voices are enabled by default
- The voice list is automatically fetched from Microsoft's service
- If fetching fails, a curated list of popular voices is available as fallback

## Available Voices (Default Set)

### Chinese
- **zh-CN** (Mainland): Xiaoxiao, Yunyang, Xiaoyi, Yunjian, Yunxi, Yunxia
- **zh-HK** (Hong Kong): HiuGaai, WanLung
- **zh-TW** (Taiwan): HsiaoChen, YunJhe

### English
- **en-US** (United States): Aria, Jenny, Guy, Davis, Jane, Jason, Sara, Tony
- **en-GB** (United Kingdom): Sonia, Ryan
- **en-AU** (Australia): Natasha, William
- **en-CA** (Canada): Clara, Liam

*Note: Many more voices are available when the full voice list is successfully fetched from Microsoft's servers.*

## Technical Details

### Architecture

The Edge TTS engine (`EdgeTtsEngine`) follows the same pattern as other TTS engines in the extension:

- **`speak()`**: Synthesizes text and returns an audio URL
- **`prefetch()`**: Pre-caches audio for the next text segment
- **`getVoices()`**: Returns available Edge TTS voices

### Voice Caching

- Synthesized audio is cached to improve performance
- Cache uses the same mechanism as other TTS engines
- Audio blobs are automatically cleaned up when no longer needed

### Endpoint and Protocol

- **WebSocket URL**: `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1`
- **Voice List URL**: `https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list`
- **Audio Format**: MP3 (audio/mpeg)
- **Protocol**: Custom WebSocket protocol with SSML payload
- **DRM**: Requires Sec-MS-GEC v2 token (CS64+SHA256 digest) and Sec-MS-GEC-Version header

#### DRM Token (Sec-MS-GEC v2)

As of October 2026, Microsoft requires a cryptographic token for all Edge TTS requests:

- **Format**: `<16 hex CS64>-<64 hex SHA256>` (e.g., `8350A5B1232C2B03-103B2FE3AC...`)
- **Algorithm**: Custom CS64 checksum + modified SHA-256 digest
- **Input**: Unix timestamp (rounded to 300s) + Windows epoch + TrustedClientToken
- **Header**: `Sec-MS-GEC-Version: 2-<chromium-version>` (e.g., `2-143.0.3650.75`)

The token generation is implemented in pure JavaScript without external dependencies. The algorithm was reverse-engineered from Microsoft Edge's Read Aloud feature.

## Differences from Azure TTS

| Feature | Edge TTS (Free) | Azure TTS (Paid) |
|---------|-----------------|------------------|
| API Key | Not required | Required |
| Cost | Free | Pay per character |
| Voice Quality | High (Neural) | High (Neural) |
| Voice Selection | Automatic | Manual configuration |
| Usage Limits | None (unofficial) | Based on subscription |
| SLA/Support | None (community) | Official Microsoft support |

## Important Notes

### Unofficial Service

⚠️ **This is an unofficial community feature** that uses Microsoft Edge's Read Aloud service endpoint. It is not officially supported by Microsoft and:

- May stop working at any time if Microsoft changes the service
- Should be used for personal, non-commercial purposes
- Has no service level agreement (SLA)
- Voice availability may change without notice

### Compared to Azure Integration

The extension already supports official Azure Cognitive Services TTS (the `AzureTtsEngine`), which requires:
- An Azure subscription
- A Speech Service resource
- API key and region configuration

Edge TTS is completely separate from Azure TTS and works independently without any Azure credentials.

## Troubleshooting

### Voices Not Appearing

1. Check browser console for errors
2. Ensure `https://speech.platform.bing.com/` is accessible
3. If voice list fetch fails, default voices should still work

### Audio Not Playing

1. Verify the selected voice name is correct
2. Check network connectivity
3. Ensure WebSocket connections are not blocked by firewall/proxy
4. Look for errors in browser console

### WebSocket Timeout

- Default timeout is 30 seconds
- If synthesis takes too long, try shorter text segments
- Check network latency to Microsoft servers

## Implementation Reference

This implementation is based on the community Python package [`edge-tts`](https://github.com/rany2/edge-tts) by rany2, which reverse-engineered Microsoft Edge's Read Aloud protocol.

Key implementation files:
- `js/tts-engines.js` - EdgeTtsEngine class
- `js/defaults.js` - isEdgeVoice() predicate and voice loading
- `js/speech.js` - Engine routing in pickEngine()
- `manifest.json` - Host permissions for speech.platform.bing.com

## Credits

- Original Edge TTS protocol reverse engineering: [rany2/edge-tts](https://github.com/rany2/edge-tts)
- Feature request: [ken107/read-aloud#391](https://github.com/ken107/read-aloud/issues/391)
- Implementation: This fork
