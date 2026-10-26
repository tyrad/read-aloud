#!/usr/bin/env node
/**
 * Test wangwangit/tts style Edge TTS synthesis via HTTP POST
 * No WebSocket, no Sec-MS-GEC for synthesis (only for voice list)
 */

const crypto = require('crypto');
const fs = require('fs');

// HMAC signature for X-MT-Signature header
async function sign(urlStr) {
  const url = urlStr.split("://")[1];
  const encodedUrl = encodeURIComponent(url);
  const uuidStr = crypto.randomUUID().replace(/-/g, "");
  const formattedDate = new Date().toUTCString().replace(/GMT/, "").trim() + " GMT";
  const formattedDateLower = formattedDate.toLowerCase();
  
  const bytesToSign = `MSTranslatorAndroidApp${encodedUrl}${formattedDateLower}${uuidStr}`.toLowerCase();
  const key = Buffer.from("oik6PdDdMnOXemTbwvMn9de/h9lFnfBaCWbGMMZqqoSaQaqUOqjVGm5NqsmjcBI1x+sS9ugjB55HEJWRiFXYFw==", "base64");
  
  const hmac = crypto.createHmac('sha256', key);
  hmac.update(bytesToSign);
  const signature = hmac.digest('base64');
  
  return `MSTranslatorAndroidApp::${signature}::${formattedDateLower}::${uuidStr}`;
}

// Get endpoint token
async function getEndpoint() {
  const endpointUrl = "https://dev.microsofttranslator.com/apps/endpoint?api-version=1.0";
  const clientId = crypto.randomUUID().replace(/-/g, "");
  const signature = await sign(endpointUrl);
  
  console.log("Getting endpoint token...");
  const response = await fetch(endpointUrl, {
    method: "POST",
    headers: {
      "Accept-Language": "zh-Hans",
      "X-ClientVersion": "4.0.530a 5fe1dc6c",
      "X-UserId": "0f04d16a175c411e",
      "X-HomeGeographicRegion": "zh-Hans-CN",
      "X-ClientTraceId": clientId,
      "X-MT-Signature": signature,
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0",
      "Content-Type": "application/json; charset=utf-8",
      "Content-Length": "0"
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get endpoint: ${response.status} ${await response.text()}`);
  }
  
  const data = await response.json();
  console.log("Endpoint:", data.r);
  console.log("Token obtained (expires):", data.t ? "yes" : "no");
  return data;
}

// Generate SSML
function getSsml(text, voiceName) {
  const escapedText = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
  
  return `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>
    <voice name='${voiceName}'>
      <prosody rate='+0%' pitch='+0Hz' volume='+0%'>${escapedText}</prosody>
    </voice>
  </speak>`;
}

// Synthesize speech
async function synthesize(text, voiceName = "en-US-AriaNeural") {
  const endpoint = await getEndpoint();
  const url = `https://${endpoint.r}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const ssml = getSsml(text, voiceName);
  
  console.log(`Synthesizing text: "${text}" with voice: ${voiceName}`);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": endpoint.t,
      "Content-Type": "application/ssml+xml",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0",
      "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3"
    },
    body: ssml
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Synthesis failed: ${response.status} ${errorText}`);
  }
  
  const audioBuffer = await response.arrayBuffer();
  console.log(`Audio received: ${audioBuffer.byteLength} bytes`);
  return Buffer.from(audioBuffer);
}

// Main
async function main() {
  try {
    const text = "Hello, this is a test of Microsoft Edge TTS using HTTP POST.";
    const voiceName = "en-US-AriaNeural";
    
    const audio = await synthesize(text, voiceName);
    
    const outputFile = "/workspace/test-output.mp3";
    fs.writeFileSync(outputFile, audio);
    console.log(`✅ Success! Audio saved to: ${outputFile}`);
    console.log(`File size: ${audio.length} bytes`);
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

main();
