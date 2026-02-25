// lib/auth.ts
// ─────────────────────────────────────────────────────────────────
// Lightweight localStorage auth helper — MVP only, no backend.
// ─────────────────────────────────────────────────────────────────

export const AUTH_KEY     = "essensheal_authed";
export const EMAIL_KEY    = "essensheal_email";
export const PROFILE_KEY  = "essensheal_profile";
export const USERS_KEY    = "essensheal_users";

// Hard-coded test user
const TEST_USER = {
  email: "test@essensheal.com",
  password: "password123",
};

// ── Types ──────────────────────────────────────────────────────
export interface StoredUser {
  email: string;
  password: string;
}

export interface Profile {
  name?: string;
  country?: string;
  ageRange?: string;
  lastPeriodStart: string;   // ISO date string (required)
  cycleLength: number;
  periodLength: number;
  pregnant?: "no" | "yes" | "not_sure";
}

// ── Auth state ─────────────────────────────────────────────────
export function isAuthed(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(AUTH_KEY) === "true";
}

export function getEmail(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(EMAIL_KEY);
}

export function setAuthed(email: string): void {
  localStorage.setItem(AUTH_KEY, "true");
  localStorage.setItem(EMAIL_KEY, email);
}

export function clearAuth(): void {
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(EMAIL_KEY);
}

// ── User registry ───────────────────────────────────────────────
function getUsers(): StoredUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? (JSON.parse(raw) as StoredUser[]) : [];
  } catch {
    return [];
  }
}

function saveUsers(users: StoredUser[]): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

// ── Login ───────────────────────────────────────────────────────
export type LoginResult =
  | { success: true }
  | { success: false; error: string };

export function attemptLogin(email: string, password: string): LoginResult {
  try {
    // Test user check
    if (email === TEST_USER.email && password === TEST_USER.password) {
      setAuthed(email);
      return { success: true };
    }
    // Registered users check
    const match = getUsers().find(
      (u) => u.email === email && u.password === password
    );
    if (match) {
      setAuthed(email);
      return { success: true };
    }
    return { success: false, error: "Email or password didn't match. Try again." };
  } catch {
    return { success: false, error: "Something went wrong. Try again in a moment." };
  }
}

// ── Signup ──────────────────────────────────────────────────────
export type SignupResult =
  | { success: true }
  | { success: false; error: string };

export function attemptSignup(email: string, password: string): SignupResult {
  try {
    const users = getUsers();
    const alreadyExists =
      users.some((u) => u.email === email) || email === TEST_USER.email;
    if (alreadyExists) {
      return { success: false, error: "An account with this email already exists." };
    }
    saveUsers([...users, { email, password }]);
    setAuthed(email);
    return { success: true };
  } catch {
    return { success: false, error: "Something went wrong. Try again in a moment." };
  }
}

// ── Profile ─────────────────────────────────────────────────────
export function saveProfile(profile: Profile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function getProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as Profile) : null;
  } catch {
    return null;
  }
}

// ── Validation ──────────────────────────────────────────────────
export function validateEmail(email: string): string | null {
  if (!email) return "Enter a valid email address.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email address.";
  return null;
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  return null;
}
