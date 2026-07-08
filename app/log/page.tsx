"use client";

import { useState } from "react";
import Nav from "@/components/Nav";

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function LogPage() {
  const [form, setForm] = useState({
    date: todayISO(),
    sessionType: "moderate",
    tdeeSource: "apple_watch",
    activeCaloriesKcal: "",
    bodyWeightKg: "",
    carbGramsActual: "",
    recoveryScore: "",
  });
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    setResult(null);
    const payload = {
      date: form.date,
      sessionType: form.sessionType,
      tdeeSource: form.tdeeSource,
      activeCaloriesKcal: form.activeCaloriesKcal ? parseFloat(form.activeCaloriesKcal) : null,
      bodyWeightKg: form.bodyWeightKg ? parseFloat(form.bodyWeightKg) : null,
      carbGramsActual: form.carbGramsActual ? parseFloat(form.carbGramsActual) : null,
      recoveryScore: form.recoveryScore ? parseFloat(form.recoveryScore) : null,
    };
    const res = await fetch("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    const body = await res.json();
    if (res.ok) {
      setResult(body);
    } else {
      setError(JSON.stringify(body.error));
    }
  }

  return (
    <div>
      <Nav />
      <h2>Log Day</h2>
      <form onSubmit={handleSubmit} className="card">
        <label>Date</label>
        <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />

        <label>Session type</label>
        <select value={form.sessionType} onChange={(e) => setForm({ ...form, sessionType: e.target.value })}>
          <option value="rest">Rest</option>
          <option value="recovery">Recovery</option>
          <option value="moderate">Moderate</option>
          <option value="heavy">Heavy</option>
          <option value="game">Game</option>
        </select>

        <label>TDEE source</label>
        <select value={form.tdeeSource} onChange={(e) => setForm({ ...form, tdeeSource: e.target.value })}>
          <option value="apple_watch">Apple Watch (±15%)</option>
          <option value="step_estimate">Step estimate (±25%)</option>
          <option value="bmr_only">No activity data logged (±30%)</option>
        </select>

        {form.tdeeSource !== "bmr_only" && (
          <>
            <label>Active calories from device (kcal)</label>
            <input
              type="number"
              value={form.activeCaloriesKcal}
              onChange={(e) => setForm({ ...form, activeCaloriesKcal: e.target.value })}
            />
          </>
        )}

        <label>Body weight today (kg) — optional, defaults to profile weight</label>
        <input
          type="number"
          step="0.1"
          value={form.bodyWeightKg}
          onChange={(e) => setForm({ ...form, bodyWeightKg: e.target.value })}
        />

        <label>Carbs actually eaten (g) — optional</label>
        <input
          type="number"
          value={form.carbGramsActual}
          onChange={(e) => setForm({ ...form, carbGramsActual: e.target.value })}
        />

        <label>Recovery score, 1-10 — optional</label>
        <input
          type="number"
          min={1}
          max={10}
          value={form.recoveryScore}
          onChange={(e) => setForm({ ...form, recoveryScore: e.target.value })}
        />

        {error && <div className="error-text">{error}</div>}
        <button type="submit" disabled={saving}>
          {saving ? "Computing…" : "Save log"}
        </button>
      </form>

      {result && (
        <div className={`banner ${result.targets.capBit ? "cap" : "info"}`}>
          <div className="stat-grid" style={{ marginBottom: 12 }}>
            <div className="stat">
              <div className="label">Protein target</div>
              <div className="value">{result.targets.proteinGrams}g</div>
            </div>
            <div className="stat">
              <div className="label">Fat target</div>
              <div className="value">{result.targets.fatGrams}g</div>
            </div>
            <div className="stat">
              <div className="label">Carb target</div>
              <div className="value">{result.targets.carbGramsTarget}g</div>
            </div>
          </div>
          {result.targets.disclosureCopy}
        </div>
      )}
    </div>
  );
}
