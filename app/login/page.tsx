"use client";

// app/login/page.tsx

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { attemptLogin, validateEmail, validatePassword } from "@/lib/auth";

// ─────────────────────────────────────────────
// Shared sub-components
// ─────────────────────────────────────────────

interface InputFieldProps {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  autoComplete?: string;
  error?: string;
}

function InputField({
  id,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  autoComplete,
  error,
}: InputFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-xs font-semibold tracking-widest uppercase"
        style={{ fontFamily: "'Nunito', sans-serif", color: "#9A8F86" }}
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full px-4 py-3.5 rounded-2xl outline-none transition-all duration-200 text-[15px]"
        style={{
          fontFamily: "'Nunito', sans-serif",
          background: "#FAF8F5",
          border: `1.5px solid ${error ? "#C4796A" : focused ? "#C4796A" : "#EDE8E3"}`,
          color: "#3D3530",
          boxShadow: focused && !error
            ? "0 0 0 3px rgba(196,121,106,0.1)"
            : error
            ? "0 0 0 3px rgba(196,121,106,0.08)"
            : "none",
        }}
      />
      {error && (
        <p
          className="text-xs mt-0.5"
          style={{ fontFamily: "'Nunito', sans-serif", color: "#C4796A" }}
        >
          {error}
        </p>
      )}
    </div>
  );
}

interface PrimaryButtonProps {
  children: React.ReactNode;
  loading?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
}

function PrimaryButton({ children, loading, type = "submit", onClick }: PrimaryButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={loading}
      className="w-full py-4 rounded-2xl text-white text-sm font-bold tracking-wide transition-all duration-200 active:scale-[0.98] disabled:opacity-60"
      style={{
        fontFamily: "'Nunito', sans-serif",
        background: loading
          ? "#C4796A"
          : "linear-gradient(135deg, #C4796A 0%, #B06050 100%)",
        boxShadow: loading
          ? "none"
          : "0 4px 20px rgba(196,121,106,0.3)",
        letterSpacing: "0.05em",
      }}
    >
      {loading ? "Signing in…" : children}
    </button>
  );
}

// ─────────────────────────────────────────────
// Login Page
// ─────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors]     = useState<{ email?: string; password?: string; form?: string }>({});
  const [loading, setLoading]   = useState(false);

  function validate(): boolean {
    const next: typeof errors = {};
    const emailErr    = validateEmail(email);
    const passwordErr = validatePassword(password);
    if (emailErr)    next.email    = emailErr;
    if (passwordErr) next.password = passwordErr;
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setErrors({});

    // Small artificial delay for UX
    await new Promise((r) => setTimeout(r, 600));

    const result = attemptLogin(email, password);
    setLoading(false);

    if (result.success) {
      router.push("/today");
    } else {
      setErrors({ form: result.error });
    }
  }

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Nunito:wght@300;400;500;600;700&display=swap');`}</style>

      <main
        className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
        style={{
          background: "#FDFAF7",
          backgroundImage:
            "radial-gradient(ellipse 80% 50% at 50% -5%, rgba(196,121,106,0.07) 0%, transparent 70%)",
        }}
      >
        {/* Logo */}
        <div className="mb-10 text-center">
          <h1
            className="mb-3"
            style={{
              fontFamily: "'Cormorant', serif",
              fontWeight: 300,
              fontStyle: "normal",
              fontSize: "48px",
              color: "#2D2926",
              lineHeight: 1,
              letterSpacing: "-0.01em",
            }}
          >
            EssenSHEal
          </h1>
          <p
            className="text-[15px] leading-snug"
            style={{ fontFamily: "'Nunito', sans-serif", color: "#9A8F86" }}
          >
            Your personal operating system for life.
          </p>
          <p
            className="text-[14px] leading-snug"
            style={{ fontFamily: "'Nunito', sans-serif", color: "#B5ADA8" }}
          >
            Align your life with your natural rhythm.
          </p>
        </div>

        {/* Card */}
        <div
          className="w-full max-w-sm relative"
          style={{
            background: "#FFFFFF",
            borderRadius: "28px",
            border: "1.5px solid #F0EDE8",
            boxShadow: "0 8px 40px rgba(0,0,0,0.06)",
            padding: "36px 28px 32px",
          }}
        >
          {/* Accent line */}
          <div
            className="absolute top-0 left-10 right-10 h-[2px] rounded-full"
            style={{ background: "linear-gradient(90deg, transparent, rgba(196,121,106,0.4), transparent)" }}
          />

          {/* Header */}
          <div className="text-center mb-8">
            <h2
              className="mb-1.5"
              style={{
                fontFamily: "'Cormorant', serif",
                fontWeight: 400,
                fontSize: "26px",
                color: "#2D2926",
              }}
            >
              Welcome back
            </h2>
            <p
              className="text-sm"
              style={{ fontFamily: "'Nunito', sans-serif", color: "#9A8F86" }}
            >
              Sign in to continue your journey
            </p>
          </div>

          {/* Form-level error */}
          {errors.form && (
            <div
              className="mb-5 px-4 py-3 rounded-xl text-sm text-center"
              style={{
                fontFamily: "'Nunito', sans-serif",
                background: "rgba(196,121,106,0.08)",
                border: "1px solid rgba(196,121,106,0.2)",
                color: "#B06050",
              }}
            >
              {errors.form}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
            <InputField
              id="email"
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              error={errors.email}
            />
            <InputField
              id="password"
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              error={errors.password}
            />

            {/* Forgot password */}
<div className="flex justify-end -mt-2">
  <Link
    href="/forgot-password"
    className="text-xs font-semibold transition-colors duration-150 underline underline-offset-4"
    style={{ fontFamily: "'Nunito', sans-serif", color: "#C4796A" }}
  >
    Forgot password?
  </Link>
</div>

            <div className="pt-1">
              <PrimaryButton loading={loading}>Sign In</PrimaryButton>
            </div>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px" style={{ background: "#F0EDE8" }} />
            <span className="text-xs" style={{ fontFamily: "'Nunito', sans-serif", color: "#C5BDB5" }}>or</span>
            <div className="flex-1 h-px" style={{ background: "#F0EDE8" }} />
          </div>

          {/* Sign up link */}
          <p className="text-center text-sm" style={{ fontFamily: "'Nunito', sans-serif", color: "#9A8F86" }}>
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="font-bold transition-colors duration-150"
              style={{ color: "#C4796A" }}
            >
              Sign up
            </Link>
          </p>
        </div>

        {/* Footer */}
        <p
          className="mt-8 text-center text-xs leading-relaxed"
          style={{ fontFamily: "'Nunito', sans-serif", color: "#C5BDB5" }}
        >
          Your data stays private.
          <br />
          Educational context, not medical advice.
        </p>
      </main>
    </>
  );
}
