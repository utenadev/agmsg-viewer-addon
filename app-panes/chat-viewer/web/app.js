// Chat viewer: the agmsg-viewer experience as an agmsg app add-on pane.
// Receives the selected team's messages from the app and draws them as a
// LINE-style chat timeline: the first speaker of the loaded window sits on
// the right in a yellow-green bubble (the agmsg-viewer convention), everyone
// else on the left with a per-agent pastel bubble and a colored initial
// avatar. Adds keyword / sender filters, day separators, folding for long
// agent reports, and auto-stamps for status words (the playful bit).
// No build step; this folder is what the app installs.
import { connect } from "./agmsg-addon.js";

const MAX_SHOWN = 500; // the app sends at most this many on start
const LONG_CHARS = 360; // fold messages longer than this…
const LONG_LINES = 8; // …or with more lines than this

let messages = [];
let memberNames = []; // names from the app, in roster order
let firstSpeaker = null; // sender of the oldest loaded message
const expanded = new Set(); // ids of long messages the user unfolded

const $ = (id) => document.getElementById(id);
const chat = $("chat");

// Message text is untrusted: build nodes and set textContent, never innerHTML.
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

// ---- colors, the agmsg-viewer way: a stable hash of the agent name ----

const AVATAR_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#84cc16", "#22c55e", "#10b981", "#14b8a6",
  "#06b6d4", "#0ea5e9", "#3b82f6", "#6366f1",
  "#8b5cf6", "#a855f7", "#d946ef", "#ec4899",
];
const BUBBLE_COLORS = ["#ffffff", "#eef5ff", "#f0f9eb", "#f5f0fa", "#fff0f2", "#fff7ec"];

function nameHash(name) {
  let sum = 0;
  for (const ch of name) sum += ch.codePointAt(0);
  return sum;
}
const avatarColor = (name) => AVATAR_COLORS[nameHash(name) % AVATAR_COLORS.length];
const bubbleColor = (name) => BUBBLE_COLORS[nameHash(name) % BUBBLE_COLORS.length];

// ---- time helpers (local time, like the standalone viewer) ----

const pad = (n) => String(n).padStart(2, "0");
function timeShort(iso) {
  const t = new Date(iso);
  return Number.isNaN(t.getTime()) ? "" : pad(t.getHours()) + ":" + pad(t.getMinutes());
}
function timeFull(iso) {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return iso;
  return t.getFullYear() + "-" + pad(t.getMonth() + 1) + "-" + pad(t.getDate()) +
    " " + pad(t.getHours()) + ":" + pad(t.getMinutes()) + ":" + pad(t.getSeconds());
}
function dayKey(iso) {
  const t = new Date(iso);
  return Number.isNaN(t.getTime()) ? "" : t.getFullYear() + "-" + (t.getMonth() + 1) + "-" + t.getDate();
}
function dayLabel(iso) {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "";
  const now = new Date();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (dayKey(iso) === dayKey(now.toISOString())) return "Today";
  if (dayKey(iso) === dayKey(yesterday.toISOString())) return "Yesterday";
  return t.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric", weekday: "short" });
}

// ---- auto-stamps: a small joke that doubles as a status scanner ----
// agmsg agents report with status words; stamp them like a chat app would.

function stampsFor(body) {
  const stamps = [];
  if (/\bCLEARED\b/.test(body)) stamps.push("✅ CLEARED");
  if (/\bBLOCKED\b/.test(body)) stamps.push("🧱 BLOCKED");
  if (body.includes("お疲れ") || body.includes("おつかれ")) stamps.push("🍵 おつかれさま");
  return stamps.slice(0, 3);
}

const isLong = (body) => body.length > LONG_CHARS || body.split("\n").length > LONG_LINES;

// ---- filters ----

function currentFilter() {
  return { q: $("search").value.trim().toLowerCase(), sender: $("sender").value };
}
function visibleMessages() {
  const { q, sender } = currentFilter();
  return messages.filter((m) => {
    if (sender && m.from !== sender) return false;
    if (q && !(m.body.toLowerCase().includes(q) || m.from.toLowerCase().includes(q) || m.to.toLowerCase().includes(q))) return false;
    return true;
  });
}

function refreshSenderOptions() {
  const select = $("sender");
  const keep = select.value;
  const names = new Set(memberNames);
  for (const m of messages) names.add(m.from);
  const options = [el("option", "", "All senders")];
  options[0].value = "";
  for (const name of [...names].sort()) {
    const o = el("option", "", name);
    o.value = name;
    options.push(o);
  }
  select.replaceChildren(...options);
  select.value = [...names].includes(keep) ? keep : "";
}

