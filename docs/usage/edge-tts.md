# Using Edge TTS Voices

Microsoft Edge TTS provides free, high-quality neural voices without requiring an API key.

## Quick Start

Edge TTS voices are **enabled by default** and require no setup. Simply:

1. Click the Read Aloud extension icon
2. Open Settings (⚙️)
3. Select a voice starting with "Edge"
4. Start reading!

## Example Voices

### Chinese Voices

**Mandarin (Mainland China)**
- **Edge Xiaoxiao** (Female) - Natural, friendly tone
- **Edge Yunyang** (Male) - Professional, clear pronunciation
- **Edge Xiaoyi** (Female) - Warm, expressive
- **Edge Yunxi** (Male) - Steady, calm

**Cantonese (Hong Kong)**
- **Edge HiuGaai** (Female)
- **Edge WanLung** (Male)

**Taiwanese Mandarin**
- **Edge HsiaoChen** (Female)
- **Edge YunJhe** (Male)

### English Voices

**United States**
- **Edge Aria** (Female) - News anchor style
- **Edge Jenny** (Female) - Friendly, conversational
- **Edge Guy** (Male) - Deep, authoritative
- **Edge Davis** (Male) - Professional, clear
- **Edge Sara** (Female) - Warm, approachable
- **Edge Tony** (Male) - Casual, friendly

**United Kingdom**
- **Edge Sonia** (Female) - British RP accent
- **Edge Ryan** (Male) - British RP accent

**Australia**
- **Edge Natasha** (Female)
- **Edge William** (Male)

**Canada**
- **Edge Clara** (Female)
- **Edge Liam** (Male)

## Voice Selection Tips

### For Chinese Content

1. **Mainland websites**: Choose `Edge Xiaoxiao` or `Edge Yunyang`
2. **Hong Kong sites**: Choose `Edge HiuGaai` or `Edge WanLung`
3. **Taiwan sites**: Choose `Edge HsiaoChen` or `Edge YunJhe`

The extension will also auto-select appropriate voices based on page language.

### For English Content

1. **News/articles**: `Edge Aria` (US) or `Edge Sonia` (UK)
2. **Casual reading**: `Edge Jenny` or `Edge Tony`
3. **Professional content**: `Edge Guy` or `Edge Davis`

### Voice Characteristics

| Voice | Gender | Style | Best For |
|-------|--------|-------|----------|
| Xiaoxiao | Female | Friendly, natural | General content, stories |
| Yunyang | Male | Professional | News, formal articles |
| Aria | Female | News anchor | News, announcements |
| Guy | Male | Deep, authoritative | Technical docs, serious content |
| Jenny | Female | Conversational | Blogs, casual articles |

## Comparison with Other Engines

### vs. Browser Native Voices

| Feature | Edge TTS | Browser Native |
|---------|----------|----------------|
| Quality | ★★★★★ High (Neural) | ★★★☆☆ Medium |
| Languages | 40+ | Varies by browser |
| Setup | None | Pre-installed |
| Latency | ~1-2s first use | Instant |
| Caching | Yes | Varies |

### vs. Azure TTS (Paid)

| Feature | Edge TTS (Free) | Azure TTS (Paid) |
|---------|-----------------|------------------|
| API Key | ❌ Not required | ✅ Required |
| Cost | 💰 Free | 💰 $4-16 per 1M chars |
| Quality | ★★★★★ High | ★★★★★ High |
| Voices | 100+ | 300+ |
| SLA | ❌ None | ✅ Official support |
| Recommended for | Personal use | Commercial/production |

### vs. Google Translate TTS

| Feature | Edge TTS | Google Translate |
|---------|----------|------------------|
| Quality | ★★★★★ Neural | ★★★☆☆ Basic |
| Setup | None | None |
| Languages | 40+ | 100+ |
| Character limit | ~5000/chunk | ~200/chunk |

## Advanced Usage

### Preferred Voices by Language

You can set different Edge voices as preferred for different languages:

1. Settings → Voice
2. Select an Edge voice
3. Read content in that language
4. The extension remembers your preference

Example:
- Chinese (`zh-CN`) → `Edge Xiaoxiao`
- English (`en-US`) → `Edge Aria`

### Mixed-Language Content

For pages with mixed Chinese and English:

1. Enable auto-voice-selection
2. The extension will attempt to detect language per paragraph
3. Or manually select a bilingual-capable voice

## Performance Tips

### Caching

- Audio is cached after first synthesis
- Re-reading the same text is instant
- Cache cleared when extension updates

### Prefetching

- Next text segment is fetched in advance
- Reduces pauses between paragraphs
- Works best with longer articles

### Network

- First connection takes 1-2 seconds
- Subsequent requests are faster (persistent connection)
- Works offline? No - requires internet connection

## Limitations

### Character Limits

- Recommended: < 1000 characters per segment
- Maximum: ~5000 characters (not hard-limited)
- Very long segments may timeout (30s limit)

### Rate Limiting

- No known rate limits
- Intended for personal use
- Avoid automated bulk synthesis

### Service Availability

⚠️ **Important**: This is an **unofficial** feature using Microsoft Edge's Read Aloud service:

- May stop working if Microsoft changes the endpoint
- No uptime guarantee
- Voice list may change without notice
- For production use, consider official Azure TTS

## Troubleshooting

### "Voice not found" Error

**Solution**: 
1. Reload the extension
2. Check voice list refreshed (24h cache)
3. Fallback to browser native voices if persistent

### Audio Stuttering

**Causes**:
- Slow internet connection
- Long text segments
- High browser CPU usage

**Solutions**:
- Reduce text chunk size in settings
- Close unused tabs
- Wait for prefetch to complete

### Wrong Language/Accent

**Issue**: English voice reading Chinese text (or vice versa)

**Solution**:
1. Manually select correct voice
2. Check page language detection
3. Some voices support multiple languages (e.g., multilingual models)

## Privacy Considerations

### What is Sent to Microsoft

When using Edge TTS:
- Text content you want synthesized
- Selected voice name
- Your IP address (standard for any web request)

### What is NOT Sent

- Your browsing history
- Other page content
- Personal information (unless in the text itself)

### Data Storage

- Audio is cached locally in browser
- No cloud storage of your voice data
- Cache cleared when you clear browser data

## Feedback and Issues

### Reporting Problems

If Edge TTS isn't working:

1. Check browser console (F12) for errors
2. Verify `speech.platform.bing.com` is accessible
3. Try a browser native voice to isolate issue
4. Report on GitHub with console errors

### Feature Requests

Suggestions for Edge TTS improvements:
- Voice quality feedback
- Additional languages
- Performance optimizations

## See Also

- [Edge TTS Documentation](../EDGE_TTS.md) - Technical details
- [Testing Guide](../TESTING_EDGE_TTS.md) - For developers
- [Premium Voices Guide](premium-voices.md) - Azure TTS setup
- [GitHub Issue #391](https://github.com/ken107/read-aloud/issues/391) - Original feature request
