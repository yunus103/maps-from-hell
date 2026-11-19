import type { L10n, Lang, LineId, Mood, SayOptions, SayPriority, SayTextOptions, ShiftModifiers, Subtitle, Voice } from './types';
import { BASE_MODIFIERS } from './types';
import { getLang, tx } from './lang';
import { LINES } from './lines';

const RATE = 1.05;
const PITCH = 1.1;
const HES_RATE = 0.8;
const HES_PITCH = 1.0;
const SUB_MIN = 2.5;
const SUB_MAX = 7;
const SUB_TAIL = 1.2;
const BETA_CHANCE = 0.3;
const READ_CHARS_PER_S = 14; // how long a line "plays" when it is only a subtitle
const PENDING_MAX_MS = 10000; // a nav line older than this is not replayed on the first gesture
const QUEUE_MAX = 4;
const STALE_REACT = 4; // s a minor react line may wait in the queue before it is out of date and dropped
// A nav line waits for the reaction that is playing: a short one (shorter than SHORT_LINE) to its end, up to
// SHORT_MAX_WAIT, a longer one for NAV_MAX_WAIT before it is cut off.
const NAV_MAX_WAIT = 2;
const SHORT_LINE = 2.5;
const SHORT_MAX_WAIT = 4;
const REPLAY_BEFORE = 0.5; // a cut critical line is replayed if less than this share of it had played

// Lines the player must hear in full: queued behind anything, never dropped, cut only by a nav line that
// waited NAV_MAX_WAIT (and then replayed if it had barely started).
const CRITICAL = new Set<LineId>([
  'shift_start', 'shift_board', 'shift_update', 'shift_evening', 'shift_end',
  're_tip', 're_five_star', 're_two_star', 're_one_star', 're_cake_ruined', 're_picked_up', 're_cancel', 're_suspended', 're_towed',
  're_crash_mine', 're_dead_end', 're_combo',
  'ftue_1', 'ftue_3', 'ftue_hint_tells', 'ftue_pickup', 'ftue_hired',
  'upd_reverse', 'upd_sponsored', 'upd_silent', 'upd_honesty', 'upd_rhyme', 'upd_beta', 'upd_ai', 'upd_speedrun', 'upd_offline',
  'upd_drift', 'upd_passenger', 'upd_traffic',
]);

interface Request {
  id: LineId | null; // null = free text (sayText)
  free: { text: L10n; o: SayTextOptions } | null;
  opts: SayOptions;
  critical: boolean; // CRITICAL line or sayText({ critical: true })
  ttl: number; // s it may wait queued through nav cuts; 0 = default rules
  lang: Lang;
  wait: number; // s spent queued
  seq: number; // order of say() calls
}

interface Playing {
  sub: Subtitle;
  priority: SayPriority;
  age: number;
  done: boolean; // speech (or the reading estimate) finished; subtitle lingers SUB_TAIL more
  doneAge: number;
  estimate: number; // forced finish age (safety net: Chrome sometimes never fires onend)
  readTime: number; // rough spoken length, to judge how much of a cut line was heard
  req: Request;
  token: number;
}

