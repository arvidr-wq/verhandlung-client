// src/routes/SummaryDemo.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

type Team = "A" | "B";
type Mode = "ehrlich" | "leicht" | "stark";
type Reaction = "annehmen" | "zurückstellen" | "ablehnen";

/** Nachrichten (wir hören auf denselben Channel wie Host/Join) */
type PlayedMsg = {
  type: "played";
  who: Team;
  base: number;
  mode: Mode;
  argLabel: string;
};
type ReactMsg = { type: "react"; who: Team; reaction: Reaction };
type RevealMsg = { type: "reveal"; to: Team; oppCategory: "weak" | "medium" | "strong" };
type NextMsg = { type: "next" };
type StatusMsg = { type: "status"; to: Team; lastGain: number | null; totalScore: number; trustNow: number };

type AnyMsg = PlayedMsg | ReactMsg | RevealMsg | NextMsg | StatusMsg;

type RoundRow = {
  idx: number;
  A: { arg?: string; mode?: Mode; reaction?: Reaction; gain?: number | null; trust?: number; total?: number };
  B: { arg?: string; mode?: Mode; reaction?: Reaction; gain?: number | null; trust?: number; total?: number };
  revealed: boolean;
  oppCategoryA?: "weak" | "medium" | "strong"; // was A über B sah
  oppCategoryB?: "weak" | "medium" | "strong"; // was B über A sah
};

