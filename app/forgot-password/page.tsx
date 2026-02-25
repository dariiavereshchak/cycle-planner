"use client";

import { useState } from "react";
import Link from "next/link";
import { validateEmail } from "@/lib/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const emailErr = validateEmail(email);
    if (emailErr) {
      setError(emailErr);
      return;
    }

    // MVP: we are not sending a real email yet.
    setSent(true);
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
        <div className="mb-10 text-center">
          <h1
            className="mb-3"
            style={{
              fontFamily: "'Cormorant', serif",
              fontWeight: 300,
              fontSize: "48px",
              color: "#2D2926",
              lineHeight: 1,
              letterSpacing: "-0.01em",
            }}
          >
            EssenSHEal
          </h1>
          <p className="text-[15px] leading-snug" style={{ fontFamily: "'Nunito', sans-serif", color: "#9A8F86" }}>
            Your personal operating system for life.
          </p>
        </div>

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
          <div
            className="absolute top-0 left-10 right-10 h-[2px] rounded-full"
            style={{ background: "linear-gradient(90deg, transparent, rgba(196,121,106,0.4), transparent)" }}
          />

          <div className="text-center mb-6">
            <h2
              className="mb-1.5"
              style={{
                fontFamily: "'Cormorant', serif",
                fontWeight: 400,
                fontSize: "26px",
                color: "#2D2926",
              }}
            >
              Reset password
            </h2>
            <p className="text-sm" style={{ fontFamily: "'Nunito', sans-serif", color: "#9A8F86" }}>
              Enter your email and we’ll send a reset link.
            </p>
          </div>

          {!sent ? (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
              <div className="flex flex-col gap-1.5">
                <label
                  className="text-xs font-semibold tracking-widest uppercase"
                  style={{ fontFamily: "'Nunito', sans-serif", color: "#9A8F86" }}
                >
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="w-full px-4 py-3.5 rounded-2xl outline-none transition-all duration-200 text-[15px]"
                  style={{
                    fontFamily: "'Nunito', sans-serif",
                    background: "#FAF8F5",
                    border: `1.5px solid ${error ? "#C4796A" : "#EDE8E3"}`,
                    color: "#3D3530",
                  }}
                />
                {error && (
                  <p className="text-xs mt-0.5" style={{ fontFamily: "'Nunito', sans-serif", color: "#C4796A" }}>
                    {error}
                  </p>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-4 rounded-2xl text-white text-sm font-bold tracking-wide transition-all duration-200 active:scale-[0.98]"
                style={{
                  fontFamily: "'Nunito', sans-serif",
                  background: "linear-gradient(135deg, #C4796A 0%, #B06050 100%)",
                  boxShadow: "0 4px 20px rgba(196,121,106,0.3)",
                  letterSpacing: "0.05em",
                }}
              >
                Send reset link
              </button>

              <p className="text-xs text-center" style={{ fontFamily: "'Nunito', sans-serif", color: "#C5BDB5" }}>
                For MVP, this is a placeholder (email sending will be added later).
              </p>
            </form>
          ) : (
            <div className="text-center">
              <p className="text-sm" style={{ fontFamily: "'Nunito', sans-serif", color: "#3D3530" }}>
                If this email is registered, you’ll receive a reset link.
              </p>
            </div>
          )}

          <div className="mt-6 text-center">
            <Link
              href="/login"
              className="text-sm font-bold transition-colors duration-150 underline underline-offset-4"
              style={{ fontFamily: "'Nunito', sans-serif", color: "#C4796A" }}
            >
              Back to sign in
            </Link>
          </div>
        </div>

        <p className="mt-8 text-center text-xs leading-relaxed" style={{ fontFamily: "'Nunito', sans-serif", color: "#C5BDB5" }}>
          Your data stays private.
          <br />
          Educational context, not medical advice.
        </p>
      </main>
    </>
  );
}