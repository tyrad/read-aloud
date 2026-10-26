/**
 * Test vectors for Edge TTS Sec-MS-GEC v2 token generation
 * Based on reference implementation from rany2/edge-tts
 */

describe('Edge TTS DRM Token Generation', () => {
  const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4"
  const WIN_EPOCH = 11644473600
  const S_TO_NS = 1e9

  // Test vectors from gec-vectors.json
  const testVectors = [
    [1729900000.0, "8350A5B1232C2B03-103B2FE3AC01F6E41589E122B054FEAA29908FF87A67426A52501CBAD60BCE89"],
    [1730000000.0, "50065ABF67B90F95-49BDAF24D28ECEB38DAEEC84DEAA71E91F92945EA8A47921C58FB4F8F79A4F5E"],
    [1761460000.0, "31BAE098FD5E4C0E-C2D1E32DF3D35F8A7E8350F24531A7E8F7E0DCBFF7C0E0454A65B963981C365D"],
    [1761463800.0, "3105680A96DB3EAD-DB49EC9268AF74FFE649DD0C1CD2019E7FF3B72C750B8D9CC099549B0D053F62"],
    [1761465600.0, "E3A8CA4548AD0001-B23273BCED5AAAEE67730CC9F8BC3DE271FE485CA794DB1EE621343AF1F25648"],
    [1700000000.0, "2CD23A2CA0B2595A-F3C846C370E05F9CC83ACC5F995C5F5D87A4D0F14CE8936A0F902E64099E38A2"],
    [1800000000.0, "99E54519B490BE5C-E162DB0977FBDCB9B86DD8148BF1BCDC3C0303176CE39852A42B415935C20654"]
  ]

  function generateSecMsGecV2(unixTimestamp) {
    const U32_MASK = 0xFFFFFFFF
    
    let ticks = unixTimestamp
    ticks += WIN_EPOCH
    ticks -= ticks % 300
    ticks *= S_TO_NS / 100
    
    const strToHash = Math.floor(ticks).toString() + TRUSTED_CLIENT_TOKEN
    const data = new TextEncoder().encode(strToHash)
    const digest = sha256Digest(data)
    const cs64Result = cs64Digest(data, digest)
    
    const cs64Hex = cs64Result.toUpperCase()
    const sha256Hex = Array.from(digest).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase()
    
    return `${cs64Hex}-${sha256Hex}`
  }

  function sha256Digest(data) {
    const U32_MASK = 0xFFFFFFFF
    const SHA256_INITIAL = [0x6A09E667, 0xBB67AE85, 0x3C6EF372, 0xA54FF53A, 0x510E527F, 0x9B05688C, 0x1F83D9AB, 0x5BE0CD19]
    const SHA256_STATE = [0xFD9FBEA2, 0x91243CE7, 0xBE499094, 0xCD2E1E0A, 0x6C006F49, 0x04BD35AB, 0xFEB0A7E4, 0x03EFFBD2]
    const SHA256_SCHEDULE = [0xEB24BF9E, 0x1558691F, 0xA0C09EE2, 0x0CFA32BA, 0xA622EE8C, 0xD1DD9491, 0xC0DD25A0, 0xF9E70AB6, 0xF0C31573, 0x7058CE4E, 0x7188E606, 0x00E5AB33, 0xD258B060, 0x72766564]
    const SHA256_K = [0x428A2F98, 0x71374491, 0xB5C0FBCF, 0xE9B5DBA5, 0x3956C25B, 0x59F111F1, 0x923F82A4, 0xAB1C5ED5, 0xD807AA98, 0x12835B01, 0x243185BE, 0x550C7DC3, 0x72BE5D74, 0x80DEB1FE, 0x9BDC06A7, 0xC19BF174, 0xE49B69C1, 0xEFBE4786, 0x0FC19DC6, 0x240CA1CC, 0x2DE92C6F, 0x4A7484AA, 0x5CB0A9DC, 0x76F988DA, 0x983E5152, 0xA831C66D, 0xB00327C8, 0xBF597FC7, 0xC6E00BF3, 0xD5A79147, 0x06CA6351, 0x14292967, 0x27B70A85, 0x2E1B2138, 0x4D2C6DFC, 0x53380D13, 0x650A7354, 0x766A0ABB, 0x81C2C92E, 0x92722C85, 0xA2BFE8A1, 0xA81A664B, 0xC24B8B70, 0xC76C51A3, 0xD192E819, 0xD6990624, 0xF40E3585, 0x106AA070, 0x19A4C116, 0x1E376C08, 0x2748774C, 0x34B0BCB5, 0x391C0CB3, 0x4ED8AA4A, 0x5B9CCA4F, 0x682E6FF3, 0x748F82EE, 0x78A5636F, 0x84C87814, 0x8CC70208, 0x90BEFFFA, 0xA4506CEB, 0xBEF9A3F7, 0xC67178F2]
    const SHA256_ADJUSTMENT = 0xC9DC06A7
    const SHA256_BLOCK_K = SHA256_K.slice(0, 14).concat([SHA256_ADJUSTMENT], SHA256_K.slice(15))
    const SIGMA0_ADJ = 0x059C0B80
    const SIGMA1_ADJ = 0x000B92C0
    
    if (data.length < 7) throw new Error("Data too short")
    
    const sigma0 = v => ((v >>> 7 | v << 25) ^ (v >>> 18 | v << 14) ^ (v >>> 3)) & U32_MASK
    const sigma1 = v => ((v >>> 17 | v << 15) ^ (v >>> 19 | v << 13) ^ (v >>> 10)) & U32_MASK
    
    const words = new Array(14).fill(0)
    words.push((data[0] << 16) | (data[1] << 8) | data[2])
    words.push((data[3] << 24) | (data[4] << 16) | (data[5] << 8) | data[6])
    
    for (let i = 16; i < 30; i++) {
      let v = SHA256_SCHEDULE[i - 16]
      if (i - 2 >= 14) v = (v + (i === 16 ? sigma1(words[i - 2]) ^ SIGMA1_ADJ : sigma1(words[i - 2]))) & U32_MASK
      if (i - 7 >= 14) v = (v + words[i - 7]) & U32_MASK
      if (i - 15 >= 14) v = (v + (i === 29 ? sigma0(words[i - 15]) ^ SIGMA0_ADJ : sigma0(words[i - 15]))) & U32_MASK
      words.push(v & U32_MASK)
    }
    words.push(((sigma1(words[28]) + words[23] + sigma0(words[15]) + words[14] + SHA256_ADJUSTMENT - SHA256_K[14]) & U32_MASK))
    
    for (let i = 31; i < 64; i++) {
      const s1 = sigma1(words[i - 2])
      const s0 = sigma0(words[i - 15])
      words.push(((s1 + words[i - 7] + s0 + words[i - 16]) & U32_MASK))
    }
    
    const sha256Rounds = (state, words, firstRound = 0) => {
      let [a, b, c, d, e, f, g, h] = state
      const k = firstRound === 14 ? SHA256_BLOCK_K : SHA256_K
      for (let i = firstRound; i < 64; i++) {
        const s1 = ((e >>> 6 | e << 26) ^ (e >>> 11 | e << 21) ^ (e >>> 25 | e << 7)) & U32_MASK
        const ch = (e & f) ^ (~e & g)
        const t1 = (h + s1 + ch + k[i] + words[i]) & U32_MASK
        const s0 = ((a >>> 2 | a << 30) ^ (a >>> 13 | a << 19) ^ (a >>> 22 | a << 10)) & U32_MASK
        const maj = (a & b) ^ (a & c) ^ (b & c)
        const t2 = (s0 + maj) & U32_MASK
        h = g; g = f; f = e; e = (d + t1) & U32_MASK
        d = c; c = b; b = a; a = (t1 + t2) & U32_MASK
      }
      return [a, b, c, d, e, f, g, h]
    }
    
    const working = sha256Rounds(SHA256_STATE, words, 14)
    let state = SHA256_INITIAL.map((x, i) => (x + working[i]) & U32_MASK)
    
    const length = 57 + data.length
    const padded = new Uint8Array(data.length - 7 + 1 + ((55 - length) % 64 + 64) % 64 + 8)
    padded.set(data.subarray(7))
    padded[data.length - 7] = 0x80
    const view = new DataView(padded.buffer)
    view.setUint32(padded.length - 8, 0, false)
    view.setUint32(padded.length - 4, length * 8, false)
    
    for (let offset = 0; offset < padded.length; offset += 64) {
      const chunk = padded.subarray(offset, offset + 64)
      const w = []
      for (let i = 0; i < 16; i++) {
        w.push((chunk[i * 4] << 24) | (chunk[i * 4 + 1] << 16) | (chunk[i * 4 + 2] << 8) | chunk[i * 4 + 3])
      }
      for (let i = 16; i < 64; i++) {
        w.push(((sigma1(w[i - 2]) + w[i - 7] + sigma0(w[i - 15]) + w[i - 16]) & U32_MASK))
      }
      const working = sha256Rounds(state, w)
      state = state.map((x, i) => (x + working[i]) & U32_MASK)
    }
    
    const result = new Uint8Array(32)
    for (let i = 0; i < 8; i++) {
      result[i * 4] = (state[i] >>> 24) & 0xFF
      result[i * 4 + 1] = (state[i] >>> 16) & 0xFF
      result[i * 4 + 2] = (state[i] >>> 8) & 0xFF
      result[i * 4 + 3] = state[i] & 0xFF
    }
    return result
  }

  function cs64Digest(data, digest) {
    const U32_MASK = 0xFFFFFFFF
    const CS64_COEF = [[0xE82E91B1, 0xB32700D0], [0x44DE24C6, 0x88DFF51D], [0x3BEB65BC, 0x29514038], [0xC89C5933, 0xB328CBDF], [0x8D1EC211, 0xD405B4D5], [0x314EF5D5, 0x26E55F3C], [0xE92491B1, 0x607801C6], [0xF0A5B9D5, 0x82B2C1FB], [0x06064CF3, 0xFA51A3DA], [0xDA79FA60, 0x207CC464], [0xBED20560, 0x3C3C74F3], [0x89F9C9F8, 0xD2D14B61], [0x35FA38C6, 0xBB04A2C1], [0xCB49E3C6, 0xC5626167]]
    const CS64_FACTOR = 0x82893933
    const CS64_ADJ0 = 0xF2F90B1A
    const CS64_ADJ1 = 0x0B1A0000
    
    const rol16 = v => (((v << 16) | (v >>> 16)) & U32_MASK)
    
    let keyA = (digest[0] | (digest[1] << 8) | (digest[2] << 16) | (digest[3] << 24)) | 1
    let keyB = (digest[4] | (digest[5] << 8) | (digest[6] << 16) | (digest[7] << 24)) | 1
    
    const factorA = (keyA * CS64_FACTOR) & U32_MASK
    const factorB = (keyB * CS64_FACTOR) & U32_MASK
    
    const terms = []
    const offsets = []
    CS64_COEF.forEach(([coef, offset], i) => {
      terms.push((coef * (i % 2 === 0 ? factorA : factorB)) & U32_MASK)
      offsets.push(offset)
    })
    
    const padded = new Uint8Array(data.length + 1 + (4 - (data.length + 1) % 4) % 4)
    padded[0] = 0
    padded.set(data, 1)
    
    for (let i = 0; i < padded.length; i += 4) {
      const word = (padded[i] | (padded[i + 1] << 8) | (padded[i + 2] << 16) | (padded[i + 3] << 24))
      const idx = i / 4
      const key = idx % 2 === 0 ? keyA : keyB
      const factor = idx % 2 === 0 ? 0xEF0569FB : 0xC31713DB
      let term = (word * key) & U32_MASK
      let offset = (rol16(word) * factor) & U32_MASK
      if (idx === 0) {
        term = (term + CS64_ADJ0 * factorA) & U32_MASK
        offset = (offset + CS64_ADJ1) & U32_MASK
      }
      terms.push(term)
      offsets.push(offset)
    }
    
    let swapAcc = 0, swapLast = 0, state = 0, acc = 0
    for (let i = 0; i < terms.length; i += 2) {
      const x = terms[i], y = terms[i + 1] || 0
      let t = rol16((offsets[i] + x) & U32_MASK)
      let q = (t * 0x76F50F34) & U32_MASK
      swapAcc = (swapAcc + (rol16(q) * 0xC3EFEA97 + q) & U32_MASK) & U32_MASK
      t = rol16((offsets[i + 1] + y) & U32_MASK)
      q = (t * 0x1881CE3C) & U32_MASK
      swapLast = (rol16(q) * 0x35BD1EC9 + q) & U32_MASK
      swapAcc = (swapAcc + swapLast) & U32_MASK
      
      state = (state * keyA + x) & U32_MASK
      state = (rol16(state) * 0xCF98B111) & U32_MASK
      state = (rol16(state) * 0x87085B9F) & U32_MASK
      state = (rol16(state) * 0x12CEB96D) & U32_MASK
      state = (rol16(state) * 0x257E1D83) & U32_MASK
      acc = (acc + state) & U32_MASK
      t = (state * keyB + y) & U32_MASK
      t = (rol16(t) * 0xA27416F5) & U32_MASK
      t = (rol16(t) * 0xD38396FF) & U32_MASK
      state = (rol16((rol16(t) * 0x7C932B89) & U32_MASK) * 0xBFA49F69) & U32_MASK
      acc = (acc + state) & U32_MASK
    }
    
    const result0 = (swapLast ^ state) >>> 0
    const result1 = (swapAcc ^ acc) >>> 0
    return result0.toString(16).padStart(8, '0').toUpperCase() + result1.toString(16).padStart(8, '0').toUpperCase()
  }

  testVectors.forEach(([timestamp, expected]) => {
    it(`should generate correct token for timestamp ${timestamp}`, () => {
      const result = generateSecMsGecV2(timestamp)
      expect(result).toBe(expected)
    })
  })
})