export default function SummaryDemo() {
  const [sp] = useSearchParams();
  const session = sp.get("s") ?? "TEST";
  const chRef = useRef<BroadcastChannel | null>(null);

  const [rows, setRows] = useState<RoundRow[]>([
    { idx: 1, A: {}, B: {}, revealed: false },
  ]);

  // aktuelle Runde ist letztes Element
  const cur = rows[rows.length - 1];

  // Totals für Anzeige oben (aus letzten Statuswerten)
  const totals = useMemo(() => {
    const last = rows[rows.length - 1];
    return {
      A: { total: last.A.total ?? 0, trust: last.A.trust ?? 60 },
      B: { total: last.B.total ?? 0, trust: last.B.trust ?? 60 },
    };
  }, [rows]);

  useEffect(() => {
    chRef.current?.close();
    const ch = new BroadcastChannel(`vhg-${session}`);
    chRef.current = ch;

    const onMsg = (e: MessageEvent<AnyMsg>) => {
      const m = e.data;

      // JOIN hat Karte gespielt
      if (m.type === "played") {
        setRows((list) => {
          const next = [...list];
          const last = next[next.length - 1];
          const side = m.who;
          last[side].arg = m.argLabel;
          last[side].mode = m.mode;
          return next;
        });
      }

      // Host hat Reveal geschickt (nur Kategorie)
      if (m.type === "reveal") {
        setRows((list) => {
          const next = [...list];
          const last = next[next.length - 1];
          last.revealed = true;
          if (m.to === "A") last.oppCategoryA = m.oppCategory;
          if (m.to === "B") last.oppCategoryB = m.oppCategory;
          return next;
        });
      }

      // JOIN hat reagiert
      if (m.type === "react") {
        setRows((list) => {
          const next = [...list];
          const last = next[next.length - 1];
          last[m.who].reaction = m.reaction;
          return next;
        });
      }

      // Host sendet Status (Rundengewinn, Trust, Totals)
      if (m.type === "status") {
        setRows((list) => {
          const next = [...list];
          const last = next[next.length - 1];
          const side = m.to;
          last[side].gain = m.lastGain ?? 0;
          last[side].total = m.totalScore;
          last[side].trust = m.trustNow;
          return next;
        });
      }

      // Nächste Runde
      if (m.type === "next") {
        setRows((list) => [...list, { idx: list.length + 1, A: {}, B: {}, revealed: false }]);
      }
    };

    ch.addEventListener("message", onMsg);
    return () => {
      ch.removeEventListener("message", onMsg);
      ch.close();
    };
  }, [session]);

  function exportCSV() {
    const header = [
      "Runde",
      "A_Argument",
      "A_Mode",
      "A_Reaction",
      "A_Gain",
      "A_Total",
      "A_Trust",
      "B_Argument",
      "B_Mode",
      "B_Reaction",
      "B_Gain",
      "B_Total",
      "B_Trust",
      "Reveal_to_A",
      "Reveal_to_B",
    ].join(";");

    const lines = rows
      .filter((r) => r.idx !== rows.length || (r.A.arg || r.B.arg || r.A.total || r.B.total)) // letzte leere Zeile vermeiden
      .map((r) =>
        [
          r.idx,
          r.A.arg ?? "",
          r.A.mode ?? "",
          r.A.reaction ?? "",
          r.A.gain ?? "",
          r.A.total ?? "",
          r.A.trust ?? "",
          r.B.arg ?? "",
          r.B.mode ?? "",
          r.B.reaction ?? "",
          r.B.gain ?? "",
          r.B.total ?? "",
          r.B.trust ?? "",
          r.oppCategoryA ?? "",
          r.oppCategoryB ?? "",
        ].join(";")
      );

    const csv = [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `summary_${session}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <nav className="mb-4 flex gap-4 text-sm">
        <Link to="/" className="text-blue-700">Start</Link>
        <span className="text-gray-400">/</span>
        <span className="font-semibold">Summary</span>
      </nav>

      <h1 className="text-2xl font-bold mb-1">Summary (Session <code className="font-mono">{session}</code>)</h1>
      <p className="text-sm text-gray-500 mb-4">
        Diese Seite sammelt die Broadcast-Nachrichten („played“, „reveal“, „react“, „status“, „next“) und baut daraus die Rundentabelle.
      </p>

      {/* Totals / Trust Balken (klein) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {(["A", "B"] as Team[]).map((t) => (
          <div key={t} className="rounded border p-4">
            <div className="flex items-baseline justify-between mb-2">
              <div className="text-lg font-semibold">Team {t}</div>
              <div className="text-sm text-gray-600">Gesamt: <b>{Math.round(totals[t].total)}</b></div>
            </div>
            <MiniBar label="Gesamtscore" value={totals[t].total} max={160} color="bg-blue-600" />
            <MiniBar label="Vertrauen" value={totals[t].trust} max={100} color="bg-green-500" />
          </div>
        ))}
      </div>

      {/* Tabelle */}
      <div className="rounded border overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <Th>R</Th>
              <Th>A: Argument</Th>
              <Th>A: Mode</Th>
              <Th>A: Reaktion</Th>
              <Th>A: Gain</Th>
              <Th>A: Total</Th>
              <Th>A: Trust</Th>
              <Th>→ Reveal an A</Th>
              <Th>B: Argument</Th>
              <Th>B: Mode</Th>
              <Th>B: Reaktion</Th>
              <Th>B: Gain</Th>
              <Th>B: Total</Th>
              <Th>B: Trust</Th>
              <Th>→ Reveal an B</Th>
            </tr>
          </thead>
          <tbody>
            {rows
              .filter((r) => r.idx !== rows.length || (r.A.arg || r.B.arg || r.A.total || r.B.total))
              .map((r) => (
                <tr key={r.idx} className="border-t">
                  <Td>{r.idx}</Td>
                  <Td>{r.A.arg ?? "—"}</Td>
                  <Td>{r.A.mode ?? "—"}</Td>
                  <Td>{r.A.reaction ?? "—"}</Td>
                  <Td>{r.A.gain ?? "—"}</Td>
                  <Td>{r.A.total ?? "—"}</Td>
                  <Td>{r.A.trust ?? "—"}</Td>
                  <Td>{r.oppCategoryA ?? (r.revealed ? "—" : "…")}</Td>
                  <Td>{r.B.arg ?? "—"}</Td>
                  <Td>{r.B.mode ?? "—"}</Td>
                  <Td>{r.B.reaction ?? "—"}</Td>
                  <Td>{r.B.gain ?? "—"}</Td>
                  <Td>{r.B.total ?? "—"}</Td>
                  <Td>{r.B.trust ?? "—"}</Td>
                  <Td>{r.oppCategoryB ?? (r.revealed ? "—" : "…")}</Td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex gap-3">
        <button className="px-3 py-2 rounded bg-gray-200" onClick={exportCSV}>
          CSV exportieren
        </button>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2 whitespace-nowrap">{children}</td>;
}
function MiniBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="mb-2">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="w-full h-3 bg-gray-200 rounded">
        <div className={`h-3 rounded ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="text-xs text-gray-600">{Math.round(value)} / {max}</div>
    </div>
  );
}
