
var browserTtsEngine = brapi.tts ? new BrowserTtsEngine() : (typeof speechSynthesis != 'undefined' ? new WebSpeechEngine() : new DummyTtsEngine());
var premiumTtsEngine = new PremiumTtsEngine(config.serviceUrl);
var googleTranslateTtsEngine = new GoogleTranslateTtsEngine();
var amazonPollyTtsEngine = new AmazonPollyTtsEngine();
var googleWavenetTtsEngine = new GoogleWavenetTtsEngine();
var ibmWatsonTtsEngine = new IbmWatsonTtsEngine();
var phoneTtsEngine = new PhoneTtsEngine();
var openaiTtsEngine = new OpenaiTtsEngine();
var azureTtsEngine = new AzureTtsEngine();
var edgeTtsEngine = new EdgeTtsEngine();
const piperTtsEngine = new PiperTtsEngine()
const supertonicTtsEngine = new SupertonicTtsEngine()
const pocketTtsEngine = new PocketTtsEngine()
const nghiTtsEngine = new NghiTtsEngine()


//synthesized audio cache
const cache = {
  entries: new Map(),
  maxEntries: 5,
  fetchCached(key, fetchFn, destroyFn) {
    const entry = this.entries.get(key)
    if (entry) {
      this.entries.delete(key)
      this.entries.set(key, entry)
      return entry.promise
    }
    const promise = Promise.resolve().then(fetchFn).catch(err => {
      if (this.entries.get(key)?.promise === promise) this.entries.delete(key)
      throw err
    })
    this.entries.set(key, {promise, destroyFn})
    while (this.entries.size > this.maxEntries) {
      const [oldestKey, oldest] = this.entries.entries().next().value
      oldest.promise.then(value => oldest.destroyFn?.(value)).catch(() => {})
      this.entries.delete(oldestKey)
    }
    return promise
  }
}


/*
interface Options {
  voice: {
    voiceName: string
    autoSelect?: boolean
  }
  lang: string
  rate?: number
  pitch?: number
  volume?: number
}

interface Event {
  type: string
}

interface Voice {
  voiceName: string
  lang: string
}

interface TtsEngine {
  speak: function(text: string, opts: Options, playbackState$: Observable<"paused"|"resumed">): Observable<TtsEvent>
  getVoices: function(): Voice[]
}
*/

function BrowserTtsEngine() {
  let initialized = false
  this.speak = function(text, options, onEvent) {
    // Keep the cold-start workaround out of construction: Options also creates
    // this engine just to list voices, while another page may be speaking.
    if (!initialized) {
      brapi.tts.stop()
      initialized = true
    }
    brapi.tts.speak(text, {
      voiceName: options.voice.voiceName,
      lang: options.lang,
      rate: options.rate,
      pitch: options.pitch,
      volume: options.volume,
      requiredEventTypes: ["start", "end"],
      desiredEventTypes: ["start", "end", "error"],
      onEvent: onEvent
    })
  }
  this.stop = brapi.tts.stop;
  this.pause = brapi.tts.pause;
  this.resume = brapi.tts.resume;
  this.isSpeaking = brapi.tts.isSpeaking;
  this.getVoices = async function() {
    const voices = await new Promise(f => brapi.tts.getVoices(f)) || []
    return voices
      .filter(voice => !isPiperVoice(voice) && !isSupertonicVoice(voice) && !isPocketTtsVoice(voice))
  }
}


function WebSpeechEngine() {
  var utter;
  this.speak = function(text, options, onEvent) {
    utter = new SpeechSynthesisUtterance();
    utter.text = text;
    utter.voice = options.voice;
    if (options.lang) utter.lang = options.lang;
    if (options.pitch) utter.pitch = options.pitch;
    if (options.rate) utter.rate = options.rate;
    if (options.volume) utter.volume = options.volume;
    utter.onstart = onEvent.bind(null, {type: 'start', charIndex: 0});
    utter.onend = onEvent.bind(null, {type: 'end', charIndex: text.length});
    utter.onerror = function(event) {
      if (event.error == "canceled" || event.error == "interrupted") return;
      onEvent({type: 'error', error: new Error(event.error)});
    };
    speechSynthesis.cancel()
    speechSynthesis.speak(utter);
  }
  this.stop = function() {
    if (utter) utter.onend = null;
    speechSynthesis.cancel();
  }
  this.pause = function() {
    speechSynthesis.pause();
  }
  this.resume = function() {
    speechSynthesis.resume();
  }
  this.isSpeaking = function(callback) {
    callback(speechSynthesis.speaking);
  }
  this.getVoices = function() {
    return promiseTimeout(1500, "Timeout WebSpeech getVoices", new Promise(function(fulfill) {
      var voices = speechSynthesis.getVoices() || [];
      if (voices.length) fulfill(voices);
      else speechSynthesis.onvoiceschanged = function() {
        fulfill(speechSynthesis.getVoices() || []);
      }
    }))
    .then(function(voices) {
      for (const voice of voices) {
        voice.voiceName = voice.name
        voice.remote = !voice.localService
      }
      return voices;
    })
    .catch(function(err) {
      console.error(err);
      return [];
    })
  }
}


function DummyTtsEngine() {
  this.getVoices = function() {
    return Promise.resolve([]);
  }
}


function TimeoutTtsEngine(baseEngine, startTimeout, endTimeout) {
  let speakSub
  this.speak = function(text, options, onEvent) {
    speakSub = new rxjs.Observable(observer => {
      baseEngine.speak(text, options, event => observer.next(event))
    }).pipe(
      rxjs.timeout({
        first: startTimeout,
        with() {
          console.debug(`No 'start' event after ${startTimeout}, will call stop() and retry once`)
          baseEngine.stop()
          return rxjs.throwError(() => new Error("Timeout, TTS never started, try picking another voice?"))
        }
      }),
      rxjs.retry(1),
      rxjs.mergeMap(event =>
        rxjs.iif(
          () => event.type == "start",
          rxjs.timer(endTimeout).pipe(
            rxjs.map(() => {
              console.debug(`No 'end' event after ${endTimeout}, will call stop() and generate 'end'`)
              baseEngine.stop()
              return {type: "end", charIndex: text.length}
            }),
            rxjs.startWith(event)
          ),
          rxjs.of(event)
        )
      ),
      rxjs.catchError(error => rxjs.of({type: "error", error})),
      rxjs.takeWhile(event => event.type != "end" && event.type != "error", true)
    ).subscribe(onEvent)
  }
  this.stop = function() {
    if (speakSub) speakSub.unsubscribe()
    baseEngine.stop();
  }
  this.isSpeaking = baseEngine.isSpeaking;
}


