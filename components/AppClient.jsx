"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

// ── FONTS ─────────────────────────────────────────────────────────────────────
function FontLoader() {
  useEffect(() => {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Cormorant:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Nunito:wght@300;400;500;600;700&display=swap";
    document.head.appendChild(l);
  }, []);
  return null;
}

// ── UTILITIES ─────────────────────────────────────────────────────────────────
function fmtDate(d) {
  // Build YYYY-MM-DD from local date components to avoid UTC timezone shift
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function todayStr() { return fmtDate(new Date()); }

function getDaysBetween(startStr, targetDate) {
  const start = new Date(startStr); start.setHours(0,0,0,0);
  const target = new Date(targetDate); target.setHours(0,0,0,0);
  return Math.floor((target.getTime() - start.getTime()) / 86400000);
}

// ── CYCLE MATHS (exact spec implementation) ───────────────────────────────────
// cycleDay: wraps correctly for both past AND future dates
function getCycleDay(startStr, cycleLength, targetDate = new Date()) {
  const diff = getDaysBetween(startStr, targetDate);
  // Use modulo that handles negative diffs correctly (past starts)
  return ((diff % cycleLength) + cycleLength) % cycleLength + 1;
}

// getPhaseKey requires periodLength to place phases correctly
// Default periodLength=5 for backwards compat with TodayTab calls that omit it
function getPhaseKey(cycleDay, cycleLength = 28, periodLength = 5) {
  const ovulationDay = Math.max(10, Math.min(cycleLength - 10, cycleLength - 14));
  if (cycleDay >= 1            && cycleDay <= periodLength)       return "menstrual";
  if (cycleDay >= periodLength + 1 && cycleDay <= ovulationDay - 1) return "follicular";
  if (cycleDay >= ovulationDay && cycleDay <= ovulationDay + 2)   return "ovulatory";
  if (cycleDay >= ovulationDay + 3 && cycleDay <= cycleLength)    return "luteal";
  return "luteal"; // safe fallback
}

// phaseForDate — the single source of truth called per day cell
// Returns null if any required input is missing (shows white circle)
function phaseForDate(dateStr, cycleStartDate, cycleLength, periodLength) {
  if (!cycleStartDate || !cycleLength || !periodLength) return null;
  const d = new Date(dateStr + "T12:00:00");
  const cycleDay = getCycleDay(cycleStartDate, cycleLength, d);
  return getPhaseKey(cycleDay, cycleLength, periodLength);
}

function isLateLuteal(day, cycleLength, periodLength = 5) {
  return getPhaseKey(day, cycleLength, periodLength) === "luteal" && (cycleLength - day) <= 6;
}

function getLunarPhase(date) {
  const known = new Date("2000-01-06");
  const diff = (new Date(date) - known) / 86400000;
  const cycle = ((diff % 29.53) + 29.53) % 29.53;
  if (cycle < 1.85)  return { phase: "New Moon",        emoji: "🌙", tip: "A quieter moment in the cycle. Good for planning inward." };
  if (cycle < 7.38)  return { phase: "Waxing Crescent", emoji: "🌒", tip: "Small steps forward. Good for initial momentum." };
  if (cycle < 9.22)  return { phase: "First Quarter",   emoji: "🌓", tip: "Energy building. Decisions come a bit easier." };
  if (cycle < 14.77) return { phase: "Waxing Gibbous",  emoji: "🌔", tip: "Review plans, adjust details or finish what's already underway rather than start new big things." };
  if (cycle < 16.61) return { phase: "Full Moon",       emoji: "●", tip: "Peak illumination. A good time to complete and share." };
  if (cycle < 22.15) return { phase: "Waning Gibbous",  emoji: "🌖", tip: "Good for wrapping up, reflecting and letting go of what didn't work." };
  if (cycle < 23.99) return { phase: "Last Quarter",    emoji: "🌗", tip: "Clearing space. Focus on what actually needs your energy." };
  return                    { phase: "Waning Crescent", emoji: "🌘", tip: "Rest and reset. Renewal is close." };
}

// ── STORAGE ───────────────────────────────────────────────────────────────────
function lsGet(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
function lsDel(k) { try { localStorage.removeItem(k); } catch {} }

// Next.js-safe store: window.storage doesn't exist here, so we use localStorage directly.
const MEM = {};
const store = {
  get: async (k) => { try { return MEM[k] ?? lsGet(k); } catch { return null; } },
  set: async (k, v) => { try { MEM[k] = v; lsSet(k, v); } catch {} },
  del: async (k) => { try { delete MEM[k]; lsDel(k); } catch {} },
  list: async (p) => {
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith(p));
      return keys.length ? keys : Object.keys(MEM).filter(k => k.startsWith(p));
    } catch { return Object.keys(MEM).filter(k => k.startsWith(p)); }
  },
};

function saveCheckinLocal(date, data) {
  const all = lsGet("essensheal_checkins") || {};
  all[date] = { ...all[date], ...data };
  lsSet("essensheal_checkins", all);
}
function loadCheckinLocal(date) {
  const all = lsGet("essensheal_checkins") || {};
  return all[date] || {};
}

// ── PHASE HOME DATA (energy / focus / social / physical / daily advice) ───────
const PHASE_HOME = {
  menstrual: {
    energy:   "Low, restorative",
    focus:    "Single tasks, reflection",
    social:   "Low capacity, selective",
    physical: "Gentle, minimal",
    advice: [
      "Protect your energy today — one thing at a time.",
      "Warmth, rest, and simple food go a long way.",
    ],
    nextPhase: "Follicular",
  },
  follicular: {
    energy:   "Rising, building",
    focus:    "Creative work, new starts",
    social:   "Engaged, open",
    physical: "Increasing capacity",
    advice: [
      "Good time to start something you've been putting off.",
      "Lean into clarity — your mind is at its sharpest.",
    ],
    nextPhase: "Ovulatory",
  },
  ovulatory: {
    energy:   "High, outward",
    focus:    "Collaboration, expression",
    social:   "Very engaged, magnetic",
    physical: "Strong, peak output",
    advice: [
      "Say yes to connection — this is your social window.",
      "Tackle the conversation or task you've been avoiding.",
    ],
    nextPhase: "Luteal",
  },
  luteal: {
    energy:   "Declining, inward",
    focus:    "Detail work, completion",
    social:   "Selective socialising",
    physical: "Moderate, grounding",
    advice: [
      "Prioritise essentials. Keep plans simple. Finish what matters.",
      "Leave buffer between commitments — your body needs space.",
    ],
    nextPhase: "Menstrual",
  },
};

// ── HOME TAB ──────────────────────────────────────────────────────────────────
// ── SEASONAL PHASE ICONS (SVG inline — explicit paths, browser-safe) ──────────
function PhaseIcon({ phaseKey, size = 52 }) {

  if (phaseKey === "menstrual") {
    // ❄️ Winter — clean 6-arm snowflake with explicit coordinates
    return (
      <svg width={size} height={size} viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* 6 main arms — explicit start/end, all from centre 26,26 */}
        <line x1="26" y1="8"  x2="26" y2="44" stroke="#A8C4D8" strokeWidth="2.2" strokeLinecap="round"/>
        <line x1="11" y1="17" x2="41" y2="35" stroke="#A8C4D8" strokeWidth="2.2" strokeLinecap="round"/>
        <line x1="41" y1="17" x2="11" y2="35" stroke="#A8C4D8" strokeWidth="2.2" strokeLinecap="round"/>
        {/* branch pairs on vertical arm */}
        <line x1="26" y1="15" x2="20" y2="19" stroke="#A8C4D8" strokeWidth="1.4" strokeLinecap="round"/>
        <line x1="26" y1="15" x2="32" y2="19" stroke="#A8C4D8" strokeWidth="1.4" strokeLinecap="round"/>
        <line x1="26" y1="37" x2="20" y2="33" stroke="#A8C4D8" strokeWidth="1.4" strokeLinecap="round"/>
        <line x1="26" y1="37" x2="32" y2="33" stroke="#A8C4D8" strokeWidth="1.4" strokeLinecap="round"/>
        {/* branch pairs on upper-left arm */}
        <line x1="16" y1="20" x2="14" y2="26" stroke="#A8C4D8" strokeWidth="1.4" strokeLinecap="round"/>
        <line x1="16" y1="20" x2="20" y2="14" stroke="#A8C4D8" strokeWidth="1.4" strokeLinecap="round"/>
        {/* branch pairs on upper-right arm */}
        <line x1="36" y1="20" x2="38" y2="26" stroke="#A8C4D8" strokeWidth="1.4" strokeLinecap="round"/>
        <line x1="36" y1="20" x2="32" y2="14" stroke="#A8C4D8" strokeWidth="1.4" strokeLinecap="round"/>
        {/* branch pairs on lower-right arm */}
        <line x1="36" y1="32" x2="38" y2="26" stroke="#A8C4D8" strokeWidth="1.4" strokeLinecap="round"/>
        <line x1="36" y1="32" x2="32" y2="38" stroke="#A8C4D8" strokeWidth="1.4" strokeLinecap="round"/>
        {/* branch pairs on lower-left arm */}
        <line x1="16" y1="32" x2="14" y2="26" stroke="#A8C4D8" strokeWidth="1.4" strokeLinecap="round"/>
        <line x1="16" y1="32" x2="20" y2="38" stroke="#A8C4D8" strokeWidth="1.4" strokeLinecap="round"/>
        {/* centre */}
        <circle cx="26" cy="26" r="3.5" fill="#C8DDE8"/>
        {/* arm tips */}
        <circle cx="26" cy="8"  r="2" fill="#8AAFC0"/>
        <circle cx="26" cy="44" r="2" fill="#8AAFC0"/>
        <circle cx="11" cy="17" r="2" fill="#8AAFC0"/>
        <circle cx="41" cy="35" r="2" fill="#8AAFC0"/>
        <circle cx="41" cy="17" r="2" fill="#8AAFC0"/>
        <circle cx="11" cy="35" r="2" fill="#8AAFC0"/>
      </svg>
    );
  }

  if (phaseKey === "follicular") {
    // 🌱 Spring — stem with two leaves and a bud
    return (
      <svg width={size} height={size} viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* main stem */}
        <path d="M26 44 C26 44 26 28 26 20" stroke="#4A9060" strokeWidth="2" strokeLinecap="round"/>
        {/* left leaf — teardrop path */}
        <path d="M26 34 C22 30 14 28 16 20 C20 22 26 28 26 34Z" fill="#6DC080" opacity="0.95"/>
        {/* left leaf midrib */}
        <path d="M26 34 C22 29 17 24 16 20" stroke="#4A9060" strokeWidth="0.9" strokeLinecap="round" fill="none"/>
        {/* right leaf — teardrop path */}
        <path d="M26 28 C30 24 38 22 36 14 C32 16 26 22 26 28Z" fill="#52A868" opacity="0.9"/>
        {/* right leaf midrib */}
        <path d="M26 28 C30 23 34 18 36 14" stroke="#3A8050" strokeWidth="0.9" strokeLinecap="round" fill="none"/>
        {/* top bud — rounded tip */}
        <ellipse cx="26" cy="17" rx="4.5" ry="7" fill="#8DCC90"/>
        {/* bud tip highlight */}
        <ellipse cx="26" cy="13" rx="2" ry="2.5" fill="#A8E0A0" opacity="0.7"/>
        {/* bud midrib */}
        <line x1="26" y1="11" x2="26" y2="23" stroke="#4A9060" strokeWidth="0.9" strokeLinecap="round"/>
        {/* small side bud left */}
        <ellipse cx="19" cy="20" rx="2.5" ry="4" fill="#8DCC90" opacity="0.75" transform="rotate(-30 19 20)"/>
        {/* small side bud right */}
        <ellipse cx="33" cy="17" rx="2" ry="3.5" fill="#8DCC90" opacity="0.65" transform="rotate(30 33 17)"/>
      </svg>
    );
  }

  if (phaseKey === "ovulatory") {
    // 🌼 Summer — chamomile with petals radiating from centre (rotation around flower centre 26,26)
    return (
      <svg width={size} height={size} viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* 8 petals — each is an ellipse centred on the flower centre, stretched upward, then rotated */}
        {/* Petal = tall ellipse at top of centre, rotated around 26,26 */}
        <g transform="rotate(0 26 26)">  <ellipse cx="26" cy="13" rx="4" ry="7" fill="#F0ECD8" opacity="0.95"/></g>
        <g transform="rotate(45 26 26)"> <ellipse cx="26" cy="13" rx="4" ry="7" fill="#E8E4CE" opacity="0.95"/></g>
        <g transform="rotate(90 26 26)"> <ellipse cx="26" cy="13" rx="4" ry="7" fill="#F0ECD8" opacity="0.95"/></g>
        <g transform="rotate(135 26 26)"><ellipse cx="26" cy="13" rx="4" ry="7" fill="#E8E4CE" opacity="0.95"/></g>
        <g transform="rotate(180 26 26)"><ellipse cx="26" cy="13" rx="4" ry="7" fill="#F0ECD8" opacity="0.95"/></g>
        <g transform="rotate(225 26 26)"><ellipse cx="26" cy="13" rx="4" ry="7" fill="#E8E4CE" opacity="0.95"/></g>
        <g transform="rotate(270 26 26)"><ellipse cx="26" cy="13" rx="4" ry="7" fill="#F0ECD8" opacity="0.95"/></g>
        <g transform="rotate(315 26 26)"><ellipse cx="26" cy="13" rx="4" ry="7" fill="#E8E4CE" opacity="0.95"/></g>
        {/* yellow centre disc */}
        <circle cx="26" cy="26" r="9" fill="#F2C035"/>
        <circle cx="26" cy="26" r="6.5" fill="#E8A818"/>
        {/* centre texture */}
        <circle cx="26" cy="22" r="1.2" fill="#D09010" opacity="0.6"/>
        <circle cx="23" cy="25" r="1.2" fill="#D09010" opacity="0.6"/>
        <circle cx="29" cy="25" r="1.2" fill="#D09010" opacity="0.6"/>
        <circle cx="24" cy="29" r="1.2" fill="#D09010" opacity="0.6"/>
        <circle cx="28" cy="29" r="1.2" fill="#D09010" opacity="0.6"/>
      </svg>
    );
  }

  if (phaseKey === "luteal") {
    // 🍂 Autumn — two overlapping maple-style leaves with veins
    return (
      <svg width={size} height={size} viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* leaf 1 — back leaf, amber, tilted right */}
        <g transform="rotate(18 26 26)">
          <path d="M24 40 C22 34 14 28 18 18 C20 14 26 12 28 16 C30 20 28 36 24 40Z" fill="#E09040" opacity="0.88"/>
          {/* midrib */}
          <path d="M24 40 C24 32 22 22 24 16" stroke="#B06820" strokeWidth="1" strokeLinecap="round" fill="none"/>
          {/* veins */}
          <path d="M24 30 C20 27 17 26 16 24" stroke="#B06820" strokeWidth="0.7" strokeLinecap="round" fill="none" opacity="0.7"/>
          <path d="M24 24 C21 21 19 19 18 18" stroke="#B06820" strokeWidth="0.7" strokeLinecap="round" fill="none" opacity="0.7"/>
        </g>
        {/* leaf 2 — front leaf, rust, tilted left */}
        <g transform="rotate(-22 26 26)">
          <path d="M28 40 C30 34 38 28 34 18 C32 14 26 12 24 16 C22 20 24 36 28 40Z" fill="#C97030" opacity="0.93"/>
          {/* midrib */}
          <path d="M28 40 C28 32 30 22 28 16" stroke="#9A4E18" strokeWidth="1.1" strokeLinecap="round" fill="none"/>
          {/* veins */}
          <path d="M28 30 C32 27 35 26 36 24" stroke="#9A4E18" strokeWidth="0.7" strokeLinecap="round" fill="none" opacity="0.7"/>
          <path d="M28 24 C31 21 33 19 34 18" stroke="#9A4E18" strokeWidth="0.7" strokeLinecap="round" fill="none" opacity="0.7"/>
        </g>
        {/* small fallen leaf at bottom */}
        <ellipse cx="22" cy="40" rx="4" ry="2.5" fill="#D4823A" opacity="0.55" transform="rotate(-15 22 40)"/>
      </svg>
    );
  }

  return <span style={{ fontSize: size * 0.45 }}>✿</span>;
}

