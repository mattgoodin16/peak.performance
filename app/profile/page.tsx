"use client";

import { useEffect, useState } from "react";
import Nav from "@/components/Nav";

const BF_METHODS = [
  { value: "dexa", label: "DEXA scan" },
  { value: "bodpod", label: "BodPod" },
  { value: "clinical_caliper_3site", label: "Clinical caliper (3+ site, trained tester)" },
  { value: "consumer_scale", label: "Consumer smart scale" },
  { value: "visual_estimate", label: "Visual estimate" },
  { value: "other_unverified", label: "Other / unverified" },
];

const TRUSTED = new Set(["dexa", "bodpod", "clinical_caliper_3site"]);

export default function ProfilePage() {
  const [form, setForm] = useState({
    weightKg: "",
    heightCm: "",
    age: "",
    sex: "male",
    bodyFatPercent: "",
    bodyFatMethod: "",
    seasonStartDate: "",
    fuelingPhilosophy: "strict_daily",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then(({ profile }) => {
        if (profile) {
          setForm({
            weightKg: String(profile.weightKg),
            heightCm: String(profile.heightCm),
            age: String(profile.age),
            sex: profile.sex,
            bodyFatPercent: profile.bodyFatPercent != null ? String(profile.bodyFatPercent) : "",
            bodyFatMethod: profile.bodyFatMethod ?? "",
            seasonStartDate: profile.seasonStartDate?.slice(0, 10) ?? "",
            fuelingPhilosophy: profile.fuelingPhilosophy,
          });
        }
        setLoading(false);
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    setSaved(false);
    const payload = {
      weightKg: parseFloat(form.weightKg),
      heightCm: parseFloat(form.heightCm),
      age: parseInt(form.age, 10),
      sex: form.sex,
      bodyFatPercent: form.bodyFatPercent ? parseFloat(form.bodyFatPercent) : null,
      bodyFatMethod: form.bodyFatMethod || null,
      seasonStartDate: form.seasonStartDate,
      fuelingPhilosophy: form.fuelingPhilosophy,
    };
    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
    } else {
      const body = await res.json();
      setError(JSON.stringify(body.error));
    }
  }

  if (loading) return <div>Loading…</div>;

  const showUntrustedWarning = form.bodyFatMethod && !TRUSTED.has(form.bodyFatMethod) && form.bodyFatPercent;

  return (
    <div>
      <Nav />
      <h2>Athlete Profile</h2>
      {!form.seasonStartDate && (
        <div className="banner season">
          <strong>Season start date is required.</strong> Without it, Decision #8's revisit safeguard for
          the strict-daily calorie decision cannot function — it silently does nothing. Set it below.
        </div>
      )}
      <form onSubmit={handleSubmit} className="card">
        <label>Body weight (kg)</label>
        <input
          type="number"
          step="0.1"
          required
          value={form.weightKg}
          onChange={(e) => setForm({ ...form, weightKg: e.target.value })}
        />

        <label>Height (cm)</label>
        <input
          type="number"
          step="0.1"
          required
          value={form.heightCm}
          onChange={(e) => setForm({ ...form, heightCm: e.target.value })}
        />

        <label>Age</label>
        <input
          type="number"
          required
          value={form.age}
          onChange={(e) => setForm({ ...form, age: e.target.value })}
        />

        <label>Sex (for BMR formula constant)</label>
        <select value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value })}>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>

        <label>Body fat % (optional)</label>
        <input
          type="number"
          step="0.1"
          value={form.bodyFatPercent}
          onChange={(e) => setForm({ ...form, bodyFatPercent: e.target.value })}
        />

        <label>Body fat % measurement method</label>
        <select
          value={form.bodyFatMethod}
          onChange={(e) => setForm({ ...form, bodyFatMethod: e.target.value })}
        >
          <option value="">— none —</option>
          {BF_METHODS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        {showUntrustedWarning && (
          <div className="banner cap" style={{ marginTop: 8 }}>
            Katch-McArdle needs a lab-grade or clinical-caliper body fat % to be more accurate than the
            standard formula — your current entry method isn&apos;t reliable enough to trust over
            Mifflin-St Jeor, so we&apos;ll use that instead.
          </div>
        )}

        <label>Season start date (required — Decision #8)</label>
        <input
          type="date"
          required
          value={form.seasonStartDate}
          onChange={(e) => setForm({ ...form, seasonStartDate: e.target.value })}
        />

        <label>Fueling philosophy</label>
        <select
          value={form.fuelingPhilosophy}
          onChange={(e) => setForm({ ...form, fuelingPhilosophy: e.target.value })}
        >
          <option value="strict_daily">Strict daily ceiling</option>
          <option value="weekly_net">Weekly net deficit</option>
        </select>

        {error && <div className="error-text">{error}</div>}
        <button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save profile"}
        </button>
        {saved && <div style={{ color: "#6fbf73", marginTop: 8 }}>Saved.</div>}
      </form>
    </div>
  );
}
