"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [acking, setAcking] = useState(false);

  function load() {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }

  useEffect(() => {
    load();
  }, []);

  async function acknowledgeReview() {
    setAcking(true);
    await fetch("/api/profile/acknowledge-review", { method: "POST" });
    setAcking(false);
    load();
  }

  if (loading) return <div>Loading…</div>;

  if (!data.profile) {
    return (
      <div>
        <Nav />
        <div className="banner season">
          No athlete profile yet.{" "}
          <Link href="/profile" style={{ color: "inherit" }}>
            Set one up
          </Link>{" "}
          before logging days — the engine needs it to compute anything.
        </div>
      </div>
    );
  }

  const { profile, daysUntilSeasonStart, showSeasonBanner, recentLogs, trend, adjustment } = data;

  return (
    <div>
      <Nav />
      <h2>Dashboard</h2>

      {showSeasonBanner && (
        <div className="banner season">
          <strong>Season starts in {daysUntilSeasonStart} day{daysUntilSeasonStart === 1 ? "" : "s"}.</strong>{" "}
          Decision #1 (strict daily deficit, even on heavy/game days) was made without real in-season
          training data. Review it now with actual data from the last several weeks before it locks in
          for the season.
          <div style={{ marginTop: 10 }}>
            <Link href="/review-decision-1">
              <button type="button">Review Decision #1</button>
            </Link>
            <button type="button" onClick={acknowledgeReview} disabled={acking} style={{ marginLeft: 8, background: "#333" }}>
              {acking ? "…" : "Acknowledge without reviewing"}
            </button>
          </div>
        </div>
      )}

      {trend.flagCopy && <div className="banner variance">{trend.flagCopy}</div>}

      {adjustment.delayedReason && <div className="banner cap">{adjustment.delayedReason}</div>}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>7-day weight trend</h3>
        <div className="stat-grid">
          <div className="stat">
            <div className="label">Trend</div>
            <div className="value">
              {trend.trendKgPerWeek != null ? `${trend.trendKgPerWeek > 0 ? "+" : ""}${trend.trendKgPerWeek} kg/wk` : "—"}
            </div>
            <div className="sub">{trend.daysWithWeighIns} weigh-in(s) this week</div>
          </div>
          <div className="stat">
            <div className="label">Carb variance</div>
            <div className="value">
              {trend.carbVariancePct != null ? `${Math.round(trend.carbVariancePct * 100)}%` : "—"}
            </div>
            <div className="sub">{trend.highVarianceWeek ? "flagged high-variance" : "within normal range"}</div>
          </div>
          <div className="stat">
            <div className="label">Fueling philosophy</div>
            <div className="value" style={{ fontSize: 16 }}>{profile.fuelingPhilosophy}</div>
          </div>
          <div className="stat">
            <div className="label">Days to season</div>
            <div className="value">{daysUntilSeasonStart}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Recent logs</h3>
        {recentLogs.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>
            No logs yet. <Link href="/log">Log today</Link> to get started.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Session</th>
                <th>TDEE</th>
                <th>Carb target</th>
                <th>Carb actual</th>
                <th>Recovery</th>
              </tr>
            </thead>
            <tbody>
              {recentLogs.map((l: any) => (
                <tr key={l.id}>
                  <td>{l.date.slice(0, 10)}</td>
                  <td>{l.sessionType}</td>
                  <td>
                    {Math.round(l.tdeeEstimateKcal)} ({l.tdeeSource})
                  </td>
                  <td>{l.carbGramsTarget ?? "—"}g</td>
                  <td>{l.carbGramsActual ?? "—"}{l.carbGramsActual != null ? "g" : ""}</td>
                  <td>{l.recoveryScore ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
