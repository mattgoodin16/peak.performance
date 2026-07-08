"use client";

import { useEffect, useState } from "react";
import Nav from "@/components/Nav";

export default function ReviewDecision1Page() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [acking, setAcking] = useState(false);
  const [acked, setAcked] = useState(false);

  useEffect(() => {
    fetch("/api/backtest")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }, []);

  async function acknowledge() {
    setAcking(true);
    await fetch("/api/profile/acknowledge-review", { method: "POST" });
    setAcking(false);
    setAcked(true);
  }

  if (loading) return <div>Loading…</div>;

  return (
    <div>
      <Nav />
      <h2>Review Decision #1</h2>

      {!data.eligible ? (
        <div className="banner info">{data.reason ?? data.bannerCopy}</div>
      ) : (
        <>
          <div className="banner info">{data.bannerCopy}</div>

          <div className="card">
            <div className="stat-grid">
              <div className="stat">
                <div className="label">Days logged</div>
                <div className="value">{data.daysLogged}</div>
              </div>
              <div className="stat">
                <div className="label">Heavy/game days weekly_net would materially increase</div>
                <div className="value">{data.heavyGameDaysMaterialIncrease}</div>
              </div>
              <div className="stat">
                <div className="label">Recovery days weekly_net would materially cut</div>
                <div className="value">{data.recoveryDaysMaterialCut}</div>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Recovery score: capped vs non-capped days</h3>
            <p style={{ fontSize: 13, color: "var(--muted)" }}>
              {data.recoveryScoreComparison.lowConfidence
                ? "Possible pattern, low confidence — under 30 days logged, this is not a settled finding."
                : "30+ days logged."}
            </p>
            <div className="stat-grid">
              <div className="stat">
                <div className="label">Capped days ({data.recoveryScoreComparison.cappedDaysCount})</div>
                <div className="value">{data.recoveryScoreComparison.cappedDaysAvgRecovery ?? "—"}</div>
              </div>
              <div className="stat">
                <div className="label">Non-capped days ({data.recoveryScoreComparison.nonCappedDaysCount})</div>
                <div className="value">{data.recoveryScoreComparison.nonCappedDaysAvgRecovery ?? "—"}</div>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Day-by-day: strict_daily (actual) vs weekly_net (simulated)</h3>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Session</th>
                  <th>TDEE</th>
                  <th>strict_daily</th>
                  <th>weekly_net (sim)</th>
                  <th>Delta</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r: any) => (
                  <tr key={r.date}>
                    <td>{r.date}</td>
                    <td>{r.sessionType}</td>
                    <td>
                      {r.tdeeKcal} (±{Math.round(r.tdeeConfidencePct * 100)}%)
                    </td>
                    <td>{r.strictDailyCarbsActual}g</td>
                    <td>{r.weeklyNetCarbsSimulated}g</td>
                    <td style={{ color: r.deltaGrams > 0 ? "#6fbf73" : r.deltaGrams < 0 ? "var(--danger)" : undefined }}>
                      {r.deltaGrams > 0 ? "+" : ""}
                      {r.deltaGrams}g ({r.deltaPct > 0 ? "+" : ""}
                      {r.deltaPct}%)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <button onClick={acknowledge} disabled={acking || acked}>
        {acked ? "Acknowledged" : acking ? "…" : "Mark Decision #1 as reviewed"}
      </button>
    </div>
  );
}