// ---- rendering ----

function messageRow(m) {
  const right = m.from === firstSpeaker;
  const row = el("div", "row " + (right ? "right" : "left"));

  const avatar = el("div", "avatar", [...m.from][0] ? [...m.from][0].toUpperCase() : "?");
  avatar.style.background = avatarColor(m.from);
  avatar.title = m.from;

  const col = el("div", "col");
  const nameLine = el("div", "name");
  nameLine.append(el("span", "from", m.from), el("span", "to", "→ " + m.to));
  col.append(nameLine);

  const bubbleLine = el("div", "bubble-line");
  const wrap = el("div", "bubble-wrap");
  const bubble = el("div", "bubble " + (right ? "bubble-right" : "bubble-left"), m.body);
  if (!right) bubble.style.background = bubbleColor(m.from);
  wrap.append(bubble);

  const stamps = stampsFor(m.body);
  if (stamps.length) {
    const strip = el("div", "stamps");
    for (const s of stamps) strip.append(el("span", "stamp", s));
    wrap.append(strip);
  }

  if (isLong(m.body) && !expanded.has(m.id)) {
    bubble.classList.add("folded");
    const btn = el("button", "fold-btn", "Show all (" + m.body.length + " chars)");
    btn.type = "button";
    btn.addEventListener("click", () => {
      expanded.add(m.id);
      bubble.classList.remove("folded");
      btn.remove();
    });
    wrap.append(btn);
  }

  const time = el("span", "time", timeShort(m.created_at));
  time.title = timeFull(m.created_at);

  if (right) bubbleLine.append(time, wrap);
  else bubbleLine.append(wrap, time);
  col.append(bubbleLine);

  if (right) row.append(col, avatar);
  else row.append(avatar, col);
  return row;
}

function render() {
  const scroller = document.scrollingElement;
  const wasAtBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 80;
  const oldTop = scroller.scrollTop;

  const list = visibleMessages();
  const nodes = [];
  if (!list.length) {
    nodes.push(el("p", "empty",
      messages.length
        ? "No messages match the filter."
        : "No messages yet. So quiet you can hear the agents thinking. 🐾"));
  }
  let lastDay = "";
  for (const m of list) {
    const day = dayKey(m.created_at);
    if (day && day !== lastDay) {
      lastDay = day;
      const sep = el("div", "day-sep");
      sep.append(el("span", "", dayLabel(m.created_at)));
      nodes.push(sep);
    }
    nodes.push(messageRow(m));
  }
  chat.replaceChildren(...nodes);

  $("status").textContent = messages.length + " messages" +
    (list.length !== messages.length ? " · showing " + list.length : "");

  if (wasAtBottom) scroller.scrollTop = scroller.scrollHeight;
  else scroller.scrollTop = oldTop;
}

// ---- toolbar ----

$("search").addEventListener("input", render);
$("sender").addEventListener("change", render);
$("to-top").addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
$("to-bottom").addEventListener("click", () => window.scrollTo({ top: document.scrollingElement.scrollHeight, behavior: "smooth" }));

// ---- ordering ----
// The protocol allows ordering by array position or by created_at. A chat
// timeline wants chronological order: the app merges two id spaces (the
// event log and the legacy message table), so delivery order can differ
// from time order, and a message can also arrive both in init and live.
// Sort stably by created_at (arrival order breaks ties) and dedupe by id.

function sortByTime() {
  messages = messages
    .map((m, i) => [m, i])
    .sort((a, b) => ((Date.parse(a[0].created_at) || 0) - (Date.parse(b[0].created_at) || 0)) || (a[1] - b[1]))
    .map((pair) => pair[0]);
}

// ---- app connection ----

connect({
  onInit({ team, members: list, messages: initial }) {
    $("team").textContent = team;
    memberNames = list.map((x) => x.name);
    messages = initial.slice(-MAX_SHOWN);
    sortByTime();
    firstSpeaker = messages.length ? messages[0].from : null;
    refreshSenderOptions();
    render();
    window.scrollTo({ top: document.scrollingElement.scrollHeight });
  },
  onMessage(m) {
    if (messages.some((x) => x.id === m.id)) return; // already shown (init + live overlap)
    messages.push(m);
    sortByTime();
    if (messages.length > MAX_SHOWN) messages.splice(0, messages.length - MAX_SHOWN);
    if (firstSpeaker === null) firstSpeaker = messages[0].from;
    refreshSenderOptions();
    render();
  },
});
