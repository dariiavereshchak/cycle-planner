"use client";

// app/onboarding/page.tsx

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { isAuthed, saveProfile, type Profile } from "@/lib/auth";

// ─────────────────────────────────────────────
// Field sub-components
// ─────────────────────────────────────────────

interface LabelProps {
  htmlFor?: string;
  required?: boolean;
  children: React.ReactNode;
}

function FieldLabel({ htmlFor, required, children }: LabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-xs font-semibold tracking-widest uppercase mb-2"
      style={{ fontFamily: "'Nunito', sans-serif", color: "#9A8F86" }}
    >
      {children}
      {required && <span style={{ color: "#C4796A" }}> *</span>}
    </label>
  );
}

interface TextInputProps {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}

function TextInput({ id, value, onChange, placeholder, type = "text" }: TextInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder={placeholder}
      className="w-full px-4 py-3.5 rounded-2xl outline-none transition-all duration-200 text-[15px]"
      style={{
        fontFamily: "'Nunito', sans-serif",
        background: "#FAF8F5",
        border: `1.5px solid ${focused ? "#C4796A" : "#EDE8E3"}`,
        color: "#3D3530",
        boxShadow: focused ? "0 0 0 3px rgba(196,121,106,0.1)" : "none",
      }}
    />
  );
}

interface SliderFieldProps {
  id: string;
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
  unit?: string;
}

function SliderField({ id, label, min, max, value, onChange, unit = "" }: SliderFieldProps) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex justify-between items-baseline mb-2">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <span
          className="text-sm font-bold"
          style={{ fontFamily: "'Nunito', sans-serif", color: "#C4796A" }}
        >
          {value} {unit}
        </span>
      </div>
      <div className="relative">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer outline-none"
          style={{
            background: `linear-gradient(to right, #C4796A ${pct}%, #EDE8E3 ${pct}%)`,
            accentColor: "#C4796A",
          }}
        />
        <div className="flex justify-between mt-1.5">
          <span className="text-[10px]" style={{ fontFamily: "'Nunito', sans-serif", color: "#C5BDB5" }}>{min}</span>
          <span className="text-[10px]" style={{ fontFamily: "'Nunito', sans-serif", color: "#C5BDB5" }}>{max}</span>
        </div>
      </div>
    </div>
  );
}

interface SelectChipProps {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}

