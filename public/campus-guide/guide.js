import { bfsPath, nearestNode, pathLength } from "./path.js";

const WELCOME = "Welcome to Sensory Scribbles, Wellesley College. Walk around campus, explore, and chill.";
const AUDIO_KEY = "ss-guide-audio";
const STEPS_KEY = "ss-walk-sounds";
const DONE_KEY = "ss-guide-done";

export async function startCampusGuide({ engine, parentOrigin, userId, roomId }) {
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
  const root = document.createElement("div");
  root.className = `ss-guide${reduce ? " ss-instant" : ""}`;
  document.body.appendChild(root);
  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = new URL("./guide.css", import.meta.url).href;
  document.head.appendChild(css);

  let settings = { muted: false, volume: 0.7 };
  try {
    const saved = JSON.parse(localStorage.getItem(AUDIO_KEY) || "");
    if (typeof saved.muted === "boolean") settings.muted = saved.muted;
    if (typeof saved.volume === "number") settings.volume = Math.min(1, Math.max(0, saved.volume));
  } catch {
    settings = { muted: false, volume: 0.7 };
  }

  let stepsOn = true;
  try {
    if (localStorage.getItem(STEPS_KEY) === "off") stepsOn = false;
  } catch {
    stepsOn = true;
  }
  let stepAudio = null;
  let lastStepAt = 0;

  let entered = false;
  let audioStarted = false;
  let ambient = null;
  let voice = null;
  let quests = [];
  let graph = { nodes: [], edges: [], landmarks: [], bounds: { minX: -140, maxX: 110, minZ: -110, maxZ: 150 } };
  let lines = new Map([["welcome", WELCOME]]);
  let prompts = new Map();
  const done = new Set(JSON.parse(localStorage.getItem(DONE_KEY) || "[]"));
  const declined = new Set();
  const inside = new Set();
  let activeQuest = null;
  let route = [];
  let hint = "";
  let currentLine = { id: "welcome", text: WELCOME };
  let animal = null;
  const audioReady = new Set();

  const session = (() => {
    const key = "ss-guide-session";
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID?.() || `s${Date.now()}`;
      sessionStorage.setItem(key, id);
    }
    return id;
  })();

  function saveSettings() {
    localStorage.setItem(AUDIO_KEY, JSON.stringify(settings));
  }

  function audioUrl(file) {
    return `${parentOrigin}/audio/${file}`;
  }

  function rememberDone(id) {
    done.add(id);
    localStorage.setItem(DONE_KEY, JSON.stringify([...done]));
  }

  function pose() {
    return engine?.getLocalMultiplayerPose?.() || engine?.getGuidePose?.() || null;
  }

  function project(x, z, width, height) {
    const b = graph.bounds;
    const px = ((x - b.minX) / (b.maxX - b.minX)) * width;
    const py = ((z - b.minZ) / (b.maxZ - b.minZ)) * height;
    return [px, py];
  }

  function mapSvg(width, height) {
    const here = pose();
    const marks = [
      ...graph.landmarks.map((item) => ({ ...item, kind: "land" })),
      ...quests.map((item) => ({ ...item, kind: "quest", name: item.title.replace("?", "") })),
    ];
    const dots = marks
      .map((item) => {
        const [x, y] = project(item.x, item.z, width, height);
        const doneQuest = item.kind === "quest" && done.has(item.id);
        const fill = item.kind === "quest" ? (doneQuest ? "#2e7d5b" : "#e28aa4") : "#2b7cb3";
        return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${item.kind === "quest" ? 5 : 3.5}" fill="${fill}"><title>${item.name}</title></circle>`;
      })
      .join("");
    const path = route
      .map((point, index) => {
        const [x, y] = project(point.x, point.z, width, height);
        return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
    const player = here ? project(here.x, here.z, width, height) : null;
    const you = player
      ? `<circle cx="${player[0].toFixed(1)}" cy="${player[1].toFixed(1)}" r="6" fill="#f8e166" stroke="#1f2a3c" stroke-width="1.5"/>`
      : "";
    return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Campus map">${path ? `<path d="${path}" fill="none" stroke="#2e7d5b" stroke-width="3" stroke-linecap="round"/>` : ""}${dots}${you}</svg>`;
  }

  const enter = el("div", "ss-enter");
  const enterBtn = el("button", "ss-enter-btn");
  enterBtn.type = "button";
  enterBtn.dataset.testid = "ss-tap-enter";
  enterBtn.textContent = "Tap to enter";
  enter.appendChild(enterBtn);

  const welcome = el("div", "ss-card ss-welcome");
  welcome.hidden = true;
  welcome.innerHTML = `<h1 class="ss-welcome-text" data-testid="ss-welcome"></h1>`;

  const hintEl = el("div", "ss-card ss-hint");
  hintEl.hidden = true;
  hintEl.dataset.testid = "ss-path-hint";

  const mini = el("button", "ss-card ss-minimap");
  mini.type = "button";
  mini.hidden = true;
  mini.dataset.testid = "ss-minimap";
  mini.setAttribute("aria-label", "Open the campus map");

  const map = el("div", "ss-card ss-map");
  map.hidden = true;
  map.dataset.testid = "ss-map";
  map.innerHTML = `<div data-map></div><p class="ss-map-title" data-testid="ss-map-title">Wellesley College, MA, USA</p><div class="ss-row"><button type="button" class="ss-quiet" data-close-map>Close</button></div>`;

  const helpBtn = el("button", "ss-primary ss-help");
  helpBtn.type = "button";
  helpBtn.dataset.testid = "ss-help";
  helpBtn.textContent = "Help";

  const helpPanel = el("div", "ss-card ss-help-panel");
  helpPanel.hidden = true;
  helpPanel.innerHTML = `
    <strong>Help</strong>
    <div class="ss-row" style="flex-direction:column">
      <button type="button" class="ss-primary" data-testid="ss-help-where">Where do I go?</button>
      <button type="button" class="ss-quiet" data-testid="ss-help-ideas">What should I draw or write?</button>
      <button type="button" class="ss-quiet" data-testid="ss-help-read">Read this to me</button>
    </div>
    <ul class="ss-ideas" data-testid="ss-ideas" hidden></ul>`;

  const volume = el("div", "ss-card ss-volume");
  volume.innerHTML = `<button type="button" class="ss-steps-btn" data-testid="ss-steps" aria-label="Walking sounds">Steps on</button><button type="button" class="ss-icon-btn" data-testid="ss-mute" aria-label="Mute" hidden>Mute</button><input data-testid="ss-volume" type="range" min="0" max="1" step="0.05" aria-label="Volume" hidden />`;

  const popup = el("div", "ss-card ss-popup");
  popup.hidden = true;
  popup.dataset.testid = "ss-quest-popup";
  popup.innerHTML = `<h2 data-title></h2><div class="ss-row"><button type="button" class="ss-primary" data-testid="ss-quest-yes">Yes</button><button type="button" class="ss-quiet" data-testid="ss-quest-no">Not now</button></div>`;

  const animalCard = el("div", "ss-card ss-animal");
  animalCard.hidden = true;
  animalCard.dataset.testid = "ss-animal-panel";
  animalCard.innerHTML = `
    <h2 data-animal-title></h2>
    <textarea data-testid="ss-animal-input" maxlength="80" placeholder="Tell what you notice"></textarea>
    <div class="ss-row">
      <button type="button" class="ss-primary" data-testid="ss-animal-describe">Describe it</button>
      <button type="button" class="ss-quiet" data-say hidden>Say it</button>
      <button type="button" class="ss-quiet" data-close-animal>Close</button>
    </div>
    <p class="ss-reply" data-testid="ss-animal-reply"></p>
    <button type="button" class="ss-primary" data-testid="ss-animal-draw" hidden>Draw or write about it</button>`;

  root.append(enter, welcome, hintEl, mini, map, helpBtn, helpPanel, volume, popup, animalCard);

  const muteBtn = volume.querySelector("[data-testid=ss-mute]");
  const stepsBtn = volume.querySelector("[data-testid=ss-steps]");
  const slider = volume.querySelector("input");
  slider.value = String(settings.volume);
  syncSteps();
  syncMute();

  function syncSteps() {
    stepsBtn.textContent = stepsOn ? "Steps on" : "Steps off";
    stepsBtn.setAttribute("aria-pressed", stepsOn ? "true" : "false");
  }

  function playFootstep() {
    if (!entered || !stepsOn || settings.muted || settings.volume === 0) return;
    if (!stepAudio) {
      stepAudio = new Audio(audioUrl("footstep.wav"));
      stepAudio.preload = "auto";
      stepAudio.dataset.testid = "ss-footstep";
      document.body.appendChild(stepAudio);
    }
    stepAudio.volume = Math.min(1, settings.volume * 0.45);
    stepAudio.dataset.played = String(Date.now());
    try {
      stepAudio.currentTime = 0;
    } catch {
      /* the clip may still be loading */
    }
    stepAudio.play().catch(() => {});
  }

  function syncMute() {
    muteBtn.textContent = settings.muted || settings.volume === 0 ? "Off" : "On";
    muteBtn.setAttribute("aria-pressed", settings.muted ? "true" : "false");
    if (ambient) {
      ambient.muted = settings.muted || settings.volume === 0;
      ambient.volume = settings.volume * 0.4;
    }
    if (voice) voice.volume = settings.volume;
  }

  function playFile(id, loop) {
    if (!entered || settings.muted || settings.volume === 0) return null;
    const audio = new Audio(audioUrl(`${id}.wav`));
    audio.preload = "auto";
    audio.dataset.testid = loop ? "ss-ambient" : "ss-voice";
    audio.loop = Boolean(loop);
    audio.volume = loop ? settings.volume * 0.4 : settings.volume;
    document.body.appendChild(audio);
    const fallback = () => {
      if (!loop) speak(lines.get(id) || currentLine.text);
    };
    audio.addEventListener("playing", () => {
      audioStarted = true;
    });
    audio.addEventListener("error", fallback);
    audio.play().then(() => {
      audioStarted = true;
    }).catch(fallback);
    return audio;
  }

  function speak(text) {
    if (!entered || settings.muted || settings.volume === 0 || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.volume = settings.volume;
    const voices = window.speechSynthesis.getVoices();
    const adult = voices.find((item) => /en/i.test(item.lang) && !/child|kid/i.test(item.name));
    if (adult) utter.voice = adult;
    window.speechSynthesis.speak(utter);
    audioStarted = true;
  }

  function playLine(id) {
    const text = lines.get(id) || WELCOME;
    currentLine = { id, text };
    if (id === "welcome") {
      welcome.hidden = false;
      welcome.querySelector("h1").textContent = text;
    }
    if (!entered) return;
    if (voice) {
      voice.pause();
      voice = null;
    }
    voice = playFile(id, false);
  }

  function startAmbient() {
    if (!entered || ambient) {
      if (ambient) syncMute();
      return;
    }
    ambient = playFile("ambient-lofi", true);
    syncMute();
  }

  function showHint(text) {
    hint = text;
    hintEl.hidden = !text;
    hintEl.textContent = text;
  }

  function routeTo(quest) {
    const here = pose();
    if (!here || !graph.nodes.length) return;
    const near = nearestNode(graph.nodes, here.x, here.z);
    const nodes = [...graph.nodes, { id: "player", x: here.x, z: here.z }];
    const edges = [...graph.edges, { a: "player", b: near.id }];
    const found = bfsPath(nodes, edges, "player", quest.nodeId);
    route = found || [near, { id: quest.nodeId, x: quest.x, z: quest.z }];
    engine?.setGuidePath?.(route.map((point) => [point.x, point.z]));
    if (route[1]) engine?.faceWalkTarget?.(route[1].x, route[1].z);
    showHint(quest.hint);
    currentLine = { id: quest.narrationId, text: lines.get(quest.narrationId) || quest.hint };
    paintMaps();
  }

  function nearestQuest() {
    const here = pose();
    if (!here) return quests.find((quest) => !done.has(quest.id)) || null;
    let best = null;
    let bestLength = Infinity;
    for (const quest of quests) {
      if (done.has(quest.id)) continue;
      const near = nearestNode(graph.nodes, here.x, here.z);
      const nodes = [...graph.nodes, { id: "player", x: here.x, z: here.z }];
      const edges = [...graph.edges, { a: "player", b: near.id }];
      const found = bfsPath(nodes, edges, "player", quest.nodeId);
      const length = found ? pathLength(found) : Math.hypot(quest.x - here.x, quest.z - here.z);
      if (length < bestLength) {
        best = quest;
        bestLength = length;
      }
    }
    return best;
  }

  function paintMaps() {
    mini.innerHTML = mapSvg(132, 132);
    const holder = map.querySelector("[data-map]");
    if (!map.hidden) holder.innerHTML = mapSvg(640, 420);
  }

  function logHelp(helpType) {
    fetch(`${parentOrigin}/api/guide/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventType: "help_used", helpType, userId, roomId, sessionId: session }),
    }).catch(() => {});
  }

  function openQuest(quest) {
    if (window.parent !== window) {
      window.parent.postMessage(
        { source: "ss-guide", action: "open-quest", quest: { id: quest.id, title: quest.title, prompt: prompts.get(quest.id) || quest.prompt, type: quest.type } },
        parentOrigin,
      );
    }
  }

  async function loadContent() {
    try {
      const [questFile, wayFile, narration, live] = await Promise.all([
        fetch(`${parentOrigin}/content/quests.json`).then((res) => res.json()),
        fetch(`${parentOrigin}/content/waypoints.json`).then((res) => res.json()),
        fetch(`${parentOrigin}/content/narration.json`).then((res) => res.json()),
        fetch(`${parentOrigin}/api/guide/quests`).then((res) => (res.ok ? res.json() : { quests: [] })).catch(() => ({ quests: [] })),
      ]);
      quests = questFile.quests || [];
      graph = wayFile;
      lines = new Map((narration.lines || []).map((line) => [line.id, line.text]));
      if (!lines.has("welcome")) lines.set("welcome", WELCOME);
      for (const item of live.quests || []) prompts.set(item.id, item.prompt);
      audioReady.add("welcome");
    } catch {
      quests = [];
    }
  }

  enterBtn.addEventListener("click", () => {
    entered = true;
    enter.remove();
    welcome.hidden = false;
    mini.hidden = false;
    muteBtn.hidden = false;
    slider.hidden = false;
    volume.hidden = false;
    playLine("welcome");
    startAmbient();
    engine?.enterFirstPerson?.();
    const next = nearestQuest();
    if (next) routeTo(next);
  });

  muteBtn.addEventListener("click", () => {
    settings.muted = !settings.muted;
    saveSettings();
    syncMute();
    if (!settings.muted) startAmbient();
    if (settings.muted) {
      ambient?.pause();
      voice?.pause();
      stepAudio?.pause();
      window.speechSynthesis?.cancel();
    }
  });
  stepsBtn.addEventListener("click", () => {
    stepsOn = !stepsOn;
    try {
      localStorage.setItem(STEPS_KEY, stepsOn ? "on" : "off");
    } catch {
      /* the button still toggles for this visit */
    }
    syncSteps();
    if (!stepsOn) stepAudio?.pause();
  });
  slider.addEventListener("input", () => {
    settings.volume = Number(slider.value);
    if (settings.volume > 0) settings.muted = false;
    saveSettings();
    syncMute();
    if (settings.volume === 0) {
      ambient?.pause();
      voice?.pause();
      stepAudio?.pause();
    } else if (entered) startAmbient();
  });

  mini.addEventListener("click", () => {
    map.hidden = false;
    paintMaps();
  });
  map.querySelector("[data-close-map]").addEventListener("click", () => {
    map.hidden = true;
  });
  helpBtn.addEventListener("click", () => {
    helpPanel.hidden = !helpPanel.hidden;
  });
  helpPanel.querySelector("[data-testid=ss-help-where]").addEventListener("click", () => {
    logHelp("where");
    const next = nearestQuest();
    if (!next) return;
    routeTo(next);
    map.hidden = false;
    paintMaps();
    playLine(next.narrationId);
  });
  helpPanel.querySelector("[data-testid=ss-help-ideas]").addEventListener("click", async () => {
    logHelp("ideas");
    const next = activeQuest || nearestQuest() || quests[0];
    const list = helpPanel.querySelector("[data-testid=ss-ideas]");
    let ideas = next?.ideas || [];
    try {
      const res = await fetch(`${parentOrigin}/api/help/ideas`, {
        method: "POST",
        headers: { "content-type": "application/json", ...(window.__ssGuideForceFallback ? { "x-ss-guide-simulate-failure": "1" } : {}) },
        body: JSON.stringify({ questId: next?.id || "", sessionId: session }),
      });
      const data = await res.json();
      if (Array.isArray(data.ideas) && data.ideas.length === 3) ideas = data.ideas;
    } catch {
      ideas = next?.ideas || ideas;
    }
    list.hidden = false;
    list.innerHTML = ideas.map((idea) => `<li>${escapeHtml(idea)}</li>`).join("");
  });
  helpPanel.querySelector("[data-testid=ss-help-read]").addEventListener("click", () => {
    logHelp("read");
    playLine(currentLine.id);
    if (currentLine.id === "welcome") {
      welcome.hidden = false;
      welcome.querySelector("h1").textContent = lines.get("welcome") || WELCOME;
    } else {
      showHint(currentLine.text);
    }
  });

  popup.querySelector("[data-testid=ss-quest-yes]").addEventListener("click", () => {
    if (!activeQuest) return;
    const quest = activeQuest;
    popup.hidden = true;
    openQuest(quest);
  });
  popup.querySelector("[data-testid=ss-quest-no]").addEventListener("click", () => {
    if (activeQuest) declined.add(activeQuest.id);
    activeQuest = null;
    popup.hidden = true;
  });

  const sayBtn = animalCard.querySelector("[data-say]");
  const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (Speech) sayBtn.hidden = false;
  sayBtn.addEventListener("click", () => {
    if (!Speech) return;
    const rec = new Speech();
    rec.lang = "en-US";
    rec.onresult = (event) => {
      const text = event.results?.[0]?.[0]?.transcript || "";
      animalCard.querySelector("textarea").value = text.slice(0, 80);
    };
    rec.start();
  });
  animalCard.querySelector("[data-close-animal]").addEventListener("click", () => {
    animalCard.hidden = true;
    animal = null;
  });
  animalCard.querySelector("[data-testid=ss-animal-describe]").addEventListener("click", async () => {
    if (!animal) return;
    const typed = animalCard.querySelector("textarea").value.trim();
    const replyEl = animalCard.querySelector("[data-testid=ss-animal-reply]");
    const drawBtn = animalCard.querySelector("[data-testid=ss-animal-draw]");
    let reply = canned(animal.kind);
    let suggestDraw = true;
    try {
      const res = await fetch(`${parentOrigin}/api/animal`, {
        method: "POST",
        headers: { "content-type": "application/json", ...(window.__ssGuideForceFallback ? { "x-ss-guide-simulate-failure": "1" } : {}) },
        body: JSON.stringify({
          kind: animal.kind,
          name: animal.name,
          text: typed || "describe it",
          sessionId: session,
          userId,
          roomId,
        }),
      });
      const data = await res.json();
      if (typeof data.reply === "string") reply = data.reply;
      suggestDraw = data.suggestDraw !== false;
    } catch {
      reply = canned(animal.kind);
    }
    replyEl.textContent = reply;
    drawBtn.hidden = !suggestDraw;
  });
  animalCard.querySelector("[data-testid=ss-animal-draw]").addEventListener("click", () => {
    if (!animal) return;
    openQuest({
      id: `animal-${animal.kind}`,
      title: `Draw the ${animal.kind}?`,
      prompt: `Draw or write about the ${animal.kind} you see.`,
      type: "both",
    });
  });

  window.addEventListener("message", (event) => {
    if (event.origin !== parentOrigin) return;
    const data = event.data;
    if (!data || data.source !== "ss-guide" || data.action !== "quest-saved") return;
    const quest = quests.find((item) => item.id === data.questId);
    if (!quest) return;
    rememberDone(quest.id);
    engine?.spawnGuideKeepsake?.(quest.id, quest.x, quest.z);
    popup.hidden = true;
    activeQuest = null;
    paintMaps();
  });

  engine?.setGuideAnimalListener?.((found) => {
    animal = found;
    animalCard.hidden = false;
    animalCard.querySelector("[data-animal-title]").textContent = `Say hello to ${found.name}.`;
    animalCard.querySelector("[data-testid=ss-animal-reply]").textContent = "";
    animalCard.querySelector("[data-testid=ss-animal-draw]").hidden = true;
  });

  function tick() {
    if (!entered) return;
    const here = pose();
    paintMaps();
    if (!here) return;
    if (here.anim === "walk" || here.anim === "run") {
      const now = performance.now();
      const gap = here.anim === "run" ? 320 : 480;
      if (now - lastStepAt > gap) {
        lastStepAt = now;
        playFootstep();
      }
    }
    for (const quest of quests) {
      const near = Math.hypot(here.x - quest.x, here.z - quest.z) <= quest.radius;
      if (near) {
        if (!inside.has(quest.id) && !done.has(quest.id) && !declined.has(quest.id) && popup.hidden) {
          activeQuest = quest;
          popup.hidden = false;
          popup.querySelector("[data-title]").textContent = quest.title;
          currentLine = { id: `quest-${quest.id}`, text: lines.get(`quest-${quest.id}`) || quest.title };
        }
        inside.add(quest.id);
      } else {
        inside.delete(quest.id);
      }
    }
  }

  window.__ssGuide = {
    get entered() { return entered; },
    get audioStarted() { return audioStarted; },
    get muted() { return settings.muted; },
    get stepsOn() { return stepsOn; },
    get audioCount() { return document.querySelectorAll("audio").length; },
    get audioPrepared() { return audioReady.size; },
    get questCount() { return quests.length; },
  };

  await loadContent();
  setInterval(tick, 250);
}

function el(tag, className) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
}

function canned(kind) {
  if (kind === "dog") return "The campus dog wags a slow hello. Want to draw those soft ears?";
  return "What a gentle friend to meet. Want to draw what you see?";
}