function PremiumTtsEngine(serviceUrl) {
  var readyPromise;
  var nextStartTime = 0;
  this.prepare = function(options) {
    readyPromise = immediate(async () => {
      const authToken = await getAuthToken()
      if (isPremiumVoice(options.voice) && !options.voice.autoSelect) {
        if (!authToken) throw new Error(JSON.stringify({code: "error_login_required"}));
        const account = await getAccountInfo(authToken)
        if (!account) throw new Error(JSON.stringify({code: "error_login_required"}));
        if (!account.balance) throw new Error(JSON.stringify({code: "error_payment_required"}));
      }
      return {
        authToken,
        clientId: await getUniqueClientId(),
        manifest: brapi.runtime.getManifest()
      }
    })
  }
  this.speak = function(utterance, options, playbackState$) {
    const urlPromise = getAudioUrl(utterance, options)
    return playAudio(urlPromise, {...options, startTime: nextStartTime}, playbackState$).pipe(
      rxjs.tap(event => {
        if (event.type == "end") nextStartTime = Date.now() + 650 / options.rate
      })
    )
  }
  this.prefetch = function(utterance, options) {
    getAudioUrl(utterance, options)
      .catch(console.error)
  }
  this.getVoices = async function() {
    const premiumVoiceList = await getSetting("premiumVoiceList")
    if (!premiumVoiceList || premiumVoiceList.expire < Date.now()) refreshVoiceList()
    return (premiumVoiceList ? premiumVoiceList.items : voices)
      .concat(
        {voiceName: "ReadAloud Generic Voice", autoSelect: true},
      )
  }
  async function refreshVoiceList() {
    try {
      const res = await fetch(serviceUrl + "/read-aloud/list-voices/premium")
      if (!res.ok) throw new Error("Server return " + res.status)
      const items = await res.json()
      await updateSetting("premiumVoiceList", {items, expire: Date.now() + 24*3600*1000})
    } catch (err) {
      console.error("Error refreshing premium voice list", err)
    }
  }
  async function getAudioUrl(utterance, {lang, voice}) {
    const {authToken, clientId, manifest} = await readyPromise
    const url = serviceUrl + "/read-aloud/speak/" + lang + "/" + encodeURIComponent(voice.voiceName) + "?c=" + encodeURIComponent(clientId) + "&t=" + encodeURIComponent(authToken) + (voice.autoSelect ? '&a=1' : '') + "&v=" + manifest.version + "&q=" + encodeURIComponent(utterance)
    return cache.fetchCached(
      url,
      async () => {
        const res = await fetch(url)
        if (!res.ok) {
          const msg = await res.text().catch(err => "")
          throw new Error(msg || (res.status + " " + res.statusText))
        }
        const blob = await res.blob()
        return URL.createObjectURL(blob)
      },
      blobUrl => URL.revokeObjectURL(blobUrl)
    )
  }
  var voices = [
      {"voice_name": "Amazon Australian English (Nicole)", "lang": "en-AU", "gender": "female", "event_types": ["start", "end", "error"]},
      {"voice_name": "Amazon Australian English (Russell)", "lang": "en-AU", "gender": "male", "event_types": ["start", "end", "error"]},
      {"voice_name": "Amazon Brazilian Portuguese (Ricardo)", "lang": "pt-BR", "gender": "male", "event_types": ["start", "end", "error"]},
      {"voice_name": "Amazon Brazilian Portuguese (Vitoria)", "lang": "pt-BR", "gender": "female", "event_types": ["start", "end", "error"]},
      {"voice_name": "Amazon British English (Amy)", "lang": "en-GB", "gender": "female", "event_types": ["start", "end", "error"]},
      {"voice_name": "Amazon British English (Brian)", "lang": "en-GB", "gender": "male", "event_types": ["start", "end", "error"]},
      {"voice_name": "Amazon British English (Emma)", "lang": "en-GB", "gender": "female", "event_types": ["start", "end", "error"]},
      {"voice_name": "Amazon Canadian French (Chantal)", "lang": "fr-CA", "gender": "female", "event_types": ["start", "end", "error"]},
      {"voice_name": "Amazon Castilian Spanish (Conchita)", "lang": "es-ES", "gender": "female", "event_types": ["start", "end", "error"]},
      {"voice_name": "Amazon Castilian Spanish (Enrique)", "lang": "es-ES", "gender": "male", "event_types": ["start", "end", "error"]},
      {"voice_name": "Amazon Danish (Mads)", "lang": "da-DK", "gender": "male", "event_types": ["start", "end", "error"]},
      {"voice_name": "Amazon Danish (Naja)", "lang": "da-DK", "gender": "female", "event_types": ["start", "end", "error"]},
      {"voice_name": "Amazon Dutch (Lotte)", "lang": "nl-NL", "gender": "female", "event_types": ["start", "end", "error"]},
      {"voice_name": "Amazon Dutch (Ruben)", "lang": "nl-NL", "gender": "male", "event_types": ["start", "end", "error"]},
      {"voice_name": "Amazon French (Celine)", "lang": "fr-FR", "gender": "female", "event_types": ["start", "end", "error"]},
      {"voice_name": "Amazon French (Mathieu)", "lang": "fr-FR", "gender": "male", "event_types": ["start", "end", "error"]},
      {"voice_name": "Amazon German (Hans)", "lang": "de-DE", "gender": "male", "event_types": ["start", "end", "error"]},
      {"voice_name": "Amazon German (Marlene)", "lang": "de-DE", "gender": "female", "event_types": ["start", "end", "error"]},
      {"voice_name": "Amazon Icelandic (Dora)", "lang": "is-IS", "gender": "female", "event_types": ["start", "end", "error"]},
      {"voice_name": "Amazon Icelandic (Karl)", "lang": "is-IS", "gender": "male", "event_types": ["start", "end", "error"]},
      {"voice_name": "Amazon Indian English (Raveena)", "lang": "en-IN", "gender": "female", "event_types": ["start", "end", "error"]},
      {"voice_name": "Amazon Italian (Carla)", "lang": "it-IT", "gender": "female", "event_types": ["start", "end", "error"]},
      {"voice_name": "Amazon Italian (Giorgio)", "lang": "it-IT", "gender": "male", "event_types": ["start", "end", "error"]},
      {"voice_name": "Amazon Norwegian (Liv)", "lang": "nb-NO", "gender": "female", "event_types": ["start", "end", "error"]},
      {"voice_name": "Amazon Polish (Ewa)", "lang": "pl-PL", "gender": "female", "event_types": ["start", "end", "error"]},
      {"voice_name": "Amazon Polish (Jacek)", "lang": "pl-PL", "gender": "male", "event_types": ["start", "end", "error"]},
      {"voice_name": "Amazon Polish (Jan)", "lang": "pl-PL", "gender": "male", "event_types": ["start", "end", "error"]},
      {"voice_name": "Amazon Polish (Maja)", "lang": "pl-PL", "gender": "female", "event_types": ["start", "end", "error"]},
      {"voice_name": "Amazon Portuguese (Cristiano)", "lang": "pt-PT", "gender": "male", "event_types": ["start", "end", "error"]},
      {"voice_name": "Amazon Portuguese (Ines)", "lang": "pt-PT", "gender": "female", "event_types": ["start", "end", "error"]},
      {"voice_name": "Amazon Romanian (Carmen)", "lang": "ro-RO", "gender": "female", "event_types": ["start", "end", "error"]},
      {"voice_name": "Amazon Russian (Maxim)", "lang": "ru-RU", "gender": "male", "event_types": ["start", "end", "error"]},
      {"voice_name": "Amazon Russian (Tatyana)", "lang": "ru-RU", "gender": "female", "event_types": ["start", "end", "error"]},
      {"voice_name": "Amazon Swedish (Astrid)", "lang": "sv-SE", "gender": "female", "event_types": ["start", "end", "error"]},
      {"voice_name": "Amazon Turkish (Filiz)", "lang": "tr-TR", "gender": "female", "event_types": ["start", "end", "error"]},
      {"voice_name": "Amazon US English (Ivy)", "lang": "en-US", "gender": "female", "event_types": ["start", "end", "error"]},
      {"voice_name": "Amazon US English (Joey)", "lang": "en-US", "gender": "male", "event_types": ["start", "end", "error"]},
      {"voice_name": "Amazon US English (Justin)", "lang": "en-US", "gender": "male", "event_types": ["start", "end", "error"]},
      {"voice_name": "Amazon US English (Kendra)", "lang": "en-US", "gender": "female", "event_types": ["start", "end", "error"]},
      {"voice_name": "Amazon US English (Kimberly)", "lang": "en-US", "gender": "female", "event_types": ["start", "end", "error"]},
      {"voice_name": "Amazon US English (Salli)", "lang": "en-US", "gender": "female", "event_types": ["start", "end", "error"]},
      {"voice_name": "Amazon US Spanish (Miguel)", "lang": "es-US", "gender": "male", "event_types": ["start", "end", "error"]},
      {"voice_name": "Amazon US Spanish (Penelope)", "lang": "es-US", "gender": "female", "event_types": ["start", "end", "error"]},
      {"voice_name": "Amazon Welsh (Gwyneth)", "lang": "cy-GB", "gender": "female", "event_types": ["start", "end", "error"]},
      {"voice_name": "Amazon Welsh English (Geraint)", "lang": "en-GB-WLS", "gender": "male", "event_types": ["start", "end", "error"]},

      {"voice_name": "Microsoft Australian English (Catherine)", "lang": "en-AU", "gender": "female", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft Australian English (James)", "lang": "en-AU", "gender": "male", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft Austrian German (Michael)", "lang": "de-AT", "gender": "male", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft Belgian Dutch (Bart)", "lang": "nl-BE", "gender": "male", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft Brazilian Portuguese (Daniel)", "lang": "pt-BR", "gender": "male", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft Brazilian Portuguese (Maria)", "lang": "pt-BR", "gender": "female", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft British English (George)", "lang": "en-GB", "gender": "male", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft British English (Hazel)", "lang": "en-GB", "gender": "female", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft British English (Susan)", "lang": "en-GB", "gender": "female", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft Bulgarian (Ivan)", "lang": "bg-BG", "gender": "male", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft Canadian English (Linda)", "lang": "en-CA", "gender": "female", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft Canadian English (Richard)", "lang": "en-CA", "gender": "male", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft Canadian French (Caroline)", "lang": "fr-CA", "gender": "female", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft Canadian French (Claude)", "lang": "fr-CA", "gender": "male", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft Canadian French (Nathalie)", "lang": "fr-CA", "gender": "female", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft Catalan (Herena)", "lang": "ca-ES", "gender": "female", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft Chinese (Huihui)", "lang": "zh-CN", "gender": "female", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft Chinese (Kangkang)", "lang": "zh-CN", "gender": "male", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft Chinese (Yaoyao)", "lang": "zh-CN", "gender": "female", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft ChineseHK (Danny)", "lang": "zh-HK", "gender": "male", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft ChineseHK (Tracy)", "lang": "zh-HK", "gender": "female", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft Croatian (Matej)", "lang": "hr-HR", "gender": "male", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft Czech (Jakub)", "lang": "cs-CZ", "gender": "male", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft Danish (Helle)", "lang": "da-DK", "gender": "female", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft Dutch (Frank)", "lang": "nl-NL", "gender": "male", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft Egyptian Arabic (Hoda)", "lang": "ar-EG", "gender": "female", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft Finnish (Heidi)", "lang": "fi-FI", "gender": "female", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft French (Hortense)", "lang": "fr-FR", "gender": "female", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft French (Julie)", "lang": "fr-FR", "gender": "female", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft French (Paul)", "lang": "fr-FR", "gender": "male", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft German (Hedda)", "lang": "de-DE", "gender": "female", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft German (Katja)", "lang": "de-DE", "gender": "female", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft German (Stefan)", "lang": "de-DE", "gender": "male", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft Greek (Stefanos)", "lang": "el-GR", "gender": "male", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft Hebrew (Asaf)", "lang": "he-IL", "gender": "male", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft Hindi (Hemant)", "lang": "hi-IN", "gender": "male", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft Hindi (Kalpana)", "lang": "hi-IN", "gender": "female", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft Hungarian (Szabolcs)", "lang": "hu-HU", "gender": "male", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft Indian English (Heera)", "lang": "en-IN", "gender": "female", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft Indian English (Ravi)", "lang": "en-IN", "gender": "male", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft Indonesian (Andika)", "lang": "id-ID", "gender": "male", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft Irish English (Sean)", "lang": "en-IE", "gender": "male", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft Italian (Cosimo)", "lang": "it-IT", "gender": "male", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft Italian (Elsa)", "lang": "it-IT", "gender": "female", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft Japanese (Ayumi)", "lang": "ja-JP", "gender": "female", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft Japanese (Haruka)", "lang": "ja-JP", "gender": "female", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft Japanese (Ichiro)", "lang": "ja-JP", "gender": "male", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft Japanese (Sayaka)", "lang": "ja-JP", "gender": "female", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft Korean (Heami)", "lang": "ko-KR", "gender": "female", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft Malay (Rizwan)", "lang": "ms-MY", "gender": "male", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft Mexican Spanish (Raul)", "lang": "es-MX", "gender": "male", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft Mexican Spanish (Sabina)", "lang": "es-MX", "gender": "female", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft Norwegian (Jon)", "lang": "nb-NO", "gender": "male", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft Polish (Adam)", "lang": "pl-PL", "gender": "male", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft Polish (Paulina)", "lang": "pl-PL", "gender": "female", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft Portuguese (Helia)", "lang": "pt-PT", "gender": "female", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft Romanian (Andrei)", "lang": "ro-RO", "gender": "male", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft Russian (Irina)", "lang": "ru-RU", "gender": "female", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft Russian (Pavel)", "lang": "ru-RU", "gender": "male", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft Saudi Arabic (Naayf)", "lang": "ar-SA", "gender": "male", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft Slovak (Filip)", "lang": "sk-SK", "gender": "male", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft Slovenian (Lado)", "lang": "sl-SI", "gender": "male", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft Spanish (Helena)", "lang": "es-ES", "gender": "female", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft Spanish (Laura)", "lang": "es-ES", "gender": "female", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft Spanish (Pablo)", "lang": "es-ES", "gender": "male", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft Swedish (Bengt)", "lang": "sv-SE", "gender": "male", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft Swiss French (Guillaume)", "lang": "fr-CH", "gender": "male", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft Swiss German (Karsten)", "lang": "de-CH", "gender": "male", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft Tamil (Valluvar)", "lang": "ta-IN", "gender": "male", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft Thai (Pattara)", "lang": "th-TH", "gender": "male", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft Turkish (Tolga)", "lang": "tr-TR", "gender": "male", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft US English (David)", "lang": "en-US", "gender": "male", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft US English (Mark)", "lang": "en-US", "gender": "male", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft US English (Zira)", "lang": "en-US", "gender": "female", "event_types": ["start", "end", "error"]},
      {"voice_name": "Microsoft Vietnamese (An)", "lang": "vi-VI", "gender": "male", "event_types": ["start", "end", "error"]},
    ]
    .map(function(item) {
      return {voiceName: item.voice_name, lang: item.lang};
    })
}


function GoogleTranslateTtsEngine() {
  this.ready = function() {
    return googleTranslateReady();
  };
  this.speak = function(utterance, options, playbackState$) {
    options.rateAdjust = 1.1
    const urlPromise = getAudioUrl(utterance, options)
    return playAudio(urlPromise, options, playbackState$)
  };
  this.prefetch = function(utterance, options) {
    getAudioUrl(utterance, options)
      .catch(console.error)
  };
  this.getVoices = function() {
    return voices;
  }
  function getAudioUrl(text, {voice: {lang}}) {
    assert(text && lang);
    return cache.fetchCached(
      JSON.stringify([text, lang]),
      () => googleTranslateSynthesizeSpeech(text, lang)
      //data URL, no destroy()
    )
  }
  var voices = [
      {"voice_name": "GoogleTranslate Afrikaans", "lang": "af", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Albanian", "lang": "sq", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Arabic", "lang": "ar", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Armenian", "lang": "hy", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Bengali", "lang": "bn", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Bosnian", "lang": "bs", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Bulgarian", "lang": "bg", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Catalan", "lang": "ca", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Chinese", "lang": "zh-CN", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Croatian", "lang": "hr", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Czech", "lang": "cs", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Danish", "lang": "da", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Dutch", "lang": "nl", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate English", "lang": "en", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Esperanto", "lang": "eo", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Estonian", "lang": "et", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Filipino", "lang": "fil", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Finnish", "lang": "fi", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate French", "lang": "fr", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate German", "lang": "de", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Greek", "lang": "el", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Gujarati", "lang": "gu", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Hebrew", "lang": "he", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Hindi", "lang": "hi", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Hungarian", "lang": "hu", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Icelandic", "lang": "is", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Indonesian", "lang": "id", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Italian", "lang": "it", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Japanese", "lang": "ja", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Javanese", "lang": "jw", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Kannada", "lang": "kn", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Khmer", "lang": "km", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Korean", "lang": "ko", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Latin", "lang": "la", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Latvian", "lang": "lv", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Macedonian", "lang": "mk", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Malay", "lang": "ms", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Malayalam", "lang": "ml", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Marathi", "lang": "mr", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Myanmar (Burmese)", "lang": "my", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Nepali", "lang": "ne", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Norwegian", "lang": "no", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Polish", "lang": "pl", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Portuguese", "lang": "pt", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Romanian", "lang": "ro", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Russian", "lang": "ru", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Serbian", "lang": "sr", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Sinhala", "lang": "si", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Slovak", "lang": "sk", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Spanish", "lang": "es", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Sundanese", "lang": "su", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Swahili", "lang": "sw", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Swedish", "lang": "sv", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Tagalog", "lang": "tl", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Tamil", "lang": "ta", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Telugu", "lang": "te", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Thai", "lang": "th", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Turkish", "lang": "tr", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Ukrainian", "lang": "uk", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Urdu", "lang": "ur", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Vietnamese", "lang": "vi", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Welsh", "lang": "cy", "event_types": ["start", "end", "error"]}
    ]
    .map(function(item) {
      return {voiceName: item.voice_name, lang: item.lang};
    })
}


function AmazonPollyTtsEngine() {
  var getPolly = lazy(createPolly)
  this.speak = function(utterance, options, playbackState$) {
    const urlPromise = getAudioUrl(utterance, options)
    return playAudio(urlPromise, options, playbackState$)
  };
  this.prefetch = function(utterance, options) {
    getAudioUrl(utterance, options)
      .catch(console.error)
  };
  this.getVoices = async function() {
    try {
      const {awsCreds, pollyVoices} = await getSettings(["awsCreds", "pollyVoices"])
      if (!awsCreds) return []
      if (pollyVoices && pollyVoices.expire > Date.now()) return pollyVoices.list
      const list = await fetchVoices()
      await updateSettings({pollyVoices: {list, expire: Date.now() + 24*3600*1000}})
      return list
    }
    catch (err) {
      console.error(err)
      return []
    }
  }
  async function fetchVoices() {
    const polly = await getPolly()
    const data = await polly.describeVoices().promise()
    const voices = []
    for (const voice of data.Voices) {
      assert(voice.SupportedEngines && voice.Id)
      if (voice.SupportedEngines.includes("standard")) voices.push(voice);
      if (voice.SupportedEngines.includes("neural")) voices.push({...voice, Style: "neural"})
      if (polly.newscasterVoices.includes(voice.Id)) voices.push({...voice, Style: "newscaster"})
      if (polly.conversationalVoices.includes(voice.Id)) voices.push({...voice, Style: "conversational"})
    }
    return voices.map(voice => {
      assert(voice.Gender)
      let voiceName = `AmazonPolly ${voice.LanguageName} (${voice.Id})`;
      if (voice.Style) voiceName += ` +${voice.Style}`;
      return {
        voiceName,
        lang: voice.LanguageCode,
        langs: voice.AdditionalLanguageCodes
          ? [voice.LanguageCode, ...voice.AdditionalLanguageCodes]
          : undefined,
        gender: voice.Gender.toLowerCase(),
      }
    })
  }
  function getAudioUrl(text, {lang, voice}) {
    assert(text && lang && voice);
    var matches = voice.voiceName.match(/^AmazonPolly .* \((\w+)\)( \+\w+)?$/);
    var voiceId = matches[1];
    var style = matches[2] && matches[2].substr(2);
    return cache.fetchCached(
      JSON.stringify([text, voiceId, style]),
      async () => {
        const polly = await getPolly()
        const blob = await polly.synthesizeSpeech(getOpts(text, voiceId, style)).promise()
        return URL.createObjectURL(blob);
      },
      blobUrl => URL.revokeObjectURL(blobUrl)
    )
  }
  function createPolly() {
    return getSettings(["awsCreds"])
      .then(function(items) {
        if (!items.awsCreds) throw new Error("Missing AWS credentials");
        return new AWS.Polly({
          region: "us-east-1",
          accessKeyId: items.awsCreds.accessKeyId,
          secretAccessKey: items.awsCreds.secretAccessKey
        })
      })
  }
  function getOpts(text, voiceId, style) {
    switch (style) {
      case "newscaster":
        return {
          OutputFormat: "mp3",
          Text: '<speak><amazon:domain name="news">' + escapeXml(text) + '</amazon:domain></speak>',
          TextType: "ssml",
          VoiceId: voiceId,
          Engine: "neural"
        }
      case "conversational":
        return {
          OutputFormat: "mp3",
          Text: '<speak><amazon:domain name="conversational">' + escapeXml(text) + '</amazon:domain></speak>',
          TextType: "ssml",
          VoiceId: voiceId,
          Engine: "neural"
        }
      case "neural":
        return {
          OutputFormat: "mp3",
          Text: text,
          VoiceId: voiceId,
          Engine: "neural"
        }
      default:
        return {
          OutputFormat: "mp3",
          Text: text,
          VoiceId: voiceId
        }
    }
  }
}


function GoogleWavenetTtsEngine() {
  this.speak = function(utterance, options, playbackState$) {
    const urlPromise = getAudioUrl(utterance, options)
    return playAudio(urlPromise, options, playbackState$)
  };
  this.prefetch = function(utterance, options) {
    getAudioUrl(utterance, options)
      .catch(console.error)
  };
  this.getVoices = function() {
    return getSettings(["wavenetVoices", "gcpCreds"])
      .then(function(items) {
        if (!items.wavenetVoices || Date.now()-items.wavenetVoices[0].ts > 24*3600*1000) updateVoices();
        var listvoices = items.wavenetVoices || voices;
        var creds = items.gcpCreds;
        return listvoices.filter(
          function(voice) {
            // include all voices or exclude only studio voices.
            return ((creds && creds.enableStudio) || !isGoogleStudio(voice));
          });
      })
  }
  this.getFreeVoices = function() {
    return this.getVoices()
      .then(function(items) {
        return items.filter(function(item) {
          return item.voiceName.match(/^GoogleStandard /);
        })
      })
  }
  function updateVoices() {
    ajaxGet(config.serviceUrl + "/read-aloud/list-voices/google")
      .then(JSON.parse)
      .then(function(list) {
        list[0].ts = Date.now();
        updateSettings({wavenetVoices: list});
      })
  }
  function getAudioUrl(text, {voice, pitch}) {
    assert(text && voice);
    return cache.fetchCached(
      JSON.stringify([text, voice.voiceName, voice.lang, pitch]),
      () => {
        var matches = voice.voiceName.match(/^Google(\S+) .* \((\w+)\)$/);
        const voiceType = matches[1];
        const speakerId = voiceType == "Chirp3-HD" ? matches[2] : matches[2][0];
        var endpoint = matches[1] == "Neural2" ? "us-central1-texttospeech.googleapis.com" : "texttospeech.googleapis.com";
        return getSettings(["gcpCreds", "gcpToken"])
          .then(function(settings) {
            var postData = {
              input: {
                text: text
              },
              voice: {
                languageCode: voice.lang,
                name: voice.lang + "-" + voiceType + "-" + speakerId
              },
              audioConfig: {
                audioEncoding: "OGG_OPUS",
              }
            }
            if (!voiceType.startsWith("Chirp")) postData.audioConfig.pitch = ((pitch || 1) -1) *20;
            if (settings.gcpCreds) return ajaxPost("https://" + endpoint + "/v1/text:synthesize?key=" + settings.gcpCreds.apiKey, postData, "json");
            if (!settings.gcpToken) throw new Error(JSON.stringify({code: "error_wavenet_auth_required"}));
            return ajaxPost("https://cxl-services.appspot.com/proxy?url=https://texttospeech.googleapis.com/v1beta1/text:synthesize&token=" + settings.gcpToken, postData, "json")
              .catch(function(err) {
                console.error(err);
                throw new Error(JSON.stringify({code: "error_wavenet_auth_required"}));
              })
          })
          .then(function(responseText) {
            var data = JSON.parse(responseText);
            return "data:audio/ogg;codecs=opus;base64," + data.audioContent;
          })
      }
      //data URL, no destroy()
    )
  }
  var voices = [
    {"voiceName":"GoogleStandard Spanish; Castilian (Anna)","lang":"es-ES","gender":"female"},
    {"voiceName":"GoogleStandard Arabic (Anna)","lang":"ar-XA","gender":"female"},
    {"voiceName":"GoogleStandard Arabic (Benjamin)","lang":"ar-XA","gender":"male"},
    {"voiceName":"GoogleStandard Arabic (Christopher)","lang":"ar-XA","gender":"male"},
    {"voiceName":"GoogleStandard Arabic (Diane)","lang":"ar-XA","gender":"female"},
    {"voiceName":"GoogleStandard French (Elizabeth)","lang":"fr-FR","gender":"female"},
    {"voiceName":"GoogleStandard Italian (Anna)","lang":"it-IT","gender":"female"},
    {"voiceName":"GoogleStandard Russian (Elizabeth)","lang":"ru-RU","gender":"female"},
    {"voiceName":"GoogleStandard Russian (Anna)","lang":"ru-RU","gender":"female"},
    {"voiceName":"GoogleStandard Russian (Benjamin)","lang":"ru-RU","gender":"male"},
    {"voiceName":"GoogleStandard Russian (Caroline)","lang":"ru-RU","gender":"female"},
    {"voiceName":"GoogleStandard Russian (Daniel)","lang":"ru-RU","gender":"male"},
    {"voiceName":"GoogleStandard Mandarin (Diane)","lang":"cmn-CN","gender":"female"},
    {"voiceName":"GoogleStandard Mandarin (Anna)","lang":"cmn-CN","gender":"female"},
    {"voiceName":"GoogleStandard Mandarin (Benjamin)","lang":"cmn-CN","gender":"male"},
    {"voiceName":"GoogleStandard Mandarin (Christopher)","lang":"cmn-CN","gender":"male"},
    {"voiceName":"GoogleStandard Korean (Anna)","lang":"ko-KR","gender":"female"},
    {"voiceName":"GoogleStandard Korean (Bianca)","lang":"ko-KR","gender":"female"},
    {"voiceName":"GoogleStandard Korean (Christopher)","lang":"ko-KR","gender":"male"},
    {"voiceName":"GoogleStandard Korean (Daniel)","lang":"ko-KR","gender":"male"},
    {"voiceName":"GoogleStandard Japanese (Anna)","lang":"ja-JP","gender":"female"},
    {"voiceName":"GoogleStandard Japanese (Bianca)","lang":"ja-JP","gender":"female"},
    {"voiceName":"GoogleStandard Japanese (Christopher)","lang":"ja-JP","gender":"male"},
    {"voiceName":"GoogleStandard Japanese (Daniel)","lang":"ja-JP","gender":"male"},
    {"voiceName":"GoogleStandard Vietnamese (Anna)","lang":"vi-VN","gender":"female"},
    {"voiceName":"GoogleStandard Vietnamese (Benjamin)","lang":"vi-VN","gender":"male"},
    {"voiceName":"GoogleStandard Vietnamese (Caroline)","lang":"vi-VN","gender":"female"},
    {"voiceName":"GoogleStandard Vietnamese (Daniel)","lang":"vi-VN","gender":"male"},
    {"voiceName":"GoogleStandard Filipino (Anna)","lang":"fil-PH","gender":"female"},
    {"voiceName":"GoogleStandard Indonesian (Anna)","lang":"id-ID","gender":"female"},
    {"voiceName":"GoogleStandard Indonesian (Benjamin)","lang":"id-ID","gender":"male"},
    {"voiceName":"GoogleStandard Indonesian (Christopher)","lang":"id-ID","gender":"male"},
    {"voiceName":"GoogleStandard Dutch (Anna)","lang":"nl-NL","gender":"female"},
    {"voiceName":"GoogleStandard Dutch (Benjamin)","lang":"nl-NL","gender":"male"},
    {"voiceName":"GoogleStandard Dutch (Christopher)","lang":"nl-NL","gender":"male"},
    {"voiceName":"GoogleStandard Dutch (Diane)","lang":"nl-NL","gender":"female"},
    {"voiceName":"GoogleStandard Dutch (Elizabeth)","lang":"nl-NL","gender":"female"},
    {"voiceName":"GoogleStandard Czech (Anna)","lang":"cs-CZ","gender":"female"},
    {"voiceName":"GoogleStandard Greek, Modern (Anna)","lang":"el-GR","gender":"female"},
    {"voiceName":"GoogleStandard Brazilian Portuguese (Anna)","lang":"pt-BR","gender":"female"},
    {"voiceName":"GoogleStandard Hungarian (Anna)","lang":"hu-HU","gender":"female"},
    {"voiceName":"GoogleStandard Polish (Elizabeth)","lang":"pl-PL","gender":"female"},
    {"voiceName":"GoogleStandard Polish (Anna)","lang":"pl-PL","gender":"female"},
    {"voiceName":"GoogleStandard Polish (Benjamin)","lang":"pl-PL","gender":"male"},
    {"voiceName":"GoogleStandard Polish (Christopher)","lang":"pl-PL","gender":"male"},
    {"voiceName":"GoogleStandard Polish (Diane)","lang":"pl-PL","gender":"female"},
    {"voiceName":"GoogleStandard Slovak (Anna)","lang":"sk-SK","gender":"female"},
    {"voiceName":"GoogleStandard Turkish (Anna)","lang":"tr-TR","gender":"female"},
    {"voiceName":"GoogleStandard Turkish (Benjamin)","lang":"tr-TR","gender":"male"},
    {"voiceName":"GoogleStandard Turkish (Caroline)","lang":"tr-TR","gender":"female"},
    {"voiceName":"GoogleStandard Turkish (Diane)","lang":"tr-TR","gender":"female"},
    {"voiceName":"GoogleStandard Turkish (Ethan)","lang":"tr-TR","gender":"male"},
    {"voiceName":"GoogleStandard Ukrainian (Anna)","lang":"uk-UA","gender":"female"},
    {"voiceName":"GoogleStandard Indian English (Anna)","lang":"en-IN","gender":"female"},
    {"voiceName":"GoogleStandard Indian English (Benjamin)","lang":"en-IN","gender":"male"},
    {"voiceName":"GoogleStandard Indian English (Christopher)","lang":"en-IN","gender":"male"},
    {"voiceName":"GoogleStandard Hindi (Anna)","lang":"hi-IN","gender":"female"},
    {"voiceName":"GoogleStandard Hindi (Benjamin)","lang":"hi-IN","gender":"male"},
    {"voiceName":"GoogleStandard Hindi (Christopher)","lang":"hi-IN","gender":"male"},
    {"voiceName":"GoogleStandard Danish (Anna)","lang":"da-DK","gender":"female"},
    {"voiceName":"GoogleStandard Finnish (Anna)","lang":"fi-FI","gender":"female"},
    {"voiceName":"GoogleStandard Portuguese (Anna)","lang":"pt-PT","gender":"female"},
    {"voiceName":"GoogleStandard Portuguese (Benjamin)","lang":"pt-PT","gender":"male"},
    {"voiceName":"GoogleStandard Portuguese (Christopher)","lang":"pt-PT","gender":"male"},
    {"voiceName":"GoogleStandard Portuguese (Diane)","lang":"pt-PT","gender":"female"},
    {"voiceName":"GoogleStandard Norwegian Bokmål (Elizabeth)","lang":"nb-NO","gender":"female"},
    {"voiceName":"GoogleStandard Norwegian Bokmål (Anna)","lang":"nb-NO","gender":"female"},
    {"voiceName":"GoogleStandard Norwegian Bokmål (Benjamin)","lang":"nb-NO","gender":"male"},
    {"voiceName":"GoogleStandard Norwegian Bokmål (Caroline)","lang":"nb-NO","gender":"female"},
    {"voiceName":"GoogleStandard Norwegian Bokmål (Daniel)","lang":"nb-NO","gender":"male"},
    {"voiceName":"GoogleStandard Swedish (Anna)","lang":"sv-SE","gender":"female"},
    {"voiceName":"GoogleStandard British English (Anna)","lang":"en-GB","gender":"female"},
    {"voiceName":"GoogleStandard British English (Benjamin)","lang":"en-GB","gender":"male"},
    {"voiceName":"GoogleStandard British English (Caroline)","lang":"en-GB","gender":"female"},
    {"voiceName":"GoogleStandard British English (Daniel)","lang":"en-GB","gender":"male"},
    {"voiceName":"GoogleStandard US English (Benjamin)","lang":"en-US","gender":"male"},
    {"voiceName":"GoogleStandard US English (Caroline)","lang":"en-US","gender":"female"},
    {"voiceName":"GoogleStandard US English (Daniel)","lang":"en-US","gender":"male"},
    {"voiceName":"GoogleStandard US English (Elizabeth)","lang":"en-US","gender":"female"},
    {"voiceName":"GoogleStandard German (Anna)","lang":"de-DE","gender":"female"},
    {"voiceName":"GoogleStandard German (Benjamin)","lang":"de-DE","gender":"male"},
    {"voiceName":"GoogleStandard German (Ethan)","lang":"de-DE","gender":"male"},
    {"voiceName":"GoogleStandard Australian English (Anna)","lang":"en-AU","gender":"female"},
    {"voiceName":"GoogleStandard Australian English (Benjamin)","lang":"en-AU","gender":"male"},
    {"voiceName":"GoogleStandard Australian English (Caroline)","lang":"en-AU","gender":"female"},
    {"voiceName":"GoogleStandard Australian English (Daniel)","lang":"en-AU","gender":"male"},
    {"voiceName":"GoogleStandard Canadian French (Anna)","lang":"fr-CA","gender":"female"},
    {"voiceName":"GoogleStandard Canadian French (Benjamin)","lang":"fr-CA","gender":"male"},
    {"voiceName":"GoogleStandard Canadian French (Caroline)","lang":"fr-CA","gender":"female"},
    {"voiceName":"GoogleStandard Canadian French (Daniel)","lang":"fr-CA","gender":"male"},
    {"voiceName":"GoogleStandard French (Anna)","lang":"fr-FR","gender":"female"},
    {"voiceName":"GoogleStandard French (Benjamin)","lang":"fr-FR","gender":"male"},
    {"voiceName":"GoogleStandard French (Caroline)","lang":"fr-FR","gender":"female"},
    {"voiceName":"GoogleStandard French (Daniel)","lang":"fr-FR","gender":"male"},
    {"voiceName":"GoogleStandard Italian (Bianca)","lang":"it-IT","gender":"female"},
    {"voiceName":"GoogleStandard Italian (Christopher)","lang":"it-IT","gender":"male"},
    {"voiceName":"GoogleStandard Italian (Daniel)","lang":"it-IT","gender":"male"},
  ]
}


function IbmWatsonTtsEngine() {
  this.speak = function(utterance, options, playbackState$) {
    const urlPromise = getAudioUrl(utterance, options)
    return playAudio(urlPromise, options, playbackState$)
  };
  this.prefetch = function(utterance, options) {
    getAudioUrl(utterance, options)
      .catch(console.error)
  };
  this.getVoices = function() {
    return getSettings(["watsonVoices", "ibmCreds"])
      .then(function(items) {
        if (!items.ibmCreds) return [];
        if (items.watsonVoices && Date.now()-items.watsonVoices[0].ts < 24*3600*1000) return items.watsonVoices;
        return fetchVoices(items.ibmCreds.apiKey, items.ibmCreds.url)
          .then(function(list) {
            list[0].ts = Date.now();
            updateSettings({watsonVoices: list}).catch(console.error);
            return list;
          })
          .catch(function(err) {
            console.error(err);
            return [];
          })
      })
  }
  this.fetchVoices = fetchVoices;

  function getAudioUrl(text, {voice}) {
    assert(text && voice);
    var matches = voice.voiceName.match(/^IBM-Watson .* \((\w+)\)$/);
    var voiceName = voice.lang + "_" + matches[1] + "Voice";
    return cache.fetchCached(
      JSON.stringify([text, voiceName]),
      async () => {
        const settings = await getSettings(["ibmCreds"])
        const blob = await ajaxGet({
          url: settings.ibmCreds.url + "/v1/synthesize?text=" + encodeURIComponent(escapeHtml(text)) + "&voice=" + encodeURIComponent(voiceName) + "&accept=" + encodeURIComponent("audio/ogg;codecs=opus"),
          headers: {
            Authorization: "Basic " + btoa("apikey:" + settings.ibmCreds.apiKey)
          },
          responseType: "blob"
        })
        return URL.createObjectURL(blob);
      },
      blobUrl => URL.revokeObjectURL(blobUrl)
    )
  }
  function fetchVoices(apiKey, url) {
    return ajaxGet({
        url: url + "/v1/voices",
        headers: {
          Authorization: "Basic " + btoa("apikey:" + apiKey)
        }
      })
      .then(JSON.parse)
      .then(function(data) {
        return data.voices.map(item => {
          item.description = item.description.replace(/Chinese \((Mandarin|Cantonese)\)/, "Chinese, $1");
          return {
            voiceName: "IBM-Watson " + item.description.split(/: | male| female| \(/)[1] + " (" + item.name.slice(item.language.length+1, -5) + ")",
            lang: item.language,
            gender: item.gender,
          }
        })
      })
  }
}


function PhoneTtsEngine() {
  var isSpeaking = false
  var conn
  const pendingRequests = new Map()
  const getPairingCode = lazy(() => 100000 + Math.floor(Math.random() * 900000))
  const getPeer = lazy(async () => {
    const peer = new Peer("readaloud-" + getPairingCode(), {debug: 2})
    await new Promise((f,r) => peer.once("open", f).once("error", r))
    peer.on("connection", newConn => {
      const makeError = reason => new Error(JSON.stringify({code: "error_phone_disconnected", reason}))
      newConn.readyPromise = new Promise((fulfill, reject) => {
        newConn.once("open", fulfill)
          .once("error", err => reject(makeError(err.message || err)))
      })
      newConn.once("close", () => newConn.readyPromise = Promise.reject(makeError("Connection lost")))
      newConn.on("error", console.error)
      newConn.on("data", res => {
        const pending = pendingRequests.get(res.id)
        if (pending) {
          if (res.error) pending.reject(new Error(res.error))
          else pending.fulfill(res.value)
        }
        else {
          console.warn("Response received but no pending request", res)
        }
      })
      newConn.peerConnection.addEventListener("connectionstatechange", () => {
        //https://bugs.chromium.org/p/chromium/issues/detail?id=982793#c15
        if (newConn.peerConnection.connectionState == "failed") newConn.close()
      })
      if (conn) conn.close()
      conn = newConn
    })
    window.addEventListener("beforeunload", () => peer.destroy())
    return peer
  })
  this.startPairing = async function() {
    if (conn) {
      conn.close()
      conn = null
    }
    const peer = await getPeer()
    if (peer.disconnected) peer.reconnect()
    return getPairingCode()
  }
  this.isPaired = async function() {
    return conn != null
  }
  async function sendRequest(req, timeout) {
    req.id = String(Math.random())
    await conn.readyPromise
    conn.send(req)
    const responsePromise = new Promise((fulfill, reject) => pendingRequests.set(req.id, {fulfill, reject}))
    try {
      return await promiseTimeout(timeout || 5000, "Request timed out", responsePromise)
    }
    catch(err) {
      if (err.message == "Request timed out") {
        console.warn("Request timed out, assuming phone connection lost")
        conn.close()
      }
      throw err
    }
    finally {
      pendingRequests.delete(req.id)
    }
  }
  this.speak = function(text, options, onEvent) {
    if (!conn) {
      onEvent({type: "error", error: new Error(JSON.stringify({code: "error_phone_not_connected"}))})
      return
    }
    sendRequest({
        method: "speak",
        text,
        options: {
          lang: options.lang,
          rate: options.rate,
          pitch: options.pitch,
          volume: options.volume
        }
      })
      .then(({speechId}) => {
        onEvent({type: "start", charIndex: 0})
        isSpeaking = true
        sendRequest({method: "waitFinish", speechId}, 3*60*1000)
          .then(() => onEvent({type: "end", charIndex: text.length}),
            err => {
              if (err.message != "interrupted") onEvent({type: "error", error: err})
            })
          .finally(() => isSpeaking = false)
      })
      .catch(err => {
        if (err.message != "canceled") onEvent({type: "error", error: err})
      })
  }
  this.stop = function() {
    if (!conn) return;
    sendRequest({method: "stop"}).catch(console.error)
  }
  this.pause = function() {
    sendRequest({method: "pause"}).catch(console.error)
  }
  this.resume = function() {
    sendRequest({method: "resume"}).catch(console.error)
  }
  this.isSpeaking = function(callback) {
    callback(isSpeaking)
  }
  this.getVoices = function() {
    return [
      {voiceName: "Use My Phone", remote: false, isUseMyPhone: true},
    ]
  }
}


function OpenaiTtsEngine() {
  this.defaultEndpointUrl = "https://api.openai.com/v1"
  this.defaultVoiceList = [
    {voice: "alloy", langs: ["en-US", "zh-CN"], model: "tts-1"},
    {voice: "ash", langs: ["en-US", "zh-CN"], model: "tts-1"},
    {voice: "coral", langs: ["en-US", "zh-CN"], model: "tts-1"},
    {voice: "echo", langs: ["en-US", "zh-CN"], model: "tts-1"},
    {voice: "fable", langs: ["en-US", "zh-CN"], model: "tts-1"},
    {voice: "onyx", langs: ["en-US", "zh-CN"], model: "tts-1"},
    {voice: "nova", langs: ["en-US", "zh-CN"], model: "tts-1"},
    {voice: "sage", langs: ["en-US", "zh-CN"], model: "tts-1"},
    {voice: "shimmer", langs: ["en-US", "zh-CN"], model: "tts-1"},
  ]
  this.test = async function({apiKey, url, voiceList}) {
    const res = await fetch(url + "/models", {
      headers: {"Authorization": "Bearer " + apiKey}
    })
    if (!res.ok) {
      const {error} = await res.json()
      throw error
    }
  }
  this.speak = function(utterance, options, playbackState$) {
    const urlPromise = getAudioUrl(utterance, options)
    return playAudio(urlPromise, options, playbackState$)
  }
  this.prefetch = function(utterance, options) {
    getAudioUrl(utterance, options)
      .catch(console.error)
  }
  this.getVoices = async function() {
    const openaiCreds = await getSetting("openaiCreds")
    const voiceList = openaiCreds ? (openaiCreds.voiceList || this.defaultVoiceList) : []
    return voiceList.map(({voice, lang, langs}) => ({
      voiceName: "OpenAI " + voice,
      lang,
      langs
    }))
  }
  function getAudioUrl(text, {voice}) {
    assert(text && voice)
    const voiceId = voice.voiceName.slice(7)
    return cache.fetchCached(
      JSON.stringify([text, voiceId]),
      async () => {
        const {openaiCreds} = await getSettings(["openaiCreds"])
        const voiceInfo = openaiCreds.voiceList.find(x => x.voice == voiceId)
        assert(voiceInfo, "Voice not found " + voiceId)
        // Language metadata is for voice selection, not the speech endpoint.
        const {lang, langs, ...requestParams} = voiceInfo
        const res = await fetch(openaiCreds.url + "/audio/speech", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(
              openaiCreds.apiKey ? {
                "Authorization": "Bearer " + openaiCreds.apiKey
              } : null
            )
          },
          body: JSON.stringify({
            ...requestParams,
            input: text,
            response_format: "mp3",
          })
        })
        if (!res.ok) throw await res.json().then(x => x.error)
        return URL.createObjectURL(await res.blob())
      },
      blobUrl => URL.revokeObjectURL(blobUrl)
    )
  }
}


function AzureTtsEngine() {
  this.speak = function(utterance, options, playbackState$) {
    const urlPromise = getAudioUrl(utterance, options)
    return playAudio(urlPromise, options, playbackState$)
  };
  this.prefetch = function(utterance, options) {
    getAudioUrl(utterance, options)
      .catch(console.error)
  };
  this.getVoices = async function() {
    try {
      const {azureCreds, azureVoices} = await getSettings(["azureCreds", "azureVoices"])
      if (!azureCreds) return []
      if (azureVoices && azureVoices.expire > Date.now()) return azureVoices.list
      const list = await this.fetchVoices(azureCreds.region, azureCreds.key)
      await updateSettings({azureVoices: {list, expire: Date.now() + 24*3600*1000}})
      return list
    }
    catch (err) {
      console.error(err)
      return []
    }
  }
  this.fetchVoices = async function(region, key) {
    const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/voices/list`, {
      method: "GET",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
      }
    })
    if (!res.ok) throw new Error("Server return " + res.status)
    const voices = await res.json()
    return voices.map(item => {
      const name = item.ShortName.split("-")[2]
      return {
        voiceName: "Azure " + item.LocaleName + " - " + name,
        lang: item.Locale,
        gender: item.Gender == "Male" ? "male" : "female",
      }
    })
  }
  function getAudioUrl(text, {lang, voice}) {
    const matches = voice.voiceName.match(/^Azure .* - (\w+)$/)
    const voiceName = voice.lang + "-" + matches[1]
    return cache.fetchCached(
      JSON.stringify([text, lang, voiceName]),
      async () => {
        const {azureCreds} = await getSettings(["azureCreds"])
        const {region, key} = azureCreds
        const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
          method: "POST",
          headers: {
            "Ocp-Apim-Subscription-Key": key,
            "Content-Type": "application/ssml+xml",
            "X-Microsoft-OutputFormat": "ogg-48khz-16bit-mono-opus",
          },
          body: `<speak version='1.0' xml:lang='${lang}'><voice name='${voiceName}'>${escapeXml(text)}</voice></speak>`
        })
        if (!res.ok) throw new Error("Server return " + res.status)
        const blob = await res.blob()
        return URL.createObjectURL(blob)
      },
      blobUrl => URL.revokeObjectURL(blobUrl)
    )
  }
}


function EdgeTtsEngine() {
  const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4"
  
  this.speak = function(utterance, options, playbackState$) {
    const urlPromise = getAudioUrl(utterance, options)
    return playAudio(urlPromise, options, playbackState$)
  };
  this.prefetch = function(utterance, options) {
    getAudioUrl(utterance, options)
      .catch(console.error)
  };
  this.getVoices = async function() {
    try {
      const {edgeVoices} = await getSettings(["edgeVoices"])
      if (edgeVoices && edgeVoices.expire > Date.now()) return edgeVoices.list
      const list = await this.fetchVoices()
      await updateSettings({edgeVoices: {list, expire: Date.now() + 24*3600*1000}})
      return list
    }
    catch (err) {
      console.error(err)
      return this.getDefaultVoices()
    }
  }
  this.fetchVoices = async function() {
    if (!globalThis.EdgeSecMsGec) throw new Error("EdgeSecMsGec not loaded")
    const gecToken = globalThis.EdgeSecMsGec.generateSecMsGecV2()
    const url = `https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list?trustedclienttoken=${TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${gecToken}&Sec-MS-GEC-Version=${globalThis.EdgeSecMsGec.SEC_MS_GEC_VERSION}`
    const res = await fetch(url)
    if (!res.ok) throw new Error("Server return " + res.status)
    const voices = await res.json()
    return voices
      .filter(item => item.ShortName && item.Locale)
      .map(item => ({
        voiceName: "Edge " + item.FriendlyName,
        lang: item.Locale,
        gender: item.Gender == "Male" ? "male" : "female",
        shortName: item.ShortName
      }))
  }
  this.getDefaultVoices = function() {
    return [
      {voiceName: "Edge Xiaoxiao - Chinese (Mainland)", lang: "zh-CN", gender: "female", shortName: "zh-CN-XiaoxiaoNeural"},
      {voiceName: "Edge Yunyang - Chinese (Mainland)", lang: "zh-CN", gender: "male", shortName: "zh-CN-YunyangNeural"},
      {voiceName: "Edge Xiaoyi - Chinese (Mainland)", lang: "zh-CN", gender: "female", shortName: "zh-CN-XiaoyiNeural"},
      {voiceName: "Edge Yunjian - Chinese (Mainland)", lang: "zh-CN", gender: "male", shortName: "zh-CN-YunjianNeural"},
      {voiceName: "Edge Yunxi - Chinese (Mainland)", lang: "zh-CN", gender: "male", shortName: "zh-CN-YunxiNeural"},
      {voiceName: "Edge Yunxia - Chinese (Mainland)", lang: "zh-CN", gender: "male", shortName: "zh-CN-YunxiaNeural"},
      {voiceName: "Edge Xiaobei - Chinese (Mainland, Liaoning)", lang: "zh-CN-liaoning", gender: "female", shortName: "zh-CN-liaoning-XiaobeiNeural"},
      {voiceName: "Edge Xiaoni - Chinese (Mainland, Shaanxi)", lang: "zh-CN-shaanxi", gender: "female", shortName: "zh-CN-shaanxi-XiaoniNeural"},
      {voiceName: "Edge HiuGaai - Chinese (Hong Kong)", lang: "zh-HK", gender: "female", shortName: "zh-HK-HiuGaaiNeural"},
      {voiceName: "Edge WanLung - Chinese (Hong Kong)", lang: "zh-HK", gender: "male", shortName: "zh-HK-WanLungNeural"},
      {voiceName: "Edge HsiaoChen - Chinese (Taiwan)", lang: "zh-TW", gender: "female", shortName: "zh-TW-HsiaoChenNeural"},
      {voiceName: "Edge YunJhe - Chinese (Taiwan)", lang: "zh-TW", gender: "male", shortName: "zh-TW-YunJheNeural"},
      {voiceName: "Edge Aria - English (United States)", lang: "en-US", gender: "female", shortName: "en-US-AriaNeural"},
      {voiceName: "Edge Jenny - English (United States)", lang: "en-US", gender: "female", shortName: "en-US-JennyNeural"},
      {voiceName: "Edge Guy - English (United States)", lang: "en-US", gender: "male", shortName: "en-US-GuyNeural"},
      {voiceName: "Edge Davis - English (United States)", lang: "en-US", gender: "male", shortName: "en-US-DavisNeural"},
      {voiceName: "Edge Jane - English (United States)", lang: "en-US", gender: "female", shortName: "en-US-JaneNeural"},
      {voiceName: "Edge Jason - English (United States)", lang: "en-US", gender: "male", shortName: "en-US-JasonNeural"},
      {voiceName: "Edge Sara - English (United States)", lang: "en-US", gender: "female", shortName: "en-US-SaraNeural"},
      {voiceName: "Edge Tony - English (United States)", lang: "en-US", gender: "male", shortName: "en-US-TonyNeural"},
      {voiceName: "Edge Sonia - English (United Kingdom)", lang: "en-GB", gender: "female", shortName: "en-GB-SoniaNeural"},
      {voiceName: "Edge Ryan - English (United Kingdom)", lang: "en-GB", gender: "male", shortName: "en-GB-RyanNeural"},
      {voiceName: "Edge Natasha - English (Australia)", lang: "en-AU", gender: "female", shortName: "en-AU-NatashaNeural"},
      {voiceName: "Edge William - English (Australia)", lang: "en-AU", gender: "male", shortName: "en-AU-WilliamNeural"},
      {voiceName: "Edge Clara - English (Canada)", lang: "en-CA", gender: "female", shortName: "en-CA-ClaraNeural"},
      {voiceName: "Edge Liam - English (Canada)", lang: "en-CA", gender: "male", shortName: "en-CA-LiamNeural"},
    ]
  }
  function getAudioUrl(text, {voice}) {
    const shortName = voice.shortName
    if (!shortName) {
      throw new Error("Voice missing shortName: " + voice.voiceName)
    }
    return cache.fetchCached(
      JSON.stringify(["edge-v3-http", text, shortName]),
      async () => {
        const audioData = await synthesizeSpeech(text, shortName)
        return URL.createObjectURL(audioData)
      },
      blobUrl => URL.revokeObjectURL(blobUrl)
    )
  }

  async function synthesizeSpeech(text, voiceName) {
    const endpoint = await getEdgeEndpoint()
    const url = `https://${endpoint.r}.tts.speech.microsoft.com/cognitiveservices/v1`
    const ssml = getEdgeSsml(text, voiceName)
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": endpoint.t,
        "Content-Type": "application/ssml+xml",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0",
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3"
      },
      body: ssml
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Edge TTS synthesis failed: ${response.status} ${errorText}`)
    }
    
    const audioBuffer = await response.arrayBuffer()
    return new Blob([audioBuffer], {type: "audio/mpeg"})
  }

  function getEdgeSsml(text, voiceName) {
    const escapedText = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
    
    return `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>
      <voice name='${voiceName}'>
        <prosody rate='+0%' pitch='+0Hz' volume='+0%'>${escapedText}</prosody>
      </voice>
    </speak>`
  }

  let edgeTokenCache = null

  async function getEdgeEndpoint() {
    const now = Date.now() / 1000
    if (edgeTokenCache && edgeTokenCache.expiredAt && now < edgeTokenCache.expiredAt - 300) {
      return edgeTokenCache.endpoint
    }

    const endpointUrl = "https://dev.microsofttranslator.com/apps/endpoint?api-version=1.0"
    const clientId = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .replace(/-/g, '')
    
    const signature = await signEdgeRequest(endpointUrl)
    
    const response = await fetch(endpointUrl, {
      method: "POST",
      headers: {
        "Accept-Language": "en-US",
        "X-ClientVersion": "4.0.530a 5fe1dc6c",
        "X-UserId": "0f04d16a175c411e",
        "X-HomeGeographicRegion": "en-US",
        "X-ClientTraceId": clientId,
        "X-MT-Signature": signature,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0",
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": "0"
      }
    })
    
    if (!response.ok) {
      throw new Error(`Failed to get Edge endpoint: ${response.status}`)
    }
    
    const data = await response.json()
    const jwt = data.t.split(".")[1]
    const decodedJwt = JSON.parse(atob(jwt))
    
    edgeTokenCache = {
      endpoint: data,
      expiredAt: decodedJwt.exp
    }
    
    return data
  }

  async function signEdgeRequest(urlStr) {
    const url = urlStr.split("://")[1]
    const encodedUrl = encodeURIComponent(url)
    const uuidStr = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .replace(/-/g, '')
    const formattedDate = new Date().toUTCString().replace(/GMT/, "").trim() + " GMT"
    const formattedDateLower = formattedDate.toLowerCase()
    
    const bytesToSign = `MSTranslatorAndroidApp${encodedUrl}${formattedDateLower}${uuidStr}`.toLowerCase()
    const keyBase64 = "oik6PdDdMnOXemTbwvMn9de/h9lFnfBaCWbGMMZqqoSaQaqUOqjVGm5NqsmjcBI1x+sS9ugjB55HEJWRiFXYFw=="
    const keyBytes = Uint8Array.from(atob(keyBase64), c => c.charCodeAt(0))
    
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "HMAC", hash: { name: "SHA-256" } },
      false,
      ["sign"]
    )
    
    const signature = await crypto.subtle.sign(
      "HMAC",
      cryptoKey,
      new TextEncoder().encode(bytesToSign)
    )
    
    const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    return `MSTranslatorAndroidApp::${signatureBase64}::${formattedDateLower}::${uuidStr}`
  }

}


function PiperTtsEngine() {
  let control = null
  let isSpeaking = false
  this.speak = function(utterance, options, onEvent) {
    const piperPromise = rxjs.firstValueFrom(piperObservable)
    control = new rxjs.Subject()
    control
      .pipe(
        rxjs.startWith("speak"),
        rxjs.concatMap(async cmd => {
          const piper = await piperPromise
          switch (typeof cmd == "string" ? cmd : cmd.type) {
            case "speak":
              return piper.sendRequest("speak", {
                utterance,
                voiceName: options.voice.voiceName,
                pitch: options.pitch,
                rate: options.rate,
                volume: options.volume,
                externalPlayback: options.rate && options.rate != 1,
              })
            case "pause":
              return piper.sendRequest("pause")
            case "resume":
              return piper.sendRequest("resume")
            case "stop":
              return piper.sendRequest("stop")
                .then(() => Promise.reject({name: "interrupted", message: "Playback interrupted"}))
            case "forward":
              return piper.sendRequest("forward")
            case "rewind":
              return piper.sendRequest("rewind")
            case "seek":
              return piper.sendRequest("seek", {index: cmd.index})
          }
        }),
        rxjs.ignoreElements(),
        rxjs.mergeWith(piperCallbacks),
        rxjs.map(event => {
          if (event.type == "error") throw event.error
          return event
        }),
        rxjs.takeWhile(event => event.type != "end")
      )
      .subscribe({
        next(event) {
          if (event.type == "start") isSpeaking = true
          onEvent(event)
        },
        complete() {
          onEvent({type: "end"})
        },
        error(err) {
          if (err.name != "interrupted") onEvent({type: "error", error: err})
        }
      })
      .add(() => {
        isSpeaking = false
        control = null
      })
  }
  this.isSpeaking = function(callback) {
    callback(isSpeaking)
  }
  this.pause = function() {
    control?.next("pause")
  }
  this.resume = function() {
    control?.next("resume")
  }
  this.stop = function() {
    control?.next("stop")
  }
  this.forward = function() {
    control?.next("forward")
  }
  this.rewind = function() {
    control?.next("rewind")
  }
  this.seek = function(index) {
    control?.next({type: "seek", index})
  }
}


function SupertonicTtsEngine() {
  let control = null
  let isSpeaking = false
  this.speak = function(utterance, options, onEvent) {
    const supertonicPromise = rxjs.firstValueFrom(supertonic$)
    control = new rxjs.Subject()
    control.pipe(
      rxjs.startWith("speak"),
      rxjs.concatMap(async cmd => {
        const supertonic = await supertonicPromise
        switch (typeof cmd == "string" ? cmd : cmd.type) {
          case "speak":
            return supertonic.sendRequest("speak", {
              utterance,
              voiceName: options.voice.voiceName,
              pitch: options.pitch,
              rate: options.rate,
              volume: options.volume,
              externalPlayback: options.rate && options.rate != 1,
            })
          case "pause":
            return supertonic.sendRequest("pause")
          case "resume":
            return supertonic.sendRequest("resume")
          case "stop":
            return supertonic.sendRequest("stop")
              .then(() => Promise.reject({name: "interrupted", message: "Playback interrupted"}))
          case "forward":
            return supertonic.sendRequest("forward")
          case "rewind":
            return supertonic.sendRequest("rewind")
          case "seek":
            return supertonic.sendRequest("seek", {index: cmd.index})
        }
      }),
      rxjs.ignoreElements(),
      rxjs.mergeWith(supertonicCallbacks),
      rxjs.map(event => {
        if (event.type == "error") throw event.error
        return event
      }),
      rxjs.takeWhile(event => event.type != "end")
    )
    .subscribe({
      next(event) {
        if (event.type == "start") isSpeaking = true
        onEvent(event)
      },
      complete() {
        onEvent({type: "end"})
      },
      error(err) {
        if (err.name != "interrupted") onEvent({type: "error", error: err})
      }
    })
    .add(() => {
      isSpeaking = false
      control = null
    })
  }
  this.isSpeaking = function(callback) {
    callback(isSpeaking)
  }
  this.pause = function() {
    control?.next("pause")
  }
  this.resume = function() {
    control?.next("resume")
  }
  this.stop = function() {
    control?.next("stop")
  }
  this.forward = function() {
    control?.next("forward")
  }
  this.rewind = function() {
    control?.next("rewind")
  }
  this.seek = function(index) {
    control?.next({type: "seek", index})
  }
}


function PocketTtsEngine() {
  let control = null
  let isSpeaking = false
  this.speak = function(utterance, options, onEvent) {
    const pocketTtsPromise = rxjs.firstValueFrom(pocketTts$)
    control = new rxjs.Subject()
    control.pipe(
      rxjs.startWith("speak"),
      rxjs.concatMap(async cmd => {
        const pocketTts = await pocketTtsPromise
        switch (typeof cmd == "string" ? cmd : cmd.type) {
          case "speak":
            return pocketTts.sendRequest("speak", {
              utterance,
              voiceName: options.voice.voiceName,
              pitch: options.pitch,
              rate: options.rate,
              volume: options.volume,
              externalPlayback: options.rate && options.rate != 1,
            })
          case "pause":
            return pocketTts.sendRequest("pause")
          case "resume":
            return pocketTts.sendRequest("resume")
          case "stop":
            return pocketTts.sendRequest("stop")
              .then(() => Promise.reject({name: "interrupted", message: "Playback interrupted"}))
          case "forward":
            return pocketTts.sendRequest("forward")
          case "rewind":
            return pocketTts.sendRequest("rewind")
          case "seek":
            return pocketTts.sendRequest("seek", {index: cmd.index})
        }
      }),
      rxjs.ignoreElements(),
      rxjs.mergeWith(pocketTtsCallbacks),
      rxjs.map(event => {
        if (event.type == "error") throw event.error
        return event
      }),
      rxjs.takeWhile(event => event.type != "end")
    )
    .subscribe({
      next(event) {
        if (event.type == "start") isSpeaking = true
        onEvent(event)
      },
      complete() {
        onEvent({type: "end"})
      },
      error(err) {
        if (err.name != "interrupted") onEvent({type: "error", error: err})
      }
    })
    .add(() => {
      isSpeaking = false
      control = null
    })
  }
  this.isSpeaking = function(callback) {
    callback(isSpeaking)
  }
  this.pause = function() {
    control?.next("pause")
  }
  this.resume = function() {
    control?.next("resume")
  }
  this.stop = function() {
    control?.next("stop")
  }
  this.forward = function() {
    control?.next("forward")
  }
  this.rewind = function() {
    control?.next("rewind")
  }
  this.seek = function(index) {
    control?.next({type: "seek", index})
  }
}


function NghiTtsEngine() {
  let control = null
  let isSpeaking = false
  this.speak = function(utterance, options, onEvent) {
    const nghiTtsPromise = rxjs.firstValueFrom(nghiTtsObservable)
    control = new rxjs.Subject()
    control.pipe(
      rxjs.startWith("speak"),
      rxjs.concatMap(async cmd => {
        const nghiTts = await nghiTtsPromise
        switch (typeof cmd == "string" ? cmd : cmd.type) {
          case "speak":
            return nghiTts.sendRequest("speak", {
              utterance,
              voiceName: options.voice.voiceName,
              pitch: options.pitch,
              rate: options.rate,
              volume: options.volume,
            })
          case "pause":
            return nghiTts.sendRequest("pause")
          case "resume":
            return nghiTts.sendRequest("resume")
          case "stop":
            return nghiTts.sendRequest("stop")
              .then(() => Promise.reject({name: "interrupted", message: "Playback interrupted"}))
          case "forward":
            return nghiTts.sendRequest("forward")
          case "rewind":
            return nghiTts.sendRequest("rewind")
          case "seek":
            return nghiTts.sendRequest("seek", {index: cmd.index})
        }
      }),
      rxjs.ignoreElements(),
      rxjs.mergeWith(nghiTtsCallbacks),
      rxjs.map(event => {
        if (event.type == "error") throw event.error
        return event
      }),
      rxjs.takeWhile(event => event.type != "end")
    )
    .subscribe({
      next(event) {
        if (event.type == "start") isSpeaking = true
        onEvent(event)
      },
      complete() {
        onEvent({type: "end"})
      },
      error(err) {
        if (err.name != "interrupted") onEvent({type: "error", error: err})
      }
    })
    .add(() => {
      isSpeaking = false
      control = null
    })
  }
  this.isSpeaking = function(callback) {
    callback(isSpeaking)
  }
  this.pause = function() {
    control?.next("pause")
  }
  this.resume = function() {
    control?.next("resume")
  }
  this.stop = function() {
    control?.next("stop")
  }
  this.forward = function() {
    control?.next("forward")
  }
  this.rewind = function() {
    control?.next("rewind")
  }
  this.seek = function(index) {
    control?.next({type: "seek", index})
  }
}