export function createVoice(): Voice {
  const synth = typeof speechSynthesis !== 'undefined' ? speechSynthesis : null;
  const picked: Record<Lang, SpeechSynthesisVoice | null> = { en: null, tr: null };
  const ranked: Record<Lang, SpeechSynthesisVoice[]> = { en: [], tr: [] }; // picked first, then the other voices
  const warned = new Set<Lang>();

  let mods: ShiftModifiers = BASE_MODIFIERS;
  let paused = false;
  let unlocked = false;
  let cur: Playing | null = null;
  let queue: Request[] = []; // react lines waiting for the current line to finish
  let navWaiting: Request | null = null; // nav line waiting for a critical line
  let resumeNav: Request | null = null; // nav said while paused
  let pendingNav: (Request & { token: number; at: number }) | null = null;
  let token = 0;
  let seq = 0;

  function pick(lang: Lang): SpeechSynthesisVoice | null {
    const list = (synth?.getVoices() ?? []).filter((v) => v.lang.toLowerCase().startsWith(lang));
    return list.find((v) => /google/i.test(v.name)) ?? list.find((v) => /natural/i.test(v.name)) ?? list[0] ?? null;
  }

  function loadVoices() {
    picked.en = pick('en');
    picked.tr = pick('tr');
    for (const l of ['en', 'tr'] as const) {
      const p = picked[l];
      const rest = (synth?.getVoices() ?? []).filter((v) => v !== p && v.lang.toLowerCase().startsWith(l));
      ranked[l] = p ? [p, ...rest] : rest;
    }
  }

  if (synth) {
    loadVoices();
    synth.addEventListener('voiceschanged', loadVoices);
  }

  // Chrome rejects speak() before a user gesture: the line is shown as a subtitle and spoken on the first key/click.
  function unlock() {
    if (unlocked) return;
    unlocked = true;
    window.removeEventListener('keydown', unlock, true);
    window.removeEventListener('pointerdown', unlock, true);
    const p = pendingNav;
    pendingNav = null;
    if (p && cur?.token === p.token && performance.now() - p.at < PENDING_MAX_MS && !paused) play(p);
  }
  window.addEventListener('keydown', unlock, true);
  window.addEventListener('pointerdown', unlock, true);

  // rank > 0: another system voice of the language for a character, where the OS has several.
  function voiceFor(lang: Lang, rank = 0): SpeechSynthesisVoice | null {
    if (!synth) return null;
    if (!picked[lang]) loadVoices();
    const v = ranked[lang][rank] ?? picked[lang];
    if (!v && !warned.has(lang)) {
      warned.add(lang);
      console.info(`[voice] no "${lang}" speech voice available, subtitles only`);
    }
    return v;
  }

  // *Emphasis* markers are stripped everywhere (the HUD shows plain text). A name ending in "." before the
  // template's own "." would read "Apt..".
  function fill(text: string, params?: Record<string, string | number>): string {
    if (params) for (const [k, v] of Object.entries(params)) text = text.replaceAll(`{${k}}`, String(v));
    return text.replaceAll('*', '').replace(/(?<!\.)\.\.(?!\.)/g, '.');
  }

  function busy(): boolean {
    return cur !== null && !cur.done;
  }

  const critical = (p: Playing | null) => p !== null && !p.done && p.req.critical;
  const holdsNav = (p: Playing | null) => p !== null && !p.done && p.priority === 'react';
  const navLimit = (p: Playing) => (p.readTime < SHORT_LINE ? SHORT_MAX_WAIT : NAV_MAX_WAIT);

  function finish(p: Playing) {
    p.done = true;
    p.doneAge = p.age;
    next();
  }

  function next() {
    if (paused) return;
    // Critical lines said before the waiting nav line go first ("Order picked up" before the next turn).
    const head = queue[0];
    if (navWaiting && !(head && head.critical && head.seq < navWaiting.seq)) {
      const n = navWaiting;
      navWaiting = null;
      return play(n);
    }
    let q = queue.shift();
    while (q && !q.critical && q.wait > (q.ttl || STALE_REACT)) q = queue.shift();
    if (q) play(q);
  }

  function enqueue(req: Request) {
    if (queue.length >= QUEUE_MAX) {
      const minor = queue.findIndex((q) => !q.critical);
      if (minor >= 0) queue.splice(minor, 1);
      else if (!req.critical) return;
      else queue.shift();
    }
    queue.push(req);
  }

  // Nav cuts the current line; a critical one that had barely started goes back to the front of the queue.
  function preemptWithNav(req: Request) {
    const c = cur;
    if (c && critical(c) && c.age < c.readTime * REPLAY_BEFORE) queue.unshift({ ...c.req, wait: 0 });
    play(req);
  }

  function play(req: Request) {
    const { lang } = req;
    const free = req.free?.o;
    const speaker = free?.speaker;
    const yoldas = !speaker || speaker.kind === 'yoldas';
    let text: string;
    let mood: Mood;
    let emoji: string;
    if (req.id) {
      const line = LINES[req.id];
      text = fill(line.text[lang], req.opts.params);
      mood = line.mood;
      emoji = line.emoji;
    } else {
      text = fill(req.free!.text[lang], free?.params);
      mood = yoldas ? (free?.mood ?? 'neutral') : 'neutral';
      emoji = free?.emoji ?? '…';
    }
    const muted = mods.silent && yoldas; // Silent Mode mutes only YOLDAŞ
    const priority = req.opts.priority ?? 'react';
    token++;
    synth?.cancel();
    if (navWaiting) navWaiting.wait = 0; // its wait limit applies to the line now playing
    // Minor lines from before a command ("Recalculating…") are out of date once it is spoken.
    if (priority === 'nav') queue = queue.filter((q) => q.critical || q.seq > req.seq || q.wait < q.ttl);

    const voice = !muted && unlocked ? voiceFor(lang, speaker?.voiceRank) : null;
    const readTime = Math.max(1, text.length / READ_CHARS_PER_S);
    const rate = free ? (speaker?.rate ?? RATE) : req.opts.hesitant ? HES_RATE : RATE;
    const pitch = free ? (speaker?.pitch ?? PITCH) : req.opts.hesitant ? HES_PITCH : PITCH;
    // Free text may come from a slow speaker (the grandpa): its safety-net finish scales with the rate.
    const spoken = free ? Math.max(SUB_MAX - SUB_TAIL, (readTime * RATE) / rate + 1) : SUB_MAX - SUB_TAIL;
    const p: Playing = {
      sub: {
        text: muted ? emoji : text,
        mood,
        speaker: yoldas ? undefined : { kind: speaker.kind, label: tx(speaker.label) },
      },
      priority,
      age: 0,
      done: false,
      doneAge: 0,
      estimate: voice ? spoken : Math.min(SUB_MAX - SUB_TAIL, readTime),
      readTime,
      req,
      token,
    };
    cur = p;
    free?.onPlay?.();

    if (!voice || !synth) {
      if (!unlocked && !muted && priority === 'nav') pendingNav = { ...req, token, at: performance.now() };
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = rate;
    u.pitch = pitch;
    const end = () => {
      if (cur === p && !p.done) finish(p);
    };
    u.onend = end;
    u.onerror = end;
    synth.speak(u);
  }

  const betaFlip = (lang: Lang): Lang => (mods.betaVoice && Math.random() < BETA_CHANCE ? (lang === 'en' ? 'tr' : 'en') : lang);

  function say(id: LineId, opts: SayOptions = {}) {
    submit({ id, free: null, opts, critical: CRITICAL.has(id), ttl: opts.ttl ?? 0, lang: betaFlip(getLang()), wait: 0, seq: seq++ });
  }

  // Same queue and rules as say(). The Beta Voice language flip only applies to YOLDAŞ.
  function sayText(text: L10n, o: SayTextOptions = {}) {
    const s = o.speaker;
    const lang = s && s.kind !== 'yoldas' ? (s.lang ?? getLang()) : betaFlip(s?.lang ?? getLang());
    const opts: SayOptions = { priority: o.priority, params: o.params };
    submit({ id: null, free: { text, o }, opts, critical: !!o.critical, ttl: o.ttl ?? 0, lang, wait: 0, seq: seq++ });
  }

  function submit(req: Request) {
    const priority = req.opts.priority ?? 'react';
    if (paused) {
      if (priority === 'nav') resumeNav = req;
      else if (req.critical) enqueue(req);
      return;
    }
    if (priority === 'nav') {
      // A newer command replaces a waiting one; nav never waits behind chatter.
      if (holdsNav(cur)) navWaiting = req;
      else play(req);
      return;
    }
    if (priority === 'chatter') {
      if (!busy() && !queue.length && !navWaiting) play(req);
      return;
    }
    if (busy() && cur?.priority !== 'chatter') return enqueue(req);
    if (busy() || !queue.length) return play(req); // idle, or only chatter playing
    enqueue(req);
    next();
  }

  return {
    say,
    sayText,
    current: () => cur?.sub ?? null,
    setModifiers(m) {
      mods = m;
    },
    setPaused(p) {
      if (p === paused) return;
      paused = p;
      if (p) synth?.pause();
      else {
        synth?.resume();
        if (resumeNav) {
          const r = resumeNav;
          resumeNav = null;
          if (r.id) say(r.id, r.opts);
          else if (r.free) sayText(r.free.text, r.free.o);
        } else if (!busy()) next();
      }
    },
    drop(id) {
      queue = queue.filter((q) => q.id !== id);
    },
    flush() {
      token++;
      synth?.cancel();
      cur = null;
      queue = queue.filter((q) => q.critical);
      navWaiting = null;
    },
    stop() {
      token++;
      synth?.cancel();
      cur = null;
      queue = [];
      navWaiting = null;
      resumeNav = null;
      pendingNav = null;
    },
    update(dt) {
      if (paused) return;
      for (const q of queue) q.wait += dt;
      if (navWaiting) {
        navWaiting.wait += dt;
        if (!cur || !holdsNav(cur) || navWaiting.wait >= navLimit(cur)) {
          const n = navWaiting;
          navWaiting = null;
          preemptWithNav(n);
        }
      }
      if (!cur) return;
      const p = cur;
      p.age += dt;
      if (!p.done && p.age >= p.estimate) finish(p);
      if (cur === p && p.done && p.age >= Math.max(SUB_MIN, p.doneAge + SUB_TAIL)) cur = null;
    },
  };
}