function SelectChips({ options, value, onChange }: SelectChipProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(active ? "" : opt.value)}
            className="px-4 py-2 rounded-full text-sm font-semibold transition-all duration-150 active:scale-95"
            style={{
              fontFamily: "'Nunito', sans-serif",
              background: active ? "#C4796A" : "#FAF8F5",
              color: active ? "#fff" : "#7A706A",
              border: `1.5px solid ${active ? "#C4796A" : "#EDE8E3"}`,
              boxShadow: active ? "0 2px 10px rgba(196,121,106,0.25)" : "none",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// Onboarding Page
// ─────────────────────────────────────────────

const AGE_RANGES = [
  { value: "18-24", label: "18–24" },
  { value: "25-34", label: "25–34" },
  { value: "35-44", label: "35–44" },
  { value: "45+",   label: "45+" },
  { value: "prefer_not", label: "Prefer not to say" },
];

const PREGNANT_OPTIONS = [
  { value: "no",       label: "No" },
  { value: "yes",      label: "Yes" },
  { value: "not_sure", label: "Not sure" },
];

export default function OnboardingPage() {
  const router = useRouter();

  // Redirect if not authed
  useEffect(() => {
    if (!isAuthed()) router.replace("/login");
  }, [router]);

  // Form state
  const [name, setName]                   = useState("");
  const [country, setCountry]             = useState("");
  const [ageRange, setAgeRange]           = useState("");
  const [lastPeriodStart, setLastPeriod]  = useState("");
  const [cycleLength, setCycleLength]     = useState(28);
  const [periodLength, setPeriodLength]   = useState(5);
  const [pregnant, setPregnant]           = useState<Profile["pregnant"]>(undefined);
  const [periodError, setPeriodError]     = useState("");
  const [loading, setLoading]             = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!lastPeriodStart) {
      setPeriodError("Please enter the first day of your last period.");
      return;
    }
    setPeriodError("");

    setLoading(true);

    const profile: Profile = {
      name:            name.trim() || undefined,
      country:         country.trim() || undefined,
      ageRange:        ageRange || undefined,
      lastPeriodStart,
      cycleLength,
      periodLength,
      pregnant:        pregnant || undefined,
    };

    saveProfile(profile);

    setTimeout(() => {
      router.push("/today");
    }, 400);
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Nunito:wght@300;400;500;600;700&display=swap');
        input[type='range']::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #C4796A;
          box-shadow: 0 2px 8px rgba(196,121,106,0.35);
          cursor: pointer;
          border: 2px solid white;
        }
        input[type='range']::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #C4796A;
          box-shadow: 0 2px 8px rgba(196,121,106,0.35);
          cursor: pointer;
          border: 2px solid white;
        }
      `}</style>

      <main
        className="min-h-screen px-4 py-12 pb-20"
        style={{
          background: "#FDFAF7",
          backgroundImage:
            "radial-gradient(ellipse 80% 40% at 50% -5%, rgba(196,121,106,0.06) 0%, transparent 65%)",
        }}
      >
        <div className="max-w-sm mx-auto">

          {/* Header */}
          <div className="text-center mb-10">
            <h1
              className="mb-2"
              style={{
                fontFamily: "'Cormorant', serif",
                fontWeight: 300,
                fontStyle: "normal",
                fontSize: "40px",
                color: "#2D2926",
                lineHeight: 1,
                letterSpacing: "-0.01em",
              }}
            >
              EssenSHEal
            </h1>
            <p
              className="text-sm"
              style={{ fontFamily: "'Nunito', sans-serif", color: "#9A8F86" }}
            >
              Let&apos;s personalise your experience
            </p>
          </div>

          {/* Progress indicator */}
          <div className="flex gap-1.5 mb-8 justify-center">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-1 rounded-full transition-all duration-300"
                style={{
                  width: i === 0 ? 28 : 10,
                  background: i === 0 ? "#C4796A" : "#EDE8E3",
                }}
              />
            ))}
          </div>

          {/* Card */}
          <div
            style={{
              background: "#fff",
              borderRadius: "28px",
              border: "1.5px solid #F0EDE8",
              boxShadow: "0 8px 40px rgba(0,0,0,0.05)",
              padding: "32px 24px",
            }}
          >
            <form onSubmit={handleSubmit} className="flex flex-col gap-7" noValidate>

              {/* Optional section label */}
              <div>
                <div
                  className="text-xs font-bold tracking-widest uppercase mb-5 pb-2"
                  style={{
                    fontFamily: "'Nunito', sans-serif",
                    color: "#C5BDB5",
                    borderBottom: "1px solid #F5F0EB",
                  }}
                >
                  About you — optional
                </div>

                <div className="flex flex-col gap-5">
                  {/* Name */}
                  <div>
                    <FieldLabel htmlFor="name">Your name</FieldLabel>
                    <TextInput
                      id="name"
                      value={name}
                      onChange={setName}
                      placeholder="What should we call you?"
                    />
                  </div>

                  {/* Country */}
                  <div>
                    <FieldLabel htmlFor="country">Country</FieldLabel>
                    <TextInput
                      id="country"
                      value={country}
                      onChange={setCountry}
                      placeholder="Where are you based?"
                    />
                  </div>

                  {/* Age range */}
                  <div>
                    <FieldLabel>Age range</FieldLabel>
                    <SelectChips
                      options={AGE_RANGES}
                      value={ageRange}
                      onChange={setAgeRange}
                    />
                  </div>
                </div>
              </div>

              {/* Cycle section */}
              <div>
                <div
                  className="text-xs font-bold tracking-widest uppercase mb-5 pb-2"
                  style={{
                    fontFamily: "'Nunito', sans-serif",
                    color: "#C5BDB5",
                    borderBottom: "1px solid #F5F0EB",
                  }}
                >
                  Your cycle
                </div>

                <div className="flex flex-col gap-6">
                  {/* Last period start */}
                  <div>
                    <FieldLabel htmlFor="lastPeriod" required>
                      First day of your last period
                    </FieldLabel>
                    <input
                      id="lastPeriod"
                      type="date"
                      value={lastPeriodStart}
                      onChange={(e) => {
                        setLastPeriod(e.target.value);
                        if (e.target.value) setPeriodError("");
                      }}
                      max={new Date().toISOString().split("T")[0]}
                      className="w-full px-4 py-3.5 rounded-2xl outline-none transition-all duration-200 text-[15px]"
                      style={{
                        fontFamily: "'Nunito', sans-serif",
                        background: "#FAF8F5",
                        border: `1.5px solid ${periodError ? "#C4796A" : "#EDE8E3"}`,
                        color: "#3D3530",
                      }}
                    />
                    {periodError && (
                      <p
                        className="text-xs mt-1.5"
                        style={{ fontFamily: "'Nunito', sans-serif", color: "#C4796A" }}
                      >
                        {periodError}
                      </p>
                    )}
                  </div>

                  {/* Cycle length */}
                  <SliderField
                    id="cycleLength"
                    label="Cycle length"
                    min={21}
                    max={35}
                    value={cycleLength}
                    onChange={setCycleLength}
                    unit="days"
                  />

                  {/* Period length */}
                  <SliderField
                    id="periodLength"
                    label="Period length"
                    min={2}
                    max={8}
                    value={periodLength}
                    onChange={setPeriodLength}
                    unit="days"
                  />

                  {/* Pregnant */}
                  <div>
                    <FieldLabel>Are you currently pregnant?</FieldLabel>
                    <SelectChips
                      options={PREGNANT_OPTIONS}
                      value={pregnant ?? ""}
                      onChange={(v) => setPregnant(v as Profile["pregnant"])}
                    />
                  </div>
                </div>
              </div>

              {/* Submit */}
              <div className="pt-1">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 rounded-2xl text-white text-sm font-bold tracking-wide transition-all duration-200 active:scale-[0.98] disabled:opacity-60"
                  style={{
                    fontFamily: "'Nunito', sans-serif",
                    background: "linear-gradient(135deg, #C4796A 0%, #B06050 100%)",
                    boxShadow: loading ? "none" : "0 4px 20px rgba(196,121,106,0.3)",
                    letterSpacing: "0.05em",
                  }}
                >
                  {loading ? "Setting up…" : "Continue"}
                </button>
                <p
                  className="text-center text-xs mt-3"
                  style={{ fontFamily: "'Nunito', sans-serif", color: "#C5BDB5" }}
                >
                  You can update these in settings anytime
                </p>
              </div>
            </form>
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
        </div>
      </main>
    </>
  );
}