function HomeTab({ profile, onNavigate }) {
  const pl       = profile.periodLength || 5;
  const cycleDay = getCycleDay(profile.cycleStartDate, profile.cycleLength);
  const phaseKey = getPhaseKey(cycleDay, profile.cycleLength, pl);
  const phase    = PHASES[phaseKey];
  const home     = PHASE_HOME[phaseKey];
  const daysLeft = profile.cycleLength - cycleDay;

  // Progress arc (SVG)
  const progress      = cycleDay / profile.cycleLength;
  const r = 58, cx = 70, cy = 70;
  const circumference = 2 * Math.PI * r;
  const dash          = circumference * progress;

  // Time-based greeting — use name from profile
  const hour    = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const name     = profile.name ? `, ${profile.name}` : "";

  // Navigate + scroll to top
  function navigateTo(tab) {
    if (onNavigate) onNavigate(tab);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 0 110px", background: "#FDFAF7" }}>

      {/* ── HEADER ── */}
      <div style={{ padding: "24px 20px 6px", textAlign: "center" }}>
        <T size={13} color="#9A8F86" style={{ display: "block", marginBottom: 5 }}>
          {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
        </T>
        <div style={{ fontFamily: "'Cormorant', serif", fontSize: 27, fontWeight: 600, color: "#2D2926", lineHeight: 1.25 }}>
          {greeting}{name}
        </div>
      </div>

      {/* ── CYCLE RING with seasonal icon ── */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "22px 0 12px" }}>
        <div style={{ position: "relative", width: 140, height: 140 }}>
          {/* SVG arc */}
          <svg width={140} height={140} style={{ position: "absolute", top: 0, left: 0, transform: "rotate(-90deg)" }}>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#EDE8E2" strokeWidth={7} />
            <circle
              cx={cx} cy={cy} r={r} fill="none"
              stroke={phase.color} strokeWidth={7}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circumference}`}
            />
          </svg>
          {/* Centre: seasonal icon + day number */}
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 4,
          }}>
            <PhaseIcon phaseKey={phaseKey} size={46} />
            <div style={{ fontFamily: "'Nunito', sans-serif", fontSize: 13, fontWeight: 700, color: "#2D2926" }}>
              Day {cycleDay}
            </div>
          </div>
        </div>
        {/* Phase name below ring — only once */}
        <div style={{ fontFamily: "'Cormorant', serif", fontSize: 23, fontWeight: 400, color: "#2D2926", marginTop: 12 }}>
          {phase.name} Phase
        </div>
      </div>

      {/* ── PHASE CARD (no repeated phase title) ── */}
      <div style={{ margin: "0 16px 12px", background: phase.bg, borderRadius: 20, padding: "18px 20px", border: `1.5px solid ${phase.border}` }}>

        {/* Tagline only — no phase name repeated */}
        <T size={13} color="#5A5048" style={{ display: "block", lineHeight: 1.7, marginBottom: 18 }}>
          {phase.tagline}
        </T>

        {/* 2×2 attribute grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px", marginBottom: 16 }}>
          {[
            { label: "Energy",   value: home.energy },
            { label: "Focus",    value: home.focus },
            { label: "Social",   value: home.social },
            { label: "Physical", value: home.physical },
          ].map(({ label, value }) => (
            <div key={label}>
              <span style={{ fontFamily: "'Nunito', sans-serif", fontSize: 9, fontWeight: 700, color: phase.color, textTransform: "uppercase", letterSpacing: "0.12em", display: "block", marginBottom: 3 }}>{label}</span>
              <T size={14} bold color="#2D2926">{value}</T>
            </div>
          ))}
        </div>

        {/* Menstruation countdown — no moon icon */}
        <div style={{ paddingTop: 13, borderTop: `1px solid ${phase.border}` }}>
          <T size={12} color={phase.color}>
            Menstruation is expected in <span style={{ fontWeight: 700 }}>{daysLeft} day{daysLeft !== 1 ? "s" : ""}</span>
          </T>
        </div>
      </div>

      {/* ── ONE TASK FOR TODAY ── */}
      <div style={{ margin: "0 16px 10px", background: "#fff", borderRadius: 16, padding: "16px 18px", border: "1.5px solid #F0EDE8" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <div style={{
            width: 38, height: 38, borderRadius: "50%", background: phase.soft, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontSize: 17 }}>✦</span>
          </div>
          <T size={14} bold color="#2D2926">One task for today</T>
        </div>
        <T size={13} color="#5A5048" style={{ display: "block", lineHeight: 1.65, paddingLeft: 50 }}>
          {home.advice[0]}
        </T>
      </div>

      {/* ── TODAY'S SCORECARD ── */}
      <button
        onClick={() => navigateTo("today")}
        style={{
          margin: "0 16px 10px", display: "flex", alignItems: "center", justifyContent: "space-between",
          width: "calc(100% - 32px)", padding: "16px 18px",
          background: "#fff", borderRadius: 16, border: "1.5px solid #F0EDE8",
          cursor: "pointer", textAlign: "left",
        }}>
        <div>
          <T size={14} bold color="#2D2926" style={{ display: "block", marginBottom: 3 }}>Today's Scorecard</T>
          <T size={12} color="#9A8F86">Start your daily check-in</T>
        </div>
        <span style={{ fontSize: 18, color: "#C8C0BA" }}>›</span>
      </button>

      {/* ── QUICK LINKS ── */}
      <div style={{ margin: "0 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <button
          onClick={() => navigateTo("calendar")}
          style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #F0EDE8", padding: "16px", textAlign: "left", cursor: "pointer" }}>
          <span style={{ fontSize: 28, display: "block", marginBottom: 8 }}>📅</span>
          <T size={13} bold color="#2D2926" style={{ display: "block", marginBottom: 2 }}>Plan Ahead</T>
          <T size={11} color="#9A8F86" style={{ display: "block" }}>View your cycle calendar</T>
        </button>
        <button
          onClick={() => navigateTo("insights")}
          style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #F0EDE8", padding: "16px", textAlign: "left", cursor: "pointer" }}>
          <span style={{ fontSize: 28, display: "block", marginBottom: 8 }}>✨</span>
          <T size={13} bold color="#2D2926" style={{ display: "block", marginBottom: 2 }}>Insights</T>
          <T size={11} color="#9A8F86" style={{ display: "block" }}>Discover your patterns</T>
        </button>
      </div>
    </div>
  );
}

// ── PHASE DATA ────────────────────────────────────────────────────────────────
const PHASES = {
  menstrual: {
    name: "Menstrual", emoji: "🌑", days: "Days 1–5",
    color: "#C4796A", bg: "#FFF8F6", soft: "#FDEEE9", border: "#F2CBBC",
    tagline: "Keep it simple. Rest where you can.",
    brief: "Hormones are at their lowest right now. Your body is doing real work — even if it doesn't show externally. Lighter days and fewer commitments tend to work better.",
    lateBrief: null,
    baseline: [
      "Energy: expect lower output — plan accordingly.",
      "Pace: one or two tasks max; skip non-essentials.",
      "If cramps or fatigue hit: warmth, water, gentle movement or full rest.",
    ],
    guidance: {
      nutrition: {
        bullets: [
          "Iron is lost through blood — iron-rich foods help replenish.",
          "Warm, easy-to-digest meals tend to feel better than cold or raw.",
          "Limit caffeine if cramps are present — it can tighten blood vessels.",
        ],
        recipes: [
          {
            name: "Lentil & Spinach Soup",
            steps: "1. Sauté 1 diced onion and 2 garlic cloves in olive oil until soft.\n2. Add 1 cup red lentils, 1 diced carrot, 1 tsp cumin, 1 tsp turmeric.\n3. Pour in 4 cups vegetable stock. Simmer 20 min until lentils are soft.\n4. Stir in 2 large handfuls of spinach. Season and serve.",
          },
          {
            name: "Scrambled Eggs on Toast",
            steps: "1. Whisk 3 eggs with a splash of milk, salt and pepper.\n2. Melt butter in a pan on low heat. Add eggs.\n3. Stir gently until just set — don't overcook.\n4. Serve on 2 slices of whole grain toast. Add sliced avocado if you have it.",
          },
          {
            name: "Salmon Rice Bowl",
            steps: "1. Cook 1 cup of rice according to packet instructions.\n2. Season a salmon fillet with salt, pepper, and a little soy sauce.\n3. Pan-fry skin-side down for 4 min, flip and cook 2 more min.\n4. Serve over rice with sliced cucumber, a drizzle of sesame oil, and optional chilli flakes.",
          },
        ],
      },
      movement: {
        bullets: [
          "Gentle movement — yin yoga, slow walking, light stretching — suits this phase.",
          "Avoid high-intensity if energy is low or cramps are present.",
          "Rest is a valid choice on day 1–2.",
        ],
        linkLabel: "You could try:",
        links: [
          { label: "Yoga With Adriene — gentle flow", url: "https://www.youtube.com/results?search_query=yoga+with+adriene+gentle+flow" },
          { label: "Low impact workout — MadFit", url: "https://www.youtube.com/results?search_query=madfit+low+impact+workout" },
          { label: "Walking workout — Leslie Sansone", url: "https://www.youtube.com/results?search_query=walking+workout+leslie+sansone" },
        ],
      },
      meditation: {
        bullets: [
          "Body scan and slow breathing tend to work well when energy is low.",
          "NSDR (Non-Sleep Deep Rest) is a practical option — 10 mins can restore.",
          "A 5-minute pause beats nothing.",
        ],
        linkLabel: "You could try:",
        links: [
          { label: "NSDR — 10 min", url: "https://www.youtube.com/results?search_query=nsdr+10+minutes" },
          { label: "Body scan meditation", url: "https://www.youtube.com/results?search_query=body+scan+meditation+10+minutes" },
          { label: "Box breathing — 5 min", url: "https://www.youtube.com/results?search_query=box+breathing+5+minutes" },
        ],
      },
      mood: {
        bullets: [
          "Hormone levels are at their lowest — mood dips are expected, not a sign something is wrong.",
          "If you feel low: food, water, warmth, and reduced stimulation help most.",
          "Patterns across cycles are visible in your history view.",
        ],
        links: [],
      },
      work: {
        bullets: [
          "Best fit: reviewing, editing, organising — low-output, high-clarity tasks.",
          "Avoid launching new projects or heavy meetings if energy is low.",
          "Shorter focused sprints work better than long sessions.",
        ],
        linkLabel: "Music to help you focus:",
        links: [
          { label: "Focus instrumental — Spotify", url: "https://open.spotify.com/search/focus%20instrumental" },
          { label: "Lo-fi focus — Spotify", url: "https://open.spotify.com/search/lofi%20focus" },
        ],
      },
      social: { bullets: ["Social capacity is naturally low right now.", "Smaller groups or one-to-one works better.", "Shortening plans is a practical choice."], links: [] },
      relationships: { bullets: ["Sensitivity is higher — small misreads happen faster.", "Low-effort connection works well: a walk, quiet time, tea.", "Clarify intent if things feel tense."], links: [] },
      intimacy: { bullets: ["Desire is typically lower during menstruation.", "Closeness without pressure often works well here.", "Follow what feels right."], links: [] },
      sleep: {
        bullets: [
          "Sleep need is often higher during menstruation — 8–9 hours supports recovery.",
          "Progesterone drops at the start of this phase, which can disrupt sleep quality.",
          "Warmth before bed (bath, heat pad) may ease cramps and help you fall asleep.",
          "If you wake at night, iron depletion may contribute — check your intake.",
        ],
      },
      vitamins: {
        suggestions: [
          { name: "Magnesium glycinate", why: "May help with cramps and sleep quality." },
          { name: "Iron", why: "Supports energy if blood loss is significant." },
          { name: "Omega-3", why: "Anti-inflammatory; may reduce period pain." },
          { name: "Vitamin D", why: "Supports mood and immune function year-round." },
        ],
      },
      hormonal: {
        phase_bullets: [
          { h: "Estrogen (E3G)", unit: "ng/mL", t: "At its lowest — rises slowly over coming days." },
          { h: "Progesterone (PdG)", unit: "µg/mL", t: "At baseline." },
          { h: "LH", unit: "mIU/mL", t: "Low." },
          { h: "FSH", unit: "mIU/mL", t: "Starting to rise to trigger next follicle development." },
          { h: "BBT", unit: "°C/°F", t: "Drops just before/during period — lowest of cycle." },
        ],
      },
    },
  },
  follicular: {
    name: "Follicular", emoji: "🌒", days: "Days 6–13",
    color: "#5A9E80", bg: "#F3FAF7", soft: "#E4F4EC", border: "#B2DBC8",
    tagline: "Good time to start things and say yes.",
    brief: "Estrogen is rising steadily. Mental clarity, motivation, and physical energy are building. This tends to be one of the more productive phases for most people.",
    lateBrief: null,
    baseline: [
      "Focus: tends to be sharper — good for creative or analytical work.",
      "Pace: capacity is building; good window for new projects.",
      "Energy: generally higher — use it, but don't exhaust the surplus.",
    ],
    guidance: {
      nutrition: {
        bullets: [
          "Lighter, varied meals tend to suit rising energy.",
          "Fermented foods (yogurt, kefir, kimchi) support gut health.",
          "Good window for trying new foods or recipes.",
        ],
        recipes: [
          {
            name: "Greek Yogurt Bowl",
            steps: "1. Spoon 200g full-fat Greek yogurt into a bowl.\n2. Top with a handful of fresh berries (blueberries, strawberries, raspberries).\n3. Add a small handful of mixed nuts or granola.\n4. Drizzle with a little honey if you like sweetness.",
          },
          {
            name: "Quinoa & Roasted Veg Bowl",
            steps: "1. Cook 1 cup quinoa in 2 cups water for 15 min.\n2. Chop 2 courgettes, 1 red pepper, and 1 red onion. Toss with olive oil and salt.\n3. Roast at 200°C for 20–25 min until golden.\n4. Assemble bowl with quinoa, veg, chickpeas, and a spoonful of tahini. Squeeze lemon over.",
          },
          {
            name: "Salmon & Avocado Rice Bowl",
            steps: "1. Cook 1 cup of rice. Season a salmon fillet with salt and pepper.\n2. Pan-fry skin-side down for 4 min, flip and cook 2 more min.\n3. Slice half an avocado.\n4. Serve everything over rice with sesame seeds and a drizzle of soy sauce.",
          },
        ],
      },
      movement: {
        bullets: [
          "Strength training, HIIT, and new physical challenges suit rising estrogen.",
          "Recovery tends to be faster this phase — good for pushing output.",
          "Try something new if motivation is there.",
        ],
        linkLabel: "You could try:",
        links: [
          { label: "Energising flow — Yoga With Adriene", url: "https://www.youtube.com/results?search_query=yoga+with+adriene+energising+flow" },
          { label: "Full body strength — MadFit", url: "https://www.youtube.com/results?search_query=madfit+full+body+strength" },
          { label: "HIIT — no equipment", url: "https://www.youtube.com/results?search_query=hiit+workout+no+equipment+30+minutes" },
        ],
      },
      meditation: {
        bullets: [
          "Energising breathwork and visualisation work well this phase.",
          "Good window to set intentions for the coming weeks.",
          "Even brief morning practices help anchor the day.",
        ],
        linkLabel: "You could try:",
        links: [
          { label: "Morning meditation — 10 min", url: "https://www.youtube.com/results?search_query=morning+meditation+10+minutes" },
          { label: "Breathwork for energy", url: "https://www.youtube.com/results?search_query=breathwork+for+energy+5+minutes" },
          { label: "Box breathing — 5 min", url: "https://www.youtube.com/results?search_query=box+breathing+5+minutes" },
        ],
      },
      mood: {
        bullets: [
          "Mood tends to lift as estrogen rises — more stable and optimistic baseline.",
          "Good time to tackle things that require emotional resilience.",
          "Patterns across cycles are visible in your history view.",
        ],
        links: [],
      },
      work: {
        bullets: [
          "Strong window for starting projects, pitching ideas, scheduling key meetings.",
          "Verbal fluency and creative thinking tend to be higher.",
          "Use this phase to tackle work that needs fresh thinking.",
        ],
        linkLabel: "Music to help you focus:",
        links: [
          { label: "Focus instrumental — Spotify", url: "https://open.spotify.com/search/focus%20instrumental" },
          { label: "Lo-fi focus — Spotify", url: "https://open.spotify.com/search/lofi%20focus" },
        ],
      },
      social: { bullets: ["Social energy is building — good for reconnecting and saying yes.", "Good phase for networking, group events, new meetings.", "Choose interactions that feel easy and energising."], links: [] },
      relationships: { bullets: ["Warmth and openness are naturally higher this phase.", "Good time for plans and quality time.", "Low-effort connection: walks, shared meals, easy evenings."], links: [] },
      intimacy: { bullets: ["Desire tends to build toward ovulation.", "Good phase for exploratory, relaxed connection.", "Follow what feels right."], links: [] },
      sleep: {
        bullets: [
          "Sleep quality often improves as estrogen rises — you may notice it feels easier.",
          "7–8 hours tends to be enough this phase; less recovery debt from sleep.",
          "Rising energy can make it harder to wind down — a consistent sleep time helps.",
          "Good window to establish better sleep habits — your body is receptive.",
        ],
      },
      vitamins: {
        suggestions: [
          { name: "B-complex", why: "Supports energy metabolism and mood." },
          { name: "Zinc", why: "Supports follicle development." },
          { name: "Probiotic", why: "Supports gut health and estrogen metabolism." },
          { name: "Vitamin D", why: "Mood and immune support, year-round." },
        ],
      },
      hormonal: {
        phase_bullets: [
          { h: "Estrogen (E3G)", unit: "ng/mL", t: "Rising steadily — drives energy and clarity." },
          { h: "Progesterone (PdG)", unit: "µg/mL", t: "Low." },
          { h: "LH", unit: "mIU/mL", t: "Low until near ovulation." },
          { h: "FSH", unit: "mIU/mL", t: "Active — stimulating follicle development." },
          { h: "BBT", unit: "°C/°F", t: "Lower in follicular phase; rises after ovulation." },
        ],
      },
    },
  },
  ovulatory: {
    name: "Ovulatory", emoji: "🌕", days: "Days 14–16",
    color: "#B8882A", bg: "#FFFCF0", soft: "#FEF7E0", border: "#EDD898",
    tagline: "Peak window for people, output, and connection.",
    brief: "Estrogen peaks and an LH surge triggers ovulation. Social confidence, verbal fluency, and physical capacity are all at their highest point in the cycle.",
    lateBrief: null,
    baseline: [
      "Focus: strong for communication, leadership, presenting.",
      "Pace: high capacity — good for demanding social or professional tasks.",
      "Energy: peak window — use it strategically.",
    ],
    guidance: {
      nutrition: {
        bullets: [
          "Cruciferous vegetables (broccoli, Brussels sprouts, cauliflower) support estrogen clearance.",
          "Stay well hydrated — especially if physically active.",
          "Light, antioxidant-rich meals suit peak energy.",
        ],
        recipes: [
          {
            name: "Salmon, Broccoli & Rice Bowl",
            steps: "1. Cook 1 cup rice. Steam 1 head of broccoli florets for 5 min.\n2. Season a salmon fillet with salt, pepper, a squeeze of lemon.\n3. Pan-fry skin-side down 4 min, flip and cook 2 min more.\n4. Assemble bowl. Top with sesame seeds and a drizzle of soy or tamari.",
          },
          {
            name: "Grain Bowl with Tahini",
            steps: "1. Cook 1 cup quinoa or bulgur wheat.\n2. Roast a mix of vegetables (peppers, courgette, red onion) at 200°C for 20 min.\n3. Add a tin of drained chickpeas to the tray for the last 10 min.\n4. Mix 2 tbsp tahini with lemon juice and a little water until drizzleable. Serve over everything.",
          },
          {
            name: "Green Smoothie",
            steps: "1. Add 2 large handfuls of spinach to a blender.\n2. Add 1 banana, 1 tbsp flax seeds, 250ml almond milk.\n3. Optional: add a scoop of protein powder or half an avocado.\n4. Blend until smooth. Drink immediately.",
          },
        ],
      },
      movement: {
        bullets: [
          "Athletic capacity peaks around ovulation — good time for personal bests.",
          "Heavy lifting, HIIT, and higher-intensity cardio all suit this phase.",
          "Recovery is faster here than in luteal.",
        ],
        linkLabel: "You could try:",
        links: [
          { label: "Peak performance HIIT", url: "https://www.youtube.com/results?search_query=hiit+peak+performance+workout" },
          { label: "Full body strength — MadFit", url: "https://www.youtube.com/results?search_query=madfit+full+body+strength" },
          { label: "High energy cardio", url: "https://www.youtube.com/results?search_query=high+energy+cardio+workout+30+min" },
        ],
      },
      meditation: {
        bullets: [
          "Gratitude and visualisation practices tend to land well at peak estrogen.",
          "Short grounding practices help sustain high-output days.",
          "Even a 5-minute midday pause helps.",
        ],
        linkLabel: "You could try:",
        links: [
          { label: "Loving kindness — 10 min", url: "https://www.youtube.com/results?search_query=loving+kindness+meditation+10+minutes" },
          { label: "Breathwork — 5 min", url: "https://www.youtube.com/results?search_query=box+breathing+5+minutes" },
          { label: "NSDR — 10 min", url: "https://www.youtube.com/results?search_query=nsdr+10+minutes" },
        ],
      },
      mood: {
        bullets: [
          "Confidence and emotional stability tend to be highest around ovulation.",
          "Good window for conversations that need warmth and clarity.",
          "Patterns across cycles are visible in your history view.",
        ],
        links: [],
      },
      work: {
        bullets: [
          "Best window for presenting, pitching, negotiating, leading.",
          "Schedule your most visible or high-stakes work here.",
          "Verbal fluency and confidence are at their peak.",
        ],
        linkLabel: "Music to help you focus:",
        links: [
          { label: "Focus instrumental — Spotify", url: "https://open.spotify.com/search/focus%20instrumental" },
          { label: "Lo-fi focus — Spotify", url: "https://open.spotify.com/search/lofi%20focus" },
        ],
      },
      social: { bullets: ["Peak social capacity — good for hosting, group events, networking.", "You may feel more comfortable in unfamiliar social settings.", "Choose interactions that feel energising."], links: [] },
      relationships: { bullets: ["Emotional availability tends to be high.", "Good phase for meaningful conversations or plans.", "Low-effort connection: walks, shared meals, easy evenings."], links: [] },
      intimacy: { bullets: ["Desire often peaks around ovulation.", "Confidence in the body tends to be higher.", "Follow what feels right."], links: [] },
      sleep: {
        bullets: [
          "Sleep need is typically at its lowest this phase — 6.5–8 hours often feels sufficient.",
          "LH surge and higher body temperature around ovulation can briefly affect sleep.",
          "If you feel wired at night, it may be hormonal — a wind-down routine helps.",
          "This is often when sleep feels most restorative and deep.",
        ],
      },
      vitamins: {
        suggestions: [
          { name: "Antioxidants (Vit C + E)", why: "Support egg quality and cell protection." },
          { name: "CoQ10", why: "Supports cellular energy production." },
          { name: "Magnesium", why: "Helps regulate the LH surge." },
          { name: "Omega-3", why: "Supports inflammation balance." },
        ],
      },
      hormonal: {
        phase_bullets: [
          { h: "Estrogen (E3G)", unit: "ng/mL", t: "Peaks just before ovulation." },
          { h: "Progesterone (PdG)", unit: "µg/mL", t: "Low — rises after ovulation." },
          { h: "LH", unit: "mIU/mL", t: "Peaks to trigger ovulation (the LH surge)." },
          { h: "FSH", unit: "mIU/mL", t: "Small secondary peak alongside LH." },
          { h: "BBT", unit: "°C/°F", t: "Rises 0.2–0.5°C after ovulation and stays elevated." },
        ],
      },
    },
  },
  luteal: {
    name: "Luteal", emoji: "🌖", days: "Days 17–28",
    color: "#7B6BA0", bg: "#F9F7FF", soft: "#F0EBF8", border: "#C9BCDF",
    tagline: "Prioritize essentials. Keep plans simple. Finish what matters.",
    brief: "Your body is shifting into the second half of the cycle. Progesterone is higher, which can make you prefer structure and a quieter pace. Plan for steady work, fewer social layers, and earlier wind-down.",
    lateBrief: "Progesterone starts dropping as your period approaches. Some people notice lower patience, heavier body feel, or more sensitivity. Keep the day lighter where you can: essentials first, space between commitments, earlier bedtime.",
    baseline: [
      "Focus: better for one or two clear tasks than multitasking.",
      "Pace: aim for steady progress, not a packed schedule.",
      "If mood or energy dips: choose lighter work and cover basics (food, water, sleep).",
    ],
    guidance: {
      nutrition: {
        bullets: [
          "Cravings can increase in luteal (often for carbs or salty foods). Plan one satisfying snack instead of grazing.",
          "Protein + fiber per meal helps stabilize energy and reduce cravings.",
          "If bloating shows up, ease back on very salty foods and increase water.",
        ],
        recipes: [
          {
            name: "Salmon + Rice Bowl",
            steps: "1. Cook 1 cup of rice. Season a salmon fillet with salt, pepper, and a squeeze of lemon.\n2. Pan-fry skin-side down 4 min, flip 2 min.\n3. Slice half a cucumber into rounds.\n4. Serve salmon over rice with cucumber and a drizzle of light soy or sesame oil.",
          },
          {
            name: "Greek Yogurt with Berries & Nuts",
            steps: "1. Spoon 200g full-fat Greek yogurt into a bowl.\n2. Add a handful of mixed berries.\n3. Top with a small handful of walnuts or almonds.\n4. Optional: add 1 tsp pumpkin seeds and a drizzle of honey.",
          },
          {
            name: "Lentil Soup",
            steps: "1. Sauté 1 diced onion and 2 garlic cloves in olive oil until soft.\n2. Add 1 cup red lentils, 1 diced carrot, 1 tsp cumin, ½ tsp turmeric.\n3. Pour in 4 cups stock. Simmer 20 min until lentils are soft.\n4. Stir in spinach. Season with salt and pepper. Serve warm.",
          },
        ],
      },
      movement: {
        bullets: [
          "Early luteal: strength training and steady cardio often feel good.",
          "Late luteal: choose lower impact if joints feel looser or energy dips.",
          "Avoid max-effort if recovery feels slower than usual.",
        ],
        linkLabel: "You could try:",
        links: [
          { label: "Gentle flow — Yoga With Adriene", url: "https://www.youtube.com/results?search_query=yoga+with+adriene+gentle+flow" },
          { label: "Low impact workout — MadFit", url: "https://www.youtube.com/results?search_query=madfit+low+impact+workout" },
          { label: "Walking workout — Leslie Sansone", url: "https://www.youtube.com/results?search_query=walking+workout+leslie+sansone" },
        ],
      },
      meditation: {
        bullets: [
          "If you feel reactive, try body-scan or breath counting.",
          "Non-Sleep Deep Rest (NSDR) can reduce stress load quickly.",
          "A 5-minute reset beats none.",
        ],
        linkLabel: "You could try:",
        links: [
          { label: "NSDR — 10 min", url: "https://www.youtube.com/results?search_query=nsdr+10+minutes" },
          { label: "Body scan meditation", url: "https://www.youtube.com/results?search_query=body+scan+meditation+10+minutes" },
          { label: "Box breathing — 5 min", url: "https://www.youtube.com/results?search_query=box+breathing+5+minutes" },
        ],
      },
      mood: {
        bullets: [
          "In late luteal, a hormone shift can make emotions feel louder.",
          "If you feel edgy: a walk, real food, and an earlier night helps most.",
          "Patterns that repeat each cycle are visible in your history view.",
        ],
        links: [],
      },
      work: {
        bullets: [
          "Best fit today: editing, planning, analysis, finishing tasks.",
          "Late luteal: reduce meetings; protect 1–2 priority focus blocks.",
          "Use checklists and shorter sprints.",
        ],
        linkLabel: "Music to help you focus:",
        links: [
          { label: "Focus instrumental — Spotify", url: "https://open.spotify.com/search/focus%20instrumental" },
          { label: "Lo-fi focus — Spotify", url: "https://open.spotify.com/search/lofi%20focus" },
        ],
      },
      social: { bullets: ["You may prefer smaller groups or familiar people.", "If you're overbooked, shorten plans rather than forcing long hangouts.", "Choose interactions that feel easy."], links: [] },
      relationships: { bullets: ["Sensitivity can be higher late luteal — misreads happen faster.", "Small repairs help: clarify intent, slow down, sleep earlier.", "Choose low-effort connection: a walk, tea, calm time together."], links: [] },
      intimacy: { bullets: ["Desire can shift day-to-day.", "Closeness without pressure often works well here.", "Follow what feels right."], links: [] },
      sleep: {
        bullets: [
          "Sleep need rises in the luteal phase — 8–9 hours is common and appropriate.",
          "Progesterone has a mild sedative effect early luteal; you may feel sleepier.",
          "Late luteal (pre-period): progesterone drops and sleep can fragment or feel lighter.",
          "Magnesium glycinate before bed may support sleep quality and reduce restlessness.",
        ],
      },
      vitamins: {
        suggestions: [
          { name: "Magnesium glycinate", why: "Most evidence-backed for PMS — especially sleep and mood." },
          { name: "B6", why: "Supports progesterone and serotonin balance." },
          { name: "Omega-3", why: "Reduces inflammation; may ease breast tenderness." },
          { name: "Evening Primrose Oil", why: "Sometimes used for breast tenderness in luteal phase." },
        ],
      },
      hormonal: {
        phase_bullets: [
          { h: "Estrogen (E3G)", unit: "ng/mL", t: "Lower than at ovulation; can fluctuate." },
          { h: "Progesterone (PdG)", unit: "µg/mL", t: "Higher in mid-luteal; drops close to period." },
          { h: "LH", unit: "mIU/mL", t: "Low (peak happened before ovulation)." },
          { h: "FSH", unit: "mIU/mL", t: "Low/steady — rises again as next cycle begins." },
          { h: "BBT", unit: "°C/°F", t: "Often higher after ovulation; may dip just before period." },
        ],
      },
    },
  },
};

// ── SYMPTOMS ──────────────────────────────────────────────────────────────────
const SYMPTOM_PRIORITY = {
  menstrual:  ["Cramps","Bloating","Fatigue","Headache","Low mood","Breast tenderness","Back pain","Nausea","Heavy flow","Light flow","Spotting","Brain fog","Sleepy","Food cravings","Sleep issues","Low energy","Irritable","Anxiety","Feeling overwhelmed","Water retention","Constipation","Acne","Increased discharge","Joint ache","Dry skin","Ovulation pain","Hot flashes"],
  follicular: ["Low energy","Brain fog","Acne","Dry skin","Sleepy","Headache","Bloating","Fatigue","Food cravings","Anxiety","Irritable","Low mood","Breast tenderness","Cramps","Back pain","Sleep issues","Water retention","Constipation","Joint ache","Feeling overwhelmed","Nausea","Spotting","Heavy flow","Light flow","Increased discharge","Ovulation pain","Hot flashes"],
  ovulatory:  ["Ovulation pain","Increased discharge","Breast tenderness","Bloating","Headache","Fatigue","Spotting","Acne","Anxiety","Irritable","Low mood","Cramps","Back pain","Brain fog","Sleepy","Food cravings","Sleep issues","Water retention","Constipation","Nausea","Low energy","Heavy flow","Light flow","Dry skin","Joint ache","Feeling overwhelmed","Hot flashes"],
  luteal:     ["Bloating","Breast tenderness","Irritable","Anxiety","Food cravings","Fatigue","Sleep issues","Headache","Water retention","Brain fog","Acne","Constipation","Back pain","Low energy","Feeling overwhelmed","Low mood","Cramps","Sleepy","Nausea","Dry skin","Joint ache","Spotting","Ovulation pain","Increased discharge","Heavy flow","Light flow","Hot flashes"],
};

// ── SCORECARD ─────────────────────────────────────────────────────────────────
const SCORECARD = [
  { key: "nutrition",     label: "Nutrition",               icon: "🥗", question: "How did you eat today?",                         options: ["Skipped / irregular","Unbalanced","Okay","Nourishing","Very balanced"] },
  { key: "movement",      label: "Movement / Sport",        icon: "🏃‍♀️", question: "How active were you today?",                    options: ["None","Minimal","Gentle","Balanced","Heavy workout"] },
  { key: "sleep",         label: "Sleep",                   icon: "🌙", question: "How well did you sleep last night?",             options: ["Very poor","Poor","Okay","Good","Very good"] },
  { key: "meditation",    label: "Quiet Time / Meditation", icon: "🧘‍♀️", question: "Did you get a pause or reset today?",           options: ["Not at all","Brief pause","Short reset","Meaningful pause","Deep reset"] },
  { key: "mood",          label: "Mood",                    icon: "💭", question: "How steady did you feel emotionally?",           options: ["Low","Unsettled","Neutral","Positive","Grounded"] },
  { key: "work",          label: "Work / Focus",            icon: "💼", question: "How did focus feel today?",                     options: ["Scattered","Hard to focus","Neutral","Clear","In flow"] },
  { key: "social",        label: "Social Energy",           icon: "🤝", question: "How social did you feel today?",                options: ["Reserved","Low capacity","Selective","Engaged","Very social"] },
  { key: "relationships", label: "Relationship",            icon: "❤️", question: "How connected did you feel with your partner?", options: ["Tense / distant","Slightly disconnected","Neutral","Warm","Deeply connected"] },
  { key: "intimacy",      label: "Intimacy",                icon: "🌹", question: "How open did you feel to intimacy?",            options: ["None","Low","Some","Strong","Very strong"] },
  { key: "vitamins",      label: "Vitamins",                icon: "💊", question: "Did you take supplements today?",               options: [], special: "vitamins" },
  { key: "hormonal",      label: "Hormones / BBT",          icon: "🔬", question: "Log values from your tracker (all optional).",  options: [], special: "hormonal" },
  { key: "overall",       label: "Overall",                 icon: "✨", question: "Overall, how did you feel today?",              options: ["Drained","Low energy","Balanced","Strong","Very good"] },
];

const VITAMIN_OPTIONS = ["Vitamin D","Magnesium","Omega-3","Iron","B-complex","Probiotic","Other"];

// ── HORMONE CHART DATA ────────────────────────────────────────────────────────
const HORMONE_DATA = Array.from({ length: 28 }, (_, i) => {
  const d = i + 1;
  return {
    day: d,
    Estrogen: Math.max(2, d<=5?10+d*2:d<=13?20+(d-5)*11.5:d===14?120:d<=16?100-(d-14)*20:d<=21?50+(d-16)*3:Math.max(5,65-(d-21)*9)),
    Progesterone: Math.max(1, d<=13?4:d<=16?6+(d-13)*3:d<=21?15+(d-16)*13:d<=25?80-(d-21)*11:Math.max(2,36-(d-25)*9)),
    LH: d===13?75:d===14?100:d===15?55:d===12?20:4,
    FSH: d<=1?14:d<=5?10:d<=11?6+d*1.1:d===13?28:d<=16?8:4,
  };
});

// ── UI PRIMITIVES ─────────────────────────────────────────────────────────────
const S = {
  label: { fontFamily:"'Nunito', sans-serif", fontSize:11, fontWeight:700, color:"#B5ADA8", textTransform:"uppercase", letterSpacing:"0.1em" },
};

function T({ size=13, color="#5A5048", bold=false, italic=false, style={}, children }) {
  return <span style={{ fontFamily:"'Nunito', sans-serif", fontSize:size, color, fontWeight:bold?700:400, fontStyle:italic?"italic":"normal", lineHeight:1.6, ...style }}>{children}</span>;
}

function Block({ style, children }) {
  return <div style={{ background:"#fff", borderRadius:14, border:"1.5px solid #F0EDE8", ...style }}>{children}</div>;
}

// ── HORMONE MINI-CHART ────────────────────────────────────────────────────────
function HormoneChart({ cycleDay, phaseKey }) {
  const phase = PHASES[phaseKey];
  const Tip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background:"#fff", border:"1px solid #EDE8E3", borderRadius:9, padding:"7px 11px" }}>
        <T size={11} bold color="#2D2926" style={{ display:"block", marginBottom:2 }}>Day {label}</T>
        {payload.map(p => <div key={p.name}><T size={10} color={p.color}>{p.name}: {Math.round(p.value)}</T></div>)}
      </div>
    );
  };
  return (
    <div>
      <div style={{ display:"flex", gap:2, marginBottom:4 }}>
        {[{label:"M",w:"18%",color:"#C4796A"},{label:"F",w:"29%",color:"#5A9E80"},{label:"O",w:"10%",color:"#B8882A"},{label:"L",w:"43%",color:"#7B6BA0"}].map(p=>(
          <div key={p.label} style={{ width:p.w, textAlign:"center", background:`${p.color}14`, borderRadius:4, padding:"2px 0" }}>
            <span style={{ fontFamily:"'Nunito', sans-serif", fontSize:8, color:p.color, fontWeight:700 }}>{p.label}</span>
          </div>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={130}>
        <LineChart data={HORMONE_DATA} margin={{ top:2, right:4, left:-28, bottom:0 }}>
          <XAxis dataKey="day" tick={{ fontSize:8, fontFamily:"'Nunito', sans-serif", fill:"#C5BDB5" }} axisLine={false} tickLine={false} interval={4} />
          <YAxis hide />
          <Tooltip content={<Tip />} />
          <ReferenceLine x={cycleDay} stroke={phase.color} strokeWidth={1.5} strokeDasharray="3 2" />
          <Line type="monotone" dataKey="Estrogen" stroke="#C4796A" strokeWidth={1.8} dot={false} />
          <Line type="monotone" dataKey="Progesterone" stroke="#7B6BA0" strokeWidth={1.8} dot={false} />
          <Line type="monotone" dataKey="LH" stroke="#B8882A" strokeWidth={1.4} dot={false} strokeDasharray="4 2" />
          <Line type="monotone" dataKey="FSH" stroke="#5A9E80" strokeWidth={1.4} dot={false} strokeDasharray="3 3" />
        </LineChart>
      </ResponsiveContainer>
      <div style={{ display:"flex", flexWrap:"wrap", gap:7, marginTop:4 }}>
        {[{n:"Estrogen",c:"#C4796A"},{n:"Progesterone",c:"#7B6BA0"},{n:"LH",c:"#B8882A"},{n:"FSH",c:"#5A9E80"}].map(h=>(
          <div key={h.n} style={{ display:"flex", alignItems:"center", gap:4 }}>
            <div style={{ width:14, height:2.5, background:h.c, borderRadius:2 }} />
            <T size={10} color="#8A7F78">{h.n}</T>
          </div>
        ))}
      </div>
      <T size={10} italic color="#C5BDB5" style={{ display:"block", marginTop:4 }}>Illustrative pattern — individual levels vary.</T>
    </div>
  );
}

// ── RECIPE CARD (expandable) ──────────────────────────────────────────────────
function RecipeCard({ recipe, phase }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background:"rgba(255,255,255,0.8)", borderRadius:9, border:`1px solid ${phase.border}`, marginBottom:6, overflow:"hidden" }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width:"100%", padding:"9px 12px", background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between", textAlign:"left" }}>
        <T size={12} bold color="#2D2926">{recipe.name}</T>
        <span style={{ color:"#C5BDB5", fontSize:14, transform:open?"rotate(90deg)":"none", transition:"transform 0.15s", flexShrink:0 }}>›</span>
      </button>
      {open && (
        <div style={{ padding:"0 12px 12px" }}>
          {recipe.steps.split("\n").map((line, i) => (
            <div key={i} style={{ display:"flex", gap:7, marginBottom:4 }}>
              <T size={11} color={phase.color} style={{ flexShrink:0, marginTop:1 }}>{line.split(".")[0]}.</T>
              <T size={12} color="#5A5048" style={{ lineHeight:1.6 }}>{line.split(".").slice(1).join(".").trim()}</T>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── GUIDE PANEL ───────────────────────────────────────────────────────────────
function GuidePanel({ catKey, phaseKey, cycleDay }) {
  const phase = PHASES[phaseKey];
  const g = phase.guidance[catKey];
  if (!g) return null;

  return (
    <div style={{ marginTop:11, background:phase.soft, borderRadius:10, padding:"13px 14px", border:`1px solid ${phase.border}` }}>

      {/* Bullets */}
      {g.bullets?.length > 0 && (
        <ul style={{ margin:0, padding:0, listStyle:"none", display:"flex", flexDirection:"column", gap:5, marginBottom:10 }}>
          {g.bullets.map((b, i) => (
            <li key={i} style={{ display:"flex", gap:7, alignItems:"flex-start" }}>
              <span style={{ color:phase.color, fontSize:12, marginTop:1, flexShrink:0 }}>·</span>
              <T size={12} color="#5A5048" style={{ lineHeight:1.6 }}>{b}</T>
            </li>
          ))}
        </ul>
      )}

      {/* Recipes (nutrition only) */}
      {g.recipes?.length > 0 && (
        <div style={{ marginBottom:10 }}>
          <T size={11} bold color="#9A8F86" style={{ display:"block", textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:7 }}>Simple meal ideas</T>
          {g.recipes.map((r, i) => <RecipeCard key={i} recipe={r} phase={phase} />)}
        </div>
      )}

      {/* Hormone chart + phase bullets (hormonal only) */}
      {catKey === "hormonal" && (
        <div style={{ marginBottom:10 }}>
          <T size={11} bold color="#9A8F86" style={{ display:"block", textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:8 }}>Hormone map — typical pattern</T>
          <HormoneChart cycleDay={cycleDay} phaseKey={phaseKey} />
          {g.phase_bullets?.length > 0 && (
            <div style={{ marginTop:10 }}>
              <T size={11} bold color="#9A8F86" style={{ display:"block", textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:7 }}>Typical levels — {PHASES[phaseKey].name}</T>
              {g.phase_bullets.map((pb, i) => (
                <div key={i} style={{ display:"flex", gap:5, marginBottom:4, flexWrap:"wrap" }}>
                  <T size={12} bold color={phase.color}>{pb.h}</T>
                  <T size={11} color="#C5BDB5">({pb.unit})</T>
                  <T size={12} color="#5A5048">— {pb.t}</T>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Links with label */}
      {g.links?.length > 0 && (
        <div style={{ marginTop:4 }}>
          {g.linkLabel && <T size={11} bold color="#9A8F86" style={{ display:"block", marginBottom:6 }}>{g.linkLabel}</T>}
          <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
            {g.links.map((lk, i) => (
              <a key={i} href={lk.url} target="_blank" rel="noopener noreferrer"
                style={{ display:"flex", alignItems:"center", gap:5, fontFamily:"'Nunito', sans-serif", fontSize:12, color:phase.color, fontWeight:600, textDecoration:"none" }}>
                <span style={{ fontSize:10 }}>↗</span>
                <span style={{ borderBottom:`1px solid ${phase.color}40` }}>{lk.label}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── VITAMINS ROW ──────────────────────────────────────────────────────────────
function VitaminsRow({ value, onChange, phaseKey }) {
  const phase = PHASES[phaseKey];
  const g = phase.guidance.vitamins;
  const [showGuide, setShowGuide] = useState(false);
  const [selected, setSelected] = useState(value?.selected || []);
  const [otherText, setOtherText] = useState(value?.otherText || "");

  function toggle(v) {
    const next = selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v];
    setSelected(next);
    onChange({ ...value, selected: next, otherText });
  }

  return (
    <div style={{ marginBottom:20, paddingBottom:18, borderBottom:"1px solid #F8F5F0" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
        <span style={{ fontSize:17 }}>💊</span>
        <T size={14} bold color="#2D2926">Vitamins</T>
        <button onClick={() => setShowGuide(s => !s)}
          style={{ marginLeft:"auto", fontSize:11, fontFamily:"'Nunito', sans-serif", fontWeight:600, color:phase.color, background:phase.soft, border:`1px solid ${phase.border}`, borderRadius:20, padding:"2px 10px", cursor:"pointer" }}>
          {showGuide ? "hide" : "guide"}
        </button>
      </div>
      <T size={12} color="#9A918A" style={{ display:"block", marginBottom:10 }}>Did you take supplements today?</T>

      <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
        {["No","Some","Yes"].map(opt => {
          const active = value?.taken === opt;
          return (
            <button key={opt} onClick={() => onChange({ ...value, taken: active ? null : opt, selected, otherText })}
              style={{ padding:"6px 14px", borderRadius:20, border:`1.5px solid ${active ? phase.color : "#EDE8E3"}`, background:active ? phase.soft : "#FAFAF9", cursor:"pointer", fontFamily:"'Nunito', sans-serif", fontSize:11, fontWeight:active?700:400, color:active?phase.color:"#8A7F78" }}>
              {opt}
            </button>
          );
        })}
      </div>

      {(value?.taken === "Some" || value?.taken === "Yes") && (
        <div style={{ marginBottom:8 }}>
          <T size={11} bold color="#9A8F86" style={{ display:"block", marginBottom:6 }}>Which ones?</T>
          <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
            {VITAMIN_OPTIONS.map(v => {
              const active = selected.includes(v);
              return (
                <button key={v} onClick={() => toggle(v)}
                  style={{ padding:"4px 11px", borderRadius:20, border:`1.5px solid ${active ? phase.color : "#EDE8E3"}`, background:active ? phase.soft : "#FAFAF9", cursor:"pointer", fontFamily:"'Nunito', sans-serif", fontSize:11, fontWeight:active?700:400, color:active?phase.color:"#8A7F78" }}>
                  {v}
                </button>
              );
            })}
          </div>
          {selected.includes("Other") && (
            <input value={otherText} onChange={e => { setOtherText(e.target.value); onChange({ ...value, selected, otherText: e.target.value }); }}
              placeholder="Specify other supplement…"
              style={{ width:"100%", marginTop:7, padding:"8px 10px", borderRadius:9, border:"1.5px solid #EDE8E3", fontFamily:"'Nunito', sans-serif", fontSize:12, color:"#2D2926", outline:"none", boxSizing:"border-box", background:"#FDFAF7" }} />
          )}
        </div>
      )}

      {showGuide && (
        <div style={{ marginTop:11, background:phase.soft, borderRadius:10, padding:"13px 14px", border:`1px solid ${phase.border}` }}>
          <T size={11} bold color="#9A8F86" style={{ display:"block", textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:8 }}>Suggestions for {phase.name} phase</T>
          {g.suggestions.map((s, i) => (
            <div key={i} style={{ marginBottom:7 }}>
              <T size={12} bold color={phase.color}>{s.name}</T>
              <T size={12} color="#5A5048"> — {s.why}</T>
            </div>
          ))}
          <div style={{ marginTop:10, paddingTop:8, borderTop:`1px solid ${phase.border}` }}>
            <T size={11} italic color="#9A8F86">* Not medical advice. Check with a clinician for personalised guidance.</T>
          </div>
        </div>
      )}
    </div>
  );
}

// ── HORMONAL ROW ──────────────────────────────────────────────────────────────
function HormonalRow({ value, onChange, phaseKey, cycleDay }) {
  const phase = PHASES[phaseKey];
  const [showGuide, setShowGuide] = useState(false);
  const [bbtUnit, setBbtUnit] = useState(value?.bbtUnit || "°C");

  const HORMONE_FIELDS = [
    { key: "e3g", label: "Estrogen (E3G)", unit: "ng/mL",   step: "0.01" },
    { key: "pdg", label: "Progesterone (PdG)", unit: "µg/mL", step: "0.01" },
    { key: "lh",  label: "LH",             unit: "mIU/mL", step: "0.1" },
    { key: "fsh", label: "FSH",            unit: "mIU/mL", step: "0.1" },
  ];

  function update(k, v) { onChange({ ...value, [k]: v }); }

  return (
    <div style={{ marginBottom:20, paddingBottom:18, borderBottom:"1px solid #F8F5F0" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
        <span style={{ fontSize:17 }}>🔬</span>
        <T size={14} bold color="#2D2926">Hormones / BBT</T>
        <button onClick={() => setShowGuide(s => !s)}
          style={{ marginLeft:"auto", fontSize:11, fontFamily:"'Nunito', sans-serif", fontWeight:600, color:phase.color, background:phase.soft, border:`1px solid ${phase.border}`, borderRadius:20, padding:"2px 10px", cursor:"pointer" }}>
          {showGuide ? "hide" : "guide"}
        </button>
      </div>
      <T size={12} color="#9A918A" style={{ display:"block", marginBottom:12 }}>Log values from your tracker. All fields are optional.</T>

      {/* Hormone fields */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
        {HORMONE_FIELDS.map(f => (
          <div key={f.key}>
            <div style={{ display:"flex", alignItems:"baseline", gap:5, marginBottom:5 }}>
              <T size={11} bold color="#7A706A">{f.label}</T>
              <T size={10} color="#C5BDB5">{f.unit}</T>
            </div>
            <input
              type="number" step={f.step} min="0"
              value={value?.[f.key] || ""}
              onChange={e => update(f.key, e.target.value)}
              placeholder={`Enter value (${f.unit})`}
              style={{ width:"100%", padding:"8px 10px", borderRadius:9, border:"1.5px solid #EDE8E3", fontFamily:"'Nunito', sans-serif", fontSize:12, color:"#2D2926", outline:"none", boxSizing:"border-box", background:"#FDFAF7" }}
            />
          </div>
        ))}
      </div>

      {/* BBT */}
      <div style={{ marginBottom:6 }}>
        <div style={{ display:"flex", alignItems:"baseline", gap:5, marginBottom:5 }}>
          <T size={11} bold color="#7A706A">Basal Body Temperature (BBT)</T>
          <T size={10} color="#C5BDB5">{bbtUnit}</T>
        </div>
        <div style={{ display:"flex", gap:6 }}>
          <input
            type="number" step="0.01" min="30" max="45"
            value={value?.bbt || ""}
            onChange={e => update("bbt", e.target.value)}
            placeholder={`Enter value (${bbtUnit})`}
            style={{ flex:1, padding:"8px 10px", borderRadius:9, border:"1.5px solid #EDE8E3", fontFamily:"'Nunito', sans-serif", fontSize:12, color:"#2D2926", outline:"none", background:"#FDFAF7" }}
          />
          <div style={{ display:"flex", borderRadius:9, overflow:"hidden", border:"1.5px solid #EDE8E3", height:36 }}>
            {["°C","°F"].map(u => (
              <button key={u} onClick={() => { setBbtUnit(u); update("bbtUnit", u); }}
                style={{ padding:"0 12px", background:bbtUnit===u ? phase.color : "#FAFAF9", color:bbtUnit===u ? "#fff" : "#9A8F86", border:"none", cursor:"pointer", fontFamily:"'Nunito', sans-serif", fontSize:12, fontWeight:700 }}>
                {u}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Units disclaimer */}
      <T size={11} italic color="#C5BDB5" style={{ display:"block", marginTop:8 }}>
        Units may vary depending on your testing method. This log is for personal tracking only.
      </T>

      {showGuide && <GuidePanel catKey="hormonal" phaseKey={phaseKey} cycleDay={cycleDay} />}
    </div>
  );
}

// ── STANDARD SCORE ROW ────────────────────────────────────────────────────────
function ScoreRow({ item, value, onChange, phaseKey, cycleDay }) {
  const [showGuide, setShowGuide] = useState(false);
  const phase = PHASES[phaseKey];

  // categories that have no "add note"
  const NO_NOTE = ["nutrition","movement","sleep","meditation","mood","work","social","relationships","intimacy"];
  const hasGuide = !!phase.guidance[item.key]?.bullets?.length || !!phase.guidance[item.key]?.links?.length;

  return (
    <div style={{ marginBottom:20, paddingBottom:18, borderBottom:"1px solid #F8F5F0" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
        <span style={{ fontSize:17 }}>{item.icon}</span>
        <T size={14} bold color="#2D2926">{item.label}</T>
        {hasGuide && (
          <button onClick={() => setShowGuide(s => !s)}
            style={{ marginLeft:"auto", fontSize:11, fontFamily:"'Nunito', sans-serif", fontWeight:600, color:phase.color, background:phase.soft, border:`1px solid ${phase.border}`, borderRadius:20, padding:"2px 10px", cursor:"pointer" }}>
            {showGuide ? "hide" : "guide"}
          </button>
        )}
      </div>
      <T size={12} color="#9A918A" style={{ display:"block", marginBottom:10 }}>{item.question}</T>

      {item.options.length > 0 && (
        <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
          {item.options.map((opt, n) => {
            const val = n + 1;
            const active = value === val;
            return (
              <button key={n} onClick={() => onChange(active ? 0 : val)}
                style={{ padding:"6px 11px", borderRadius:20, border:`1.5px solid ${active ? phase.color : "#EDE8E3"}`, background:active ? phase.soft : "#FAFAF9", cursor:"pointer", fontFamily:"'Nunito', sans-serif", fontSize:11, fontWeight:active?700:400, color:active?phase.color:"#8A7F78", transition:"all 0.1s", whiteSpace:"nowrap" }}>
                {opt}
              </button>
            );
          })}
        </div>
      )}

      {showGuide && <GuidePanel catKey={item.key} phaseKey={phaseKey} cycleDay={cycleDay} />}
    </div>
  );
}

// ── SYMPTOMS BLOCK ────────────────────────────────────────────────────────────
function SymptomsBlock({ phaseKey, selected, onChange }) {
  const phase = PHASES[phaseKey];
  const ordered = SYMPTOM_PRIORITY[phaseKey];
  const INITIAL = 12;
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? ordered : ordered.slice(0, INITIAL);

  return (
    <Block style={{ padding:"16px", marginBottom:12 }}>
      <T size={13} bold color="#2D2926" style={{ display:"block", marginBottom:10 }}>Symptoms today</T>
      <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:8 }}>
        {visible.map(s => {
          const active = selected.includes(s);
          return (
            <button key={s} onClick={() => onChange(prev => active ? prev.filter(x => x !== s) : [...prev, s])}
              style={{ padding:"5px 12px", borderRadius:20, fontFamily:"'Nunito', sans-serif", fontSize:11, border:`1.5px solid ${active ? phase.color : "#EDE8E3"}`, background:active ? phase.soft : "#FAFAF9", color:active?phase.color:"#8A7F78", fontWeight:active?700:400, cursor:"pointer", transition:"all 0.1s" }}>
              {s}
            </button>
          );
        })}
      </div>
      <button onClick={() => setExpanded(e => !e)}
        style={{ background:"none", border:"none", cursor:"pointer", fontFamily:"'Nunito', sans-serif", fontSize:12, color:phase.color, fontWeight:600, padding:0 }}>
        {expanded ? "Show less ↑" : `Show more (${ordered.length - INITIAL} more) ↓`}
      </button>
    </Block>
  );
}

// ── TODAY TAB ─────────────────────────────────────────────────────────────────
function TodayTab({ profile, logs, onSave }) {
  const pl = profile.periodLength || 5;
  const cycleDay = useMemo(() => getCycleDay(profile.cycleStartDate, profile.cycleLength), [profile]);
  const phaseKey = getPhaseKey(cycleDay, profile.cycleLength, pl);
  const phase = PHASES[phaseKey];
  const home  = PHASE_HOME[phaseKey];
  const daysLeft = profile.cycleLength - cycleDay;

  const saved = loadCheckinLocal(todayStr());
  const [scores, setScores] = useState(saved.scores || {});
  const [vitaminsVal, setVitaminsVal] = useState(saved.vitaminsVal || {});
  const [hormonalVal, setHormonalVal] = useState(saved.hormonalVal || {});
  const [generalNote, setGeneralNote] = useState(saved.generalNote || "");
  const [specialNote, setSpecialNote] = useState(saved.specialNote || "");
  const [symptoms, setSymptoms] = useState(saved.symptoms || []);

  const autosave = useCallback((patch) => {
    const current = loadCheckinLocal(todayStr());
    const next = { ...current, date: todayStr(), cycleDay, phase: phaseKey, ...patch };
    saveCheckinLocal(todayStr(), next);
    onSave(next);
  }, [cycleDay, phaseKey, onSave]);

  function updateScore(key, val) {
    const next = { ...scores, [key]: val };
    setScores(next);
    autosave({ scores: next });
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "16px 14px 100px" }}>

      {/* ── COMPACT PHASE HEADER ── */}
      <div style={{ background: phase.bg, borderRadius: 18, padding: "16px 18px", marginBottom: 12, border: `1.5px solid ${phase.border}` }}>
        {/* Phase pill + day + countdown */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <span style={{ ...S.label, color: phase.color, background: "#fff", padding: "2px 10px", borderRadius: 20, border: `1px solid ${phase.border}` }}>{phase.name}</span>
          <T size={12} bold color="#2D2926">Cycle Day {cycleDay}</T>
          <T size={11} color="#B5ADA8" style={{ marginLeft: "auto" }}>{daysLeft} day{daysLeft !== 1 ? "s" : ""} to menstruation</T>
        </div>
        {/* Daily advice — 1-2 lines */}
        <div style={{ fontFamily: "'Cormorant', serif", fontSize: 17, color: "#2D2926", lineHeight: 1.4 }}>
          {home.advice[0]}
        </div>
      </div>

      {/* ── DAILY CHECK-IN ── */}
      <Block style={{ padding: "18px", marginBottom: 12 }}>
        <div style={{ fontFamily: "'Cormorant', serif", fontSize: 20, color: "#2D2926", marginBottom: 3 }}>Daily check-in</div>
        <T size={12} color="#9A918A" style={{ display: "block", marginBottom: 18 }}>Tap a label to log it. Tap "guide" for tips. Saves automatically.</T>

        {SCORECARD.map(item => {
          if (item.special === "vitamins") {
            return <VitaminsRow key={item.key} value={vitaminsVal} onChange={v => { setVitaminsVal(v); autosave({ vitaminsVal: v }); }} phaseKey={phaseKey} />;
          }
          if (item.special === "hormonal") {
            return <HormonalRow key={item.key} value={hormonalVal} onChange={v => { setHormonalVal(v); autosave({ hormonalVal: v }); }} phaseKey={phaseKey} cycleDay={cycleDay} />;
          }
          return (
            <ScoreRow key={item.key} item={item} value={scores[item.key] || 0}
              onChange={val => updateScore(item.key, val)} phaseKey={phaseKey} cycleDay={cycleDay} />
          );
        })}
      </Block>

      {/* ── SYMPTOMS ── */}
      <SymptomsBlock phaseKey={phaseKey} selected={symptoms}
        onChange={fn => { const next = fn(symptoms); setSymptoms(next); autosave({ symptoms: next }); }} />

      {/* ── OPEN NOTES ── */}
      <Block style={{ padding: "16px", marginBottom: 12 }}>
        <T size={13} bold color="#2D2926" style={{ display: "block", marginBottom: 8 }}>How are you, really?</T>
        <textarea placeholder="Anything you want to note about today — physical, mental, or otherwise."
          value={generalNote} onChange={e => { setGeneralNote(e.target.value); autosave({ generalNote: e.target.value }); }} rows={3}
          style={{ width: "100%", padding: "9px 11px", borderRadius: 9, border: "1.5px solid #EDE8E3", fontFamily: "'Nunito', sans-serif", fontSize: 13, color: "#2D2926", resize: "none", outline: "none", boxSizing: "border-box", lineHeight: 1.55, background: "#FDFAF7" }} />
      </Block>

      <Block style={{ padding: "16px", marginBottom: 24 }}>
        <T size={13} bold color="#2D2926" style={{ display: "block", marginBottom: 8 }}>What made today special?</T>
        <input placeholder="A moment, a win, something you noticed…"
          value={specialNote} onChange={e => { setSpecialNote(e.target.value); autosave({ specialNote: e.target.value }); }}
          style={{ width: "100%", padding: "9px 11px", borderRadius: 9, border: "1.5px solid #EDE8E3", fontFamily: "'Nunito', sans-serif", fontSize: 13, color: "#2D2926", outline: "none", boxSizing: "border-box", background: "#FDFAF7" }} />
      </Block>

      <T size={11} italic color="#C5BDB5" style={{ display: "block", textAlign: "center", marginBottom: 8 }}>Changes save automatically</T>
    </div>
  );
}

// ── CALENDAR — PHASE COLOURS ──────────────────────────────────────────────────
const CAL_PHASE = {
  menstrual:  { fill: "#F5E4E0", border: "#D9968C", dot: "#C4796A", label: "Menstrual",  desc: "Reset & lower energy" },
  follicular: { fill: "#EDF7F1", border: "#B8DEC9", dot: "#7DBFA0", label: "Follicular", desc: "Build & forward momentum" },
  ovulatory:  { fill: "#D8EED9", border: "#8DC47A", dot: "#5A9E4A", label: "Ovulatory",  desc: "Connection & outward energy" },
  luteal:     { fill: "#EAE6F3", border: "#B0A0CC", dot: "#7B6BA0", label: "Luteal",     desc: "Focus & inward shift" },
};

// Phase contextual sentences — calm, non-prescriptive
const PHASE_CONTEXT = {
  menstrual:  "Energy may feel quieter. A slower pace can feel more natural.",
  follicular: "Momentum may build gradually. Planning or starting can feel easier.",
  ovulatory:  "Communication and outward energy may feel more accessible.",
  luteal:     "Focus may shift inward. Leaving more space between commitments can help.",
};

// ── CALENDAR HISTORY STORE ────────────────────────────────────────────────────
// Stores multiple historical menstruation Day 1 dates
function getHistoryDates() {
  return lsGet("essensheal_day1_history") || [];
}
function saveHistoryDate(dateStr) {
  const existing = getHistoryDates();
  if (!existing.includes(dateStr)) {
    const updated = [...existing, dateStr].sort();
    lsSet("essensheal_day1_history", updated);
  }
}
function removeHistoryDate(dateStr) {
  const updated = getHistoryDates().filter(d => d !== dateStr);
  lsSet("essensheal_day1_history", updated);
}

// Build the effective cycle start date for a given day
// Use the most recent history entry on or before the day being calculated
function getEffectiveCycleStart(targetDateStr, profileCycleStart, historyDates) {
  const allStarts = [profileCycleStart, ...historyDates].sort();
  // Find the latest entry that is <= targetDateStr
  let best = profileCycleStart;
  for (const d of allStarts) {
    if (d <= targetDateStr) best = d;
  }
  return best;
}

// ── CALENDAR BOTTOM SHEET ─────────────────────────────────────────────────────
function CalendarBottomSheet({ info, isMarkedDay1, onClose, onMarkDay1, onRemoveDay1 }) {
  const cp = (info.phaseKey && CAL_PHASE[info.phaseKey]) || CAL_PHASE.follicular;
  const isNewMoon  = info.isNewMoon;
  const isFullMoon = info.isFullMoon;
  const isSpecialMoon = isNewMoon || isFullMoon;
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualDate, setManualDate] = useState(info.dateStr);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(35,30,28,0.28)",
          zIndex: 200,
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
        }}
      />

      {/* Sheet */}
      <div style={{
        position: "fixed", bottom: 0,
        left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 480,
        zIndex: 201,
        background: "#FDFCFB",
        borderRadius: "24px 24px 0 0",
        boxShadow: "0 -16px 60px rgba(0,0,0,0.10), 0 -2px 10px rgba(0,0,0,0.04)",
        animation: "sheetUp 0.28s cubic-bezier(0.34,1.05,0.64,1)",
        overflow: "hidden",
      }}>

        {/* Phase accent line */}
        <div style={{
          height: 3,
          background: `linear-gradient(90deg, ${cp.dot}30, ${cp.dot}cc, ${cp.dot}30)`,
        }} />

        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0" }}>
          <div style={{ width: 30, height: 3.5, borderRadius: 2, background: "#E8E2DE" }} />
        </div>

        <div style={{ padding: "14px 22px 32px" }}>

          {/* ── HEADER ── */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div style={{ flex: 1, paddingRight: 12 }}>
              {/* Full date */}
              <div style={{
                fontFamily: "'Cormorant', serif", fontSize: 21, fontWeight: 400,
                color: "#2D2926", lineHeight: 1.15, marginBottom: 7,
              }}>
                {new Date(info.dateStr + "T12:00:00").toLocaleDateString("en-GB", {
                  weekday: "long", day: "numeric", month: "long",
                })}
              </div>
              {/* Phase pill + cycle day */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{
                  fontFamily: "'Nunito', sans-serif", fontSize: 10, fontWeight: 700,
                  color: cp.dot, background: cp.fill,
                  border: `1px solid ${cp.border}`,
                  borderRadius: 20, padding: "3px 12px",
                  textTransform: "uppercase", letterSpacing: "0.09em",
                }}>{cp.label}</span>
                <span style={{
                  fontFamily: "'Nunito', sans-serif", fontSize: 12, color: "#9A8F86",
                }}>Cycle Day {info.cycleDay}</span>
              </div>
            </div>
            {/* Close */}
            <button onClick={onClose} style={{
              width: 30, height: 30, borderRadius: "50%",
              border: "1.5px solid #EDE8E3", background: "#F8F4F0",
              cursor: "pointer", display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 16, color: "#9A8F86",
              flexShrink: 0, marginTop: 2,
            }}>×</button>
          </div>

          {/* ── STATUS BADGE ── */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: info.isFuture ? "#F8F5F0"
              : info.hasCheckin ? "#EDF6F0"
              : "#F8F5F0",
            border: `1px solid ${info.isFuture ? "#EDE8E3"
              : info.hasCheckin ? "#AED8BC"
              : "#EDE8E3"}`,
            borderRadius: 20, padding: "4px 13px", marginBottom: 14,
          }}>
            <span style={{
              fontFamily: "'Nunito', sans-serif", fontSize: 11,
              fontStyle: "italic",
              color: info.isFuture ? "#B5ADA8"
                : info.hasCheckin ? "#4D9168"
                : "#B5ADA8",
            }}>
              {info.isFuture
                ? "Estimated based on your cycle length."
                : info.hasCheckin
                  ? "You completed a check-in here."
                  : "No check-in recorded for this day."}
            </span>
          </div>

          {/* ── DIVIDER ── */}
          <div style={{ height: 1, background: "#F0EBE6", marginBottom: 14 }} />

          {/* ── PHASE CONTEXT ── */}
          <p style={{
            fontFamily: "'Nunito', sans-serif", fontSize: 13,
            color: "#5A5048", lineHeight: 1.7, margin: "0 0 14px",
          }}>
            {PHASE_CONTEXT[info.phaseKey]}
          </p>

          {/* ── MOON CONTEXT (special days only) ── */}
          {isSpecialMoon && (
            <div style={{
              background: "#FDFAF4", border: "1px solid #EDE8DC",
              borderRadius: 13, padding: "11px 14px", marginBottom: 14,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 5 }}>
                <span style={{ fontSize: 17 }}>{info.lunar.emoji}</span>
                <span style={{
                  fontFamily: "'Nunito', sans-serif", fontSize: 12,
                  fontWeight: 600, color: "#5A5048",
                }}>
                  {isNewMoon
                    ? "New Moon — often associated with quieter reflection."
                    : "Full Moon — some people notice heightened awareness."}
                </span>
              </div>
              {isFullMoon && (
                <p style={{
                  fontFamily: "'Nunito', sans-serif", fontSize: 11,
                  color: "#9A8F86", margin: "0", lineHeight: 1.6,
                }}>
                  Some people notice appetite or cravings shift around full moon phases. This is educational context, not advice.
                </p>
              )}
            </div>
          )}

          {/* ── CHECK-IN SNAPSHOT (if logged) — show all details ── */}
          {info.hasCheckin && !info.isFuture && (
            <div style={{ marginBottom: 12 }}>
              {/* SCORECARD SCORES */}
              {info.log?.scores && Object.keys(info.log.scores).length > 0 && (() => {
                const SCORE_LABELS = {
                  nutrition: "Nutrition", movement: "Movement", sleep: "Sleep",
                  meditation: "Quiet Time", mood: "Mood", work: "Work / Focus",
                  social: "Social", relationships: "Relationship",
                  intimacy: "Intimacy", overall: "Overall"
                };
                const SCORE_OPTS = {
                  nutrition: ["Skipped","Unbalanced","Okay","Nourishing","Very balanced"],
                  movement:  ["None","Minimal","Gentle","Balanced","Heavy workout"],
                  sleep:     ["Very poor","Poor","Okay","Good","Very good"],
                  meditation:["Not at all","Brief pause","Short reset","Meaningful","Deep reset"],
                  mood:      ["Low","Unsettled","Neutral","Positive","Grounded"],
                  work:      ["Scattered","Hard to focus","Neutral","Clear","In flow"],
                  social:    ["Reserved","Low capacity","Selective","Engaged","Very social"],
                  relationships:["Tense","Disconnected","Neutral","Warm","Deeply connected"],
                  intimacy:  ["None","Low","Some","Strong","Very strong"],
                  overall:   ["Drained","Low energy","Balanced","Strong","Very good"],
                };
                const entries = Object.entries(info.log.scores).filter(([,v]) => v > 0);
                if (!entries.length) return null;
                return (
                  <div style={{ marginBottom: 10 }}>
                    <span style={{ fontFamily:"'Nunito', sans-serif", fontSize:10, fontWeight:700, color:"#B5ADA8", textTransform:"uppercase", letterSpacing:"0.09em", display:"block", marginBottom:6 }}>Check-in scores</span>
                    <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                      {entries.map(([key, val]) => (
                        <div key={key} style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                          <span style={{ fontFamily:"'Nunito', sans-serif", fontSize:12, color:"#7A706A" }}>{SCORE_LABELS[key] || key}</span>
                          <span style={{ fontFamily:"'Nunito', sans-serif", fontSize:12, fontWeight:600, color:cp.dot, background:cp.fill, borderRadius:10, padding:"1px 8px", border:`1px solid ${cp.border}` }}>
                            {SCORE_OPTS[key]?.[val - 1] || val}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* VITAMINS */}
              {info.log?.vitaminsVal?.taken && (
                <div style={{ marginBottom:8 }}>
                  <span style={{ fontFamily:"'Nunito', sans-serif", fontSize:10, fontWeight:700, color:"#B5ADA8", textTransform:"uppercase", letterSpacing:"0.09em", display:"block", marginBottom:4 }}>Vitamins</span>
                  <span style={{ fontFamily:"'Nunito', sans-serif", fontSize:12, color:"#7A706A" }}>
                    {info.log.vitaminsVal.taken}
                    {info.log.vitaminsVal.selected?.length > 0 && ` — ${info.log.vitaminsVal.selected.join(", ")}`}
                    {info.log.vitaminsVal.otherText && `, ${info.log.vitaminsVal.otherText}`}
                  </span>
                </div>
              )}

              {/* HORMONAL */}
              {info.log?.hormonalVal && Object.values(info.log.hormonalVal).some(v => v && v !== "°C" && v !== "°F") && (
                <div style={{ marginBottom:8 }}>
                  <span style={{ fontFamily:"'Nunito', sans-serif", fontSize:10, fontWeight:700, color:"#B5ADA8", textTransform:"uppercase", letterSpacing:"0.09em", display:"block", marginBottom:4 }}>Hormones / BBT</span>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                    {[
                      {k:"e3g",l:"E3G (ng/mL)"},{k:"pdg",l:"PdG (µg/mL)"},
                      {k:"lh",l:"LH (mIU/mL)"},{k:"fsh",l:"FSH (mIU/mL)"},
                      {k:"bbt",l:`BBT (${info.log.hormonalVal.bbtUnit || "°C"})`}
                    ].filter(f => info.log.hormonalVal[f.k]).map(f => (
                      <span key={f.k} style={{ fontFamily:"'Nunito', sans-serif", fontSize:11, color:cp.dot, background:cp.fill, border:`1px solid ${cp.border}`, borderRadius:10, padding:"2px 8px" }}>
                        {f.l}: {info.log.hormonalVal[f.k]}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* SYMPTOMS */}
              {info.log?.symptoms?.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <span style={{ fontFamily:"'Nunito', sans-serif", fontSize:10, fontWeight:700, color:"#B5ADA8", textTransform:"uppercase", letterSpacing:"0.09em", display:"block", marginBottom:5 }}>Symptoms</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {info.log.symptoms.map((s, i) => (
                      <span key={i} style={{ fontFamily: "'Nunito', sans-serif", fontSize: 10, fontWeight: 600, color: cp.dot, background: cp.fill, border: `1px solid ${cp.border}`, borderRadius: 20, padding: "2px 9px" }}>{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* NOTES */}
              {info.log?.generalNote && (
                <div style={{ marginBottom:6 }}>
                  <span style={{ fontFamily:"'Nunito', sans-serif", fontSize:10, fontWeight:700, color:"#B5ADA8", textTransform:"uppercase", letterSpacing:"0.09em", display:"block", marginBottom:3 }}>How you felt</span>
                  <p style={{ fontFamily: "'Nunito', sans-serif", fontSize: 12, color: "#7A706A", fontStyle: "italic", margin: 0 }}>"{info.log.generalNote}"</p>
                </div>
              )}
              {info.log?.specialNote && (
                <div>
                  <span style={{ fontFamily:"'Nunito', sans-serif", fontSize:10, fontWeight:700, color:"#B5ADA8", textTransform:"uppercase", letterSpacing:"0.09em", display:"block", marginBottom:3 }}>What made it special</span>
                  <p style={{ fontFamily: "'Nunito', sans-serif", fontSize: 12, color: "#7A706A", fontStyle: "italic", margin: 0 }}>"{info.log.specialNote}"</p>
                </div>
              )}
            </div>
          )}

          {/* ── MARK / REMOVE DAY 1 ── */}
          {isMarkedDay1 ? (
            <div>
              <div style={{
                display: "flex", alignItems: "center", gap: 8, marginBottom: 10,
                background: CAL_PHASE.menstrual.fill, borderRadius: 12,
                padding: "9px 14px", border: `1px solid ${CAL_PHASE.menstrual.border}`,
              }}>
                <span style={{ fontSize: 14 }}>🩸</span>
                <T size={12} bold color={CAL_PHASE.menstrual.dot}>Marked as Day 1 of menstruation</T>
              </div>
              <button
                onClick={() => onRemoveDay1(info.dateStr)}
                style={{
                  width: "100%", padding: "11px 16px", borderRadius: 14,
                  border: "1.5px solid #EDE8E3", background: "#F8F4F0",
                  color: "#9A8F86",
                  fontFamily: "'Nunito', sans-serif", fontWeight: 600, fontSize: 12,
                  cursor: "pointer",
                }}>
                Remove Day 1 marker
              </button>
            </div>
          ) : !showManualEntry ? (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => { saveHistoryDate(info.dateStr); onMarkDay1(info.dateStr); }}
                style={{
                  flex: 1, padding: "12px 16px", borderRadius: 14,
                  border: `1.5px solid ${cp.border}`,
                  background: cp.fill, color: cp.dot,
                  fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 12,
                  cursor: "pointer",
                }}>
                Mark as Day 1
              </button>
              <button
                onClick={() => setShowManualEntry(true)}
                style={{
                  padding: "12px 14px", borderRadius: 14,
                  border: "1.5px solid #EDE8E3", background: "#F8F4F0",
                  color: "#9A8F86",
                  fontFamily: "'Nunito', sans-serif", fontWeight: 600, fontSize: 12,
                  cursor: "pointer", whiteSpace: "nowrap",
                }}>
                Enter date
              </button>
            </div>
          ) : (
            <div>
              <p style={{
                fontFamily: "'Nunito', sans-serif", fontSize: 12,
                color: "#9A8F86", margin: "0 0 8px",
              }}>Enter first day of menstruation:</p>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="date"
                  value={manualDate}
                  onChange={e => setManualDate(e.target.value)}
                  style={{
                    flex: 1, padding: "10px 12px", borderRadius: 12,
                    border: "1.5px solid #EDE8E3",
                    fontFamily: "'Nunito', sans-serif", fontSize: 13,
                    color: "#2D2926", outline: "none",
                    background: "#FDFAF7", boxSizing: "border-box",
                  }}
                />
                <button
                  onClick={() => { saveHistoryDate(manualDate); onMarkDay1(manualDate); }}
                  style={{
                    padding: "10px 16px", borderRadius: 12,
                    border: `1.5px solid ${cp.border}`,
                    background: cp.dot, color: "#fff",
                    fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 12,
                    cursor: "pointer",
                  }}>Set</button>
                <button
                  onClick={() => setShowManualEntry(false)}
                  style={{
                    padding: "10px 12px", borderRadius: 12,
                    border: "1.5px solid #EDE8E3", background: "#F8F4F0",
                    color: "#9A8F86",
                    fontFamily: "'Nunito', sans-serif", fontSize: 12, cursor: "pointer",
                  }}>×</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes sheetUp {
          from { transform: translateX(-50%) translateY(100%); }
          to   { transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </>
  );
}

// ── CALENDAR TAB ──────────────────────────────────────────────────────────────
function CalendarTab({ profile, logs, onSaveProfile }) {
  const TODAY = fmtDate(new Date());
  const [viewMonth, setViewMonth] = useState(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay]   = useState(null);
  const [localProfile, setLocalProfile] = useState(profile);
  // History of Day 1 entries (allows retroactive corrections)
  const [historyDates, setHistoryDates] = useState(() => getHistoryDates());

  useEffect(() => { setLocalProfile(profile); }, [profile]);

  const yr = viewMonth.getFullYear();
  const mo = viewMonth.getMonth();
  const daysInMonth  = new Date(yr, mo + 1, 0).getDate();
  const firstWeekday = (new Date(yr, mo, 1).getDay() + 6) % 7; // Mon=0

  // "Confirmed month" = month containing a manually-marked Day 1 → solid fill
  // All other months → dashed prediction style
  const confirmedMonths = new Set(
    [...historyDates, localProfile.cycleStartDate]
      .filter(Boolean)
      .map(d => d.slice(0, 7))
  );
  const isConfirmedMonth = confirmedMonths.has(
    `${yr}-${String(mo + 1).padStart(2, "0")}`
  );

  // Build a single day's full info object
  // phaseKey is null when required inputs are missing → shows white circle (safe fallback)
  function buildDay(n) {
    const d       = new Date(yr, mo, n);
    const dateStr = fmtDate(d);
    const isFuture = dateStr > TODAY;
    const isToday  = dateStr === TODAY;

    const csl = localProfile.cycleLength  || 28;
    const pl  = localProfile.periodLength || 5;
    const csd = localProfile.cycleStartDate;

    // Use history-aware effective start date
    const effectiveStart = csd
      ? getEffectiveCycleStart(dateStr, csd, historyDates)
      : null;

    // ── PHASE PER DATE (called inside this map, not outside) ──
    const cycleDay = effectiveStart
      ? getCycleDay(effectiveStart, csl, d)
      : null;

    // phaseForDate returns null if cycleStartDate is missing → white circle fallback
    const phaseKey = (effectiveStart && cycleDay !== null)
      ? getPhaseKey(cycleDay, csl, pl)
      : null;

    const checkins = lsGet("essensheal_checkins") || {};
    const log      = logs.find(l => l.date === dateStr) || checkins[dateStr] || null;
    const lunar    = getLunarPhase(d);

    return {
      n, d, dateStr, isFuture, isToday,
      cycleDay, phaseKey,
      log, hasCheckin: !!log,
      lunar,
      isNewMoon:  lunar.phase === "New Moon",
      isFullMoon: lunar.phase === "Full Moon",
    };
  }

  function handleMarkDay1(dateStr) {
    const updated = { ...localProfile, cycleStartDate: dateStr };
    setLocalProfile(updated);
    const newHistory = [...new Set([...historyDates, dateStr])].sort();
    setHistoryDates(newHistory);
    lsSet("essensheal_day1_history", newHistory);
    if (onSaveProfile) onSaveProfile(updated);
    setSelectedDay(null);
  }

  function handleRemoveDay1(dateStr) {
    const newHistory = historyDates.filter(d => d !== dateStr);
    removeHistoryDate(dateStr);
    setHistoryDates(newHistory);
    // Pick the most recent remaining date as the new cycleStartDate
    // (prefer the one closest to today but still in the past)
    const today = fmtDate(new Date());
    const allRemaining = [
      localProfile.cycleStartDate === dateStr ? null : localProfile.cycleStartDate,
      ...newHistory
    ].filter(Boolean);
    const pastDates = allRemaining.filter(d => d <= today).sort();
    const newStart = pastDates[pastDates.length - 1] || allRemaining.sort()[0] || dateStr;
    const updated = { ...localProfile, cycleStartDate: newStart };
    setLocalProfile(updated);
    if (onSaveProfile) onSaveProfile(updated);
    setSelectedDay(null);
  }

  const days = Array.from({ length: daysInMonth }, (_, i) => buildDay(i + 1));

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "16px 16px 120px" }}>

      {/* ── MONTH NAV ── */}
      <div style={{
        display: "flex", alignItems: "center",
        justifyContent: "space-between", marginBottom: 20,
      }}>
        <button
          onClick={() => { setViewMonth(new Date(yr, mo - 1, 1)); setSelectedDay(null); }}
          style={{
            width: 36, height: 36, borderRadius: "50%",
            border: "1.5px solid #EDE8E3", background: "#fff",
            cursor: "pointer", fontSize: 17, color: "#8A7F78",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>‹</button>

        <span style={{
          fontFamily: "'Cormorant', serif", fontSize: 22,
          fontWeight: 300, color: "#2D2926",
        }}>
          {viewMonth.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
        </span>

        <button
          onClick={() => { setViewMonth(new Date(yr, mo + 1, 1)); setSelectedDay(null); }}
          style={{
            width: 36, height: 36, borderRadius: "50%",
            border: "1.5px solid #EDE8E3", background: "#fff",
            cursor: "pointer", fontSize: 17, color: "#8A7F78",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>›</button>
      </div>

      {/* ── WEEKDAY HEADERS ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 8 }}>
        {["Mo","Tu","We","Th","Fr","Sa","Su"].map((d, i) => (
          <div key={i} style={{
            textAlign: "center",
            fontFamily: "'Nunito', sans-serif", fontSize: 9, fontWeight: 700,
            color: "#CCC4BE", letterSpacing: "0.09em", textTransform: "uppercase",
            paddingBottom: 6,
          }}>{d}</div>
        ))}
      </div>

      {/* ── DAY GRID ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(7, 1fr)",
        gap: "5px 4px",
      }}>
        {/* Empty leading slots */}
        {Array.from({ length: firstWeekday }, (_, i) => (
          <div key={`gap-${i}`} />
        ))}

        {/* Day cells */}
        {days.map(day => {
          // phaseKey is null when cycleStartDate is missing → white circle fallback
          const cp = day.phaseKey ? CAL_PHASE[day.phaseKey] : null;
          const isSelected = selectedDay?.dateStr === day.dateStr;
          const isSpecialMoon = day.isNewMoon || day.isFullMoon;

          // ── Cell styling logic ──
          // No phase data: white, no fill, dashed neutral border
          // Past/today confirmed: phase fill, solid border matching phase
          // Future predicted: white fill, dashed border matching predicted phase colour
          // Confirmed month (has a manually-marked Day 1) → solid phase fill
          // All other months → white bg + dashed border (prediction style)
          const isPredicted = !isConfirmedMonth;
          const cellBg = (!cp || isPredicted) ? "#FFFFFF" : cp.fill;

          let cellBorder;
          if (!cp) {
            cellBorder = isSelected ? "2px solid #C8C0BA" : "1.5px dashed #E0DBD6";
          } else if (isSelected) {
            cellBorder = `2.5px solid ${cp.dot}`;
          } else if (day.isToday) {
            cellBorder = `2.5px solid ${cp.dot}`;
          } else if (isPredicted) {
            cellBorder = `1.5px dashed ${cp.border}`;
          } else {
            cellBorder = "1.5px solid transparent";
          }

          const numColor = day.isToday
            ? (cp ? cp.dot : "#C4796A")
            : isPredicted ? "#BFBAB5"
            : "#2D2926";

          return (
            <button
              key={day.dateStr}
              onClick={() => setSelectedDay(isSelected ? null : day)}
              style={{
                position: "relative",
                aspectRatio: "1 / 1",
                borderRadius: "50%",
                border: cellBorder,
                background: cellBg,
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
                outline: "none",
                overflow: "hidden",
                transition: "box-shadow 0.12s",
                boxShadow: isSelected
                  ? `0 0 0 3.5px ${cp ? cp.dot : "#C4796A"}22`
                  : day.isToday
                    ? `0 0 0 2px ${cp ? cp.dot : "#C4796A"}18`
                    : "none",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              {/* Day number */}
              <span style={{
                fontFamily: "'Nunito', sans-serif",
                fontSize: 12, fontWeight: day.isToday ? 700 : 400,
                color: numColor, lineHeight: 1,
                zIndex: 1,
              }}>{day.n}</span>

              {/* Predicted: small phase-coloured inner dot (prediction signal) */}
              {isPredicted && cp && (
                <div style={{
                  width: 4, height: 4, borderRadius: "50%",
                  background: cp.dot, opacity: 0.35,
                  marginTop: 2, zIndex: 1,
                }} />
              )}

              {/* ✓ check-in marker — top-center, between number and top border */}
              {day.hasCheckin && cp && (
                <span style={{
                  position: "absolute",
                  top: "8%",
                  left: "50%", transform: "translateX(-50%)",
                  fontFamily: "'Nunito', sans-serif",
                  fontSize: 11, fontWeight: 900,
                  color: cp.dot, lineHeight: 1,
                  opacity: 1,
                }}>✓</span>
              )}

              {/* Moon icon — bottom-center between number and bottom border, 2x bigger */}
              {isSpecialMoon && (
                <span style={{
                  position: "absolute",
                  bottom: "8%",
                  left: "50%", transform: "translateX(-50%)",
                  fontSize: 10, lineHeight: 1,
                  color: day.isFullMoon ? "#1A1A1A" : undefined,
                  opacity: isPredicted ? 0.4 : 0.75,
                }}>{day.isFullMoon ? "●" : day.lunar.emoji}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── LEGEND ── */}
      <div style={{
        marginTop: 24,
        background: "#FFFFFF",
        borderRadius: 18, border: "1.5px solid #F0EBE6",
        padding: "16px 18px",
      }}>
        <span style={{
          fontFamily: "'Nunito', sans-serif", fontSize: 9, fontWeight: 700,
          color: "#C8C0BA", textTransform: "uppercase", letterSpacing: "0.13em",
          display: "block", marginBottom: 14,
        }}>Reading this calendar</span>

        {/* Phase swatches */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
          {Object.entries(CAL_PHASE).map(([key, cp]) => (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                background: cp.fill, border: `1.5px solid ${cp.border}`,
              }} />
              <div style={{ lineHeight: 1.4 }}>
                <span style={{
                  fontFamily: "'Nunito', sans-serif",
                  fontSize: 12, fontWeight: 700, color: "#2D2926",
                }}>{cp.label}</span>
                <span style={{
                  fontFamily: "'Nunito', sans-serif",
                  fontSize: 12, color: "#9A8F86",
                }}> — {cp.desc}</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ height: 1, background: "#F0EBE6", marginBottom: 12 }} />

        {/* Other indicators */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

          {/* Future / predicted */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
              background: "#fff",
              border: `1.5px dashed ${CAL_PHASE.menstrual.border}80`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <div style={{ width: 4, height: 4, borderRadius: "50%", background: CAL_PHASE.menstrual.dot, opacity: 0.4 }} />
            </div>
            <span style={{ fontFamily: "'Nunito', sans-serif", fontSize: 12, color: "#9A8F86" }}>
              Estimated — based on your cycle length
            </span>
          </div>

          {/* Check-in */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
              background: CAL_PHASE.follicular.fill,
              border: `1.5px solid ${CAL_PHASE.follicular.border}`,
              position: "relative",
            }}>
              <span style={{ position: "absolute", top: "8%", left: "50%", transform: "translateX(-50%)", fontSize: 11, fontWeight: 900, color: CAL_PHASE.follicular.dot }}>✓</span>
            </div>
            <span style={{ fontFamily: "'Nunito', sans-serif", fontSize: 12, color: "#9A8F86" }}>
              Daily check-in completed
            </span>
          </div>


          {/* New Moon */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
              background: "#FDFAF5", border: "1.5px solid #EDE8DC",
              display: "flex", alignItems: "flex-end",
              justifyContent: "center", paddingBottom: 4,
            }}>
              <span style={{ fontSize: 10 }}>🌙</span>
            </div>
            <span style={{ fontFamily: "'Nunito', sans-serif", fontSize: 12, color: "#9A8F86" }}>
              New Moon
            </span>
          </div>

          {/* Full Moon */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
              background: "#FDFAF5", border: "1.5px solid #EDE8DC",
              display: "flex", alignItems: "flex-end",
              justifyContent: "center", paddingBottom: 4,
            }}>
              <span style={{ fontSize: 10, color: "#1A1A1A", lineHeight: 1 }}>●</span>
            </div>
            <span style={{ fontFamily: "'Nunito', sans-serif", fontSize: 12, color: "#9A8F86" }}>
              Full Moon
            </span>
          </div>
        </div>

        {/* Footer note */}
        <p style={{ fontFamily: "'Nunito', sans-serif", fontSize: 11, color: "#C5BDB5", fontStyle: "italic", margin: "14px 0 4px", lineHeight: 1.6 }}>
          Tap any day to see phase details and check-in status.
        </p>
        <p style={{ fontFamily: "'Nunito', sans-serif", fontSize: 11, color: "#C5BDB5", fontStyle: "italic", margin: 0, lineHeight: 1.6 }}>
          Tap "Mark as Day 1 of menstruation" to correct your cycle start.
        </p>
      </div>

      {/* ── BOTTOM SHEET ── */}
      {selectedDay && (
        <CalendarBottomSheet
          info={selectedDay}
          isMarkedDay1={historyDates.includes(selectedDay.dateStr) || localProfile.cycleStartDate === selectedDay.dateStr}
          onClose={() => setSelectedDay(null)}
          onMarkDay1={handleMarkDay1}
          onRemoveDay1={handleRemoveDay1}
        />
      )}
    </div>
  );
}
// ── INSIGHTS TAB ──────────────────────────────────────────────────────────────
function InsightsTab() {
  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "16px 14px 100px" }}>
      <div style={{ fontFamily: "'Cormorant', serif", fontSize: 24, color: "#2D2926", marginBottom: 4 }}>Insights</div>
      <div style={{
        marginTop: 48, display: "flex", flexDirection: "column",
        alignItems: "center", gap: 10, padding: "0 24px",
      }}>
        <span style={{ fontSize: 32, opacity: 0.35 }}>✦</span>
        <div style={{ fontFamily: "'Cormorant', serif", fontSize: 20, color: "#2D2926", textAlign: "center", lineHeight: 1.4 }}>
          Your patterns are forming
        </div>
        <T size={13} color="#9A8F86" style={{ textAlign: "center", lineHeight: 1.7, display: "block" }}>
          Check in for a few more days and your personal insights will appear here.
        </T>
      </div>
    </div>
  );
}


// ── SETTINGS TAB ──────────────────────────────────────────────────────────────
function SettingsTab({ profile, onSave, onReset }) {
  const [profileName, setProfileName] = useState(profile.name || "");
  const [startDate, setStartDate] = useState(profile.cycleStartDate);
  const [cycleLength, setCycleLength] = useState(Math.min(profile.cycleLength || 28, 35));
  const [periodLength, setPeriodLength] = useState(profile.periodLength || 5);
  const [confirm, setConfirm] = useState(false);
  const [saved, setSaved] = useState(false);

  const previewDay = getCycleDay(startDate, cycleLength);
  const previewPhase = PHASES[getPhaseKey(previewDay, cycleLength, periodLength)];

  const handleSave = () => { onSave({ name: profileName.trim(), cycleStartDate: startDate, cycleLength, periodLength }); setSaved(true); setTimeout(() => setSaved(false), 2000); };

  return (
    <div style={{ maxWidth:480, margin:"0 auto", padding:"16px 14px 100px" }}>
      <div style={{ fontFamily:"'Cormorant', serif", fontSize:24, color:"#2D2926", marginBottom:20 }}>Settings</div>

      <Block style={{ padding:"18px", marginBottom:14 }}>
        <T size={11} bold color="#B5ADA8" style={{ display:"block", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:16 }}>Your cycle</T>
        <div style={{ marginBottom:16 }}>
          <T size={12} bold color="#7A706A" style={{ display:"block", marginBottom:7 }}>Your name</T>
          <input type="text" value={profileName} onChange={e => { setProfileName(e.target.value); setSaved(false); }}
            placeholder="How should we greet you?"
            style={{ width:"100%", padding:"10px 12px", borderRadius:10, border:"1.5px solid #EDE8E3", fontFamily:"'Nunito', sans-serif", fontSize:14, color:"#2D2926", outline:"none", background:"#FAFAF9", boxSizing:"border-box" }} />
        </div>
        <div style={{ marginBottom:16 }}>
          <T size={12} bold color="#7A706A" style={{ display:"block", marginBottom:7 }}>First day of your last period</T>
          <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setSaved(false); }}
            style={{ width:"100%", padding:"10px 12px", borderRadius:10, border:"1.5px solid #EDE8E3", fontFamily:"'Nunito', sans-serif", fontSize:14, color:"#2D2926", outline:"none", background:"#FAFAF9", boxSizing:"border-box" }} />
        </div>
        <div style={{ marginBottom:20 }}>
          <T size={12} bold color="#7A706A" style={{ display:"block", marginBottom:7 }}>Cycle length: <span style={{ color:"#C4796A" }}>{cycleLength}{cycleLength === 35 ? "+" : ""} days</span></T>
          <div style={{ position:"relative", height:28, display:"flex", alignItems:"center" }}>
            <div style={{ position:"absolute", left:0, right:0, height:4, borderRadius:2, background:"#F0EDE8" }} />
            <div style={{ position:"absolute", left:0, height:4, borderRadius:2, background:"#C4796A", width:`${((cycleLength-21)/(35-21))*100}%` }} />
            <input type="range" min={21} max={35} value={cycleLength}
              onChange={e => { setCycleLength(+e.target.value); setSaved(false); }}
              style={{ width:"100%", position:"relative", zIndex:1, accentColor:"#C4796A", cursor:"pointer", appearance:"none", WebkitAppearance:"none", background:"transparent", height:28, margin:0 }} />
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:2 }}>
            <T size={10} color="#C5BDB5">21 days</T>
            <T size={10} color="#C5BDB5">35+ days</T>
          </div>
        </div>
        <div style={{ marginBottom:20 }}>
          <T size={12} bold color="#7A706A" style={{ display:"block", marginBottom:7 }}>Period length: <span style={{ color:"#C4796A" }}>{periodLength} days</span></T>
          <div style={{ position:"relative", height:28, display:"flex", alignItems:"center" }}>
            <div style={{ position:"absolute", left:0, right:0, height:4, borderRadius:2, background:"#F0EDE8" }} />
            <div style={{ position:"absolute", left:0, height:4, borderRadius:2, background:"#C4796A", width:`${((periodLength-2)/(8-2))*100}%` }} />
            <input type="range" min={2} max={8} value={periodLength}
              onChange={e => { setPeriodLength(+e.target.value); setSaved(false); }}
              style={{ width:"100%", position:"relative", zIndex:1, accentColor:"#C4796A", cursor:"pointer", appearance:"none", WebkitAppearance:"none", background:"transparent", height:28, margin:0 }} />
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:2 }}>
            <T size={10} color="#C5BDB5">2 days</T>
            <T size={10} color="#C5BDB5">8 days</T>
          </div>
        </div>
        <div style={{ background:previewPhase.soft, borderRadius:10, padding:"10px 12px", border:`1px solid ${previewPhase.border}`, marginBottom:16 }}>
          <T size={12} color="#5A5048">Based on data entered, today is <strong style={{ color:previewPhase.color }}>Day {previewDay} of the cycle — {previewPhase.name} phase</strong>.</T>
        </div>
        <button onClick={handleSave}
          style={{ width:"100%", padding:"12px", borderRadius:11, border:"none", background:saved ? "#5A9E80" : "#C4796A", color:"#fff", fontFamily:"'Nunito', sans-serif", fontWeight:700, fontSize:13, cursor:"pointer", transition:"background 0.2s" }}>
          {saved ? "✓ Saved" : "Save changes"}
        </button>
      </Block>

      <Block style={{ padding:"18px", marginBottom:14 }}>
        <T size={11} bold color="#B5ADA8" style={{ display:"block", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:10 }}>Privacy</T>
        <T size={12} color="#7A706A" style={{ display:"block", marginBottom:14 }}>All data stays on this device. Nothing is transmitted.</T>
        {!confirm ? (
          <button onClick={() => setConfirm(true)} style={{ padding:"8px 15px", borderRadius:9, border:"1.5px solid #F5C4B5", background:"transparent", color:"#C4796A", fontFamily:"'Nunito', sans-serif", fontSize:12, fontWeight:600, cursor:"pointer" }}>Reset all data</button>
        ) : (
          <div style={{ background:"#FFF8F6", borderRadius:10, padding:13, border:"1px solid #F5C4B5" }}>
            <T size={12} color="#5A5048" style={{ display:"block", marginBottom:12 }}>This will permanently delete all check-ins and reset your profile.</T>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={() => { onReset(); setConfirm(false); }} style={{ padding:"7px 14px", borderRadius:8, border:"none", background:"#C4796A", color:"#fff", fontFamily:"'Nunito', sans-serif", fontSize:12, fontWeight:700, cursor:"pointer" }}>Yes, reset</button>
              <button onClick={() => setConfirm(false)} style={{ padding:"7px 14px", borderRadius:8, border:"1.5px solid #EDE8E3", background:"#fff", color:"#9A918A", fontFamily:"'Nunito', sans-serif", fontSize:12, cursor:"pointer" }}>Cancel</button>
            </div>
          </div>
        )}
      </Block>

      <Block style={{ padding:"18px" }}>
        <T size={11} bold color="#B5ADA8" style={{ display:"block", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:10 }}>Account</T>
        <T size={12} color="#7A706A" style={{ display:"block", marginBottom:14 }}>Sign out and return to the welcome screen.</T>
        <button onClick={() => onReset()} style={{ padding:"8px 15px", borderRadius:9, border:"1.5px solid #C8BCDF", background:"transparent", color:"#7B6BA0", fontFamily:"'Nunito', sans-serif", fontSize:12, fontWeight:600, cursor:"pointer" }}>Sign out</button>
      </Block>
    </div>
  );
}

// ── SETUP SCREEN ──────────────────────────────────────────────────────────────
const SHEET_URL = "https://script.google.com/macros/s/AKfycbz8CuLPWhlnIRoJAcNRPRSpc7QFsq9u3S1al6Q-uvW8t5blJAeF0zJTjcJgFm6HzvbLIA/exec";

function SetupScreen({ onSave }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [date, setDate] = useState(fmtDate(new Date()));
  const [length, setLength] = useState(28);
  const [periodLength, setPeriodLength] = useState(5);
  const previewDay = getCycleDay(date, length);
  const previewPhase = PHASES[getPhaseKey(previewDay, length, periodLength)];

  function handleBegin() {
    // Fire-and-forget to Google Sheet — don't block the user
    if (email.trim()) {
      fetch(SHEET_URL, {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      }).catch(() => {}); // silently ignore errors
    }
    onSave({ name: name.trim(), cycleStartDate: date, cycleLength: length, periodLength });
  }

  return (
    <div style={{ minHeight:"100vh", background:"#FDFAF7", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ maxWidth:380, width:"100%" }}>
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ fontFamily:"'Cormorant', serif", fontSize:40, fontStyle:"normal", fontWeight:300, color:"#2D2926", marginBottom:8 }}>EssenSHEal</div>
          <T size={14} color="#7A706A" style={{ display:"block" }}>Your personal operating system for life.</T>
        </div>
        <div style={{ background:"#fff", borderRadius:20, padding:"26px", border:"1.5px solid #F0EDE8", boxShadow:"0 6px 24px rgba(0,0,0,0.06)" }}>
          <div style={{ marginBottom:18 }}>
            <T size={12} bold color="#9A918A" style={{ display:"block", textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:8 }}>Your name</T>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="How should we greet you?"
              style={{ width:"100%", padding:"11px 13px", borderRadius:11, border:"1.5px solid #EDE8E3", fontFamily:"'Nunito', sans-serif", fontSize:15, color:"#2D2926", outline:"none", background:"#FAFAF9", boxSizing:"border-box" }} />
          </div>
          <div style={{ marginBottom:18 }}>
            <T size={12} bold color="#9A918A" style={{ display:"block", textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:8 }}>
              Email <span style={{ color:"#C5BDB5", fontWeight:400, textTransform:"none", letterSpacing:0 }}>(optional)</span>
            </T>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="To stay in touch"
              style={{ width:"100%", padding:"11px 13px", borderRadius:11, border:"1.5px solid #EDE8E3", fontFamily:"'Nunito', sans-serif", fontSize:15, color:"#2D2926", outline:"none", background:"#FAFAF9", boxSizing:"border-box" }} />
          </div>
          <div style={{ marginBottom:18 }}>
            <T size={12} bold color="#9A918A" style={{ display:"block", textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:8 }}>First day of your last period</T>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              style={{ width:"100%", padding:"11px 13px", borderRadius:11, border:"1.5px solid #EDE8E3", fontFamily:"'Nunito', sans-serif", fontSize:15, color:"#2D2926", outline:"none", background:"#FAFAF9", boxSizing:"border-box" }} />
          </div>
          <div style={{ marginBottom:18 }}>
            <T size={12} bold color="#9A918A" style={{ display:"block", textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:8 }}>Cycle length: <span style={{ color:"#C4796A" }}>{length} days</span></T>
            <input type="range" min={21} max={35} value={length} onChange={e => setLength(+e.target.value)} style={{ width:"100%", accentColor:"#C4796A" }} />
            <div style={{ display:"flex", justifyContent:"space-between", marginTop:3 }}>
              <T size={10} color="#C5BDB5">21</T><T size={10} color="#C5BDB5">35</T>
            </div>
          </div>
          <div style={{ marginBottom:18 }}>
            <T size={12} bold color="#9A918A" style={{ display:"block", textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:8 }}>Period length: <span style={{ color:"#C4796A" }}>{periodLength} days</span></T>
            <input type="range" min={2} max={8} value={periodLength} onChange={e => setPeriodLength(+e.target.value)} style={{ width:"100%", accentColor:"#C4796A" }} />
            <div style={{ display:"flex", justifyContent:"space-between", marginTop:3 }}>
              <T size={10} color="#C5BDB5">2</T><T size={10} color="#C5BDB5">8</T>
            </div>
          </div>
          <div style={{ background:previewPhase.soft, borderRadius:10, padding:"10px 12px", border:`1px solid ${previewPhase.border}`, marginBottom:20 }}>
            <T size={11} color="#5A5048" style={{ lineHeight:1.6 }}>With these settings, today is <strong style={{ color:previewPhase.color }}>{previewPhase.name} phase</strong> (day {previewDay}).</T>
          </div>
          <button onClick={handleBegin}
            style={{ width:"100%", padding:"13px", borderRadius:11, border:"none", background:"#C4796A", color:"#fff", fontFamily:"'Nunito', sans-serif", fontWeight:700, fontSize:14, cursor:"pointer" }}>
            Begin
          </button>
        </div>
        <T size={11} italic color="#B5ADA8" style={{ display:"block", textAlign:"center", marginTop:14 }}>All data stays on your device.</T>
      </div>
    </div>
  );
}

// ── BOTTOM NAV ────────────────────────────────────────────────────────────────
function BottomNav({ tab, onChange }) {
  const items = [
    { id: "home",     label: "Home",     icon: "🏠" },
    { id: "today",    label: "Today",    icon: "🌸" },
    { id: "calendar", label: "Calendar", icon: "📅" },
    { id: "insights", label: "Insights", icon: "✨" },
    { id: "settings", label: "Settings", icon: "⚙️" },
  ];
  return (
    <div style={{ position:"fixed", bottom:0, left:0, right:0, background:"#fff", borderTop:"1px solid #F0EDE8", display:"flex", padding:"7px 0 14px", zIndex:100, boxShadow:"0 -2px 14px rgba(0,0,0,0.05)" }}>
      {items.map(i => (
        <button key={i.id} onClick={() => { onChange(i.id); window.scrollTo({ top: 0, behavior: "instant" }); }} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3, padding:"4px 0", background:"none", border:"none", cursor:"pointer" }}>
          <span style={{ fontSize:18, filter:tab===i.id ? "none" : "grayscale(0.6) opacity(0.4)", transition:"filter 0.2s" }}>{i.icon}</span>
          <T size={9} bold={tab===i.id} color={tab===i.id ? "#C4796A" : "#B5ADA8"} style={{ textTransform:"uppercase", letterSpacing:"0.06em" }}>{i.label}</T>
        </button>
      ))}
    </div>
  );
}

// ── ROOT ──────────────────────────────────────────────────────────────────────
export default function AppClient() {
  const [tab, setTab] = useState("home");
  const [profile, setProfile] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const p = await store.get("essh-profile");
      if (p) setProfile(p);
      const keys = await store.list("essh-log-");
      const loaded = [];
      for (const k of keys) { const l = await store.get(k); if (l) loaded.push(l); }
      setLogs(loaded.sort((a,b) => a.date.localeCompare(b.date)));
      setLoading(false);
    })();
  }, []);

  const handleSaveProfile = useCallback(async p => { setProfile(p); await store.set("essh-profile", p); }, []);

  const handleSaveLog = useCallback(async log => {
    await store.set(`essh-log-${log.date}`, log);
    setLogs(prev => {
      const idx = prev.findIndex(l => l.date === log.date);
      const updated = idx >= 0 ? [...prev.slice(0,idx), log, ...prev.slice(idx+1)] : [...prev, log];
      return updated.sort((a,b) => a.date.localeCompare(b.date));
    });
  }, []);

  const handleReset = useCallback(async () => {
    await store.del("essh-profile");
    const keys = await store.list("essh-log-");
    for (const k of keys) await store.del(k);
    lsDel("essensheal_checkins");
    setProfile(null); setLogs([]);
  }, []);

  return (
    <div style={{ minHeight:"100vh", background:"#FDFAF7" }}>
      <FontLoader />
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #FDFAF7; -webkit-font-smoothing: antialiased; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:translateY(0); } }
        button:active { transform: scale(0.97) !important; }
        textarea, input { -webkit-appearance: none; }
        a { -webkit-tap-highlight-color: transparent; }

        /* ── Range slider reset — works across Chrome, Safari, Firefox ── */
        input[type=range] {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          cursor: pointer;
          width: 100%;
        }
        input[type=range]::-webkit-slider-runnable-track {
          height: 4px;
          background: #F0EDE8;
          border-radius: 2px;
        }
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #C4796A;
          border: 2.5px solid #fff;
          box-shadow: 0 1px 4px rgba(0,0,0,0.18);
          margin-top: -9px;
        }
        input[type=range]::-moz-range-track {
          height: 4px;
          background: #F0EDE8;
          border-radius: 2px;
          border: none;
        }
        input[type=range]::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #C4796A;
          border: 2.5px solid #fff;
          box-shadow: 0 1px 4px rgba(0,0,0,0.18);
        }
      `}</style>

      {loading ? (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh" }}>
          <div style={{ fontFamily:"'Cormorant', serif", fontSize:34, fontWeight:300, color:"#2D2926" }}>EssenSHEal</div>
        </div>
      ) : !profile ? (
        <SetupScreen onSave={handleSaveProfile} />
      ) : (
        <>
          {tab !== "home" && (
            <div style={{ background:"#fff", borderBottom:"1px solid #F5F0EB", padding:"12px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:50 }}>
              <div style={{ fontFamily:"'Cormorant', serif", fontSize:22, fontWeight:300, color:"#2D2926" }}>EssenSHEal</div>
              <T size={11} color="#B5ADA8">{new Date().toLocaleDateString("en-GB", { weekday:"long", day:"numeric", month:"long" })}</T>
            </div>
          )}
          <div key={tab} style={{ animation:"fadeUp 0.2s ease" }}>
            {tab === "home"     && <HomeTab     profile={profile} onNavigate={setTab} />}
            {tab === "today"    && <TodayTab    profile={profile} logs={logs} onSave={handleSaveLog} />}
            {tab === "calendar" && <CalendarTab profile={profile} logs={logs} onSaveProfile={handleSaveProfile} />}
            {tab === "insights" && <InsightsTab />}
            {tab === "settings" && <SettingsTab profile={profile} onSave={handleSaveProfile} onReset={handleReset} />}
          </div>
          <BottomNav tab={tab} onChange={setTab} />
        </>
      )}
    </div>
  );
}
