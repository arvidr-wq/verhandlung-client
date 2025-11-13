import React from 'react';
import { Action, computeActualScores, computeCoopBaseline, computeMaxCeiling, Team } from '../utils/score';

export default function EndOfGameSummary({ actions, climateAtRound = [], title = "Endauswertung" }: { actions: Action[]; climateAtRound?: number[]; title?: string; }) {
  const actual = computeActualScores(actions, climateAtRound);
  const coop   = computeCoopBaseline(actions);
  const max    = computeMaxCeiling(actions);

  const Row = ({ team }:{team:Team}) => {
    const a = actual[team], c = coop[team], m = max[team];
    const scale = Math.max(m, 1);
    const pct = (v:number) => Math.round((v / Math.max(m, 1)) * 100);
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="font-semibold">Team {team}</div>
          <div className="text-sm text-gray-500">Erreicht: {a.toFixed(2)} | Baseline: {c.toFixed(2)} | Decke: {m.toFixed(2)}</div>
        </div>
        <Bar label={`Erreicht (${pct(a)}% der Decke)`} value={a} max={scale} color="bg-blue-700" />
        <Bar label={`Kooperations-Baseline (${pct(c)}%)`} value={c} max={scale} color="bg-blue-400" />
        <Bar label="Max-Ceiling (100%)" value={m} max={scale} color="bg-gray-300" />
      </div>
    );
  };

  return (
    <section className="w-full max-w-3xl mx-auto p-4 md:p-6 rounded-2xl border border-gray-200 shadow-sm bg-white">
      <h2 className="text-xl md:text-2xl font-bold mb-4">{title}</h2>
      <div className="space-y-6">
        <Row team="A" />
        <hr className="border-gray-200" />
        <Row team="B" />
      </div>
      <footer className="mt-6 text-xs text-gray-500">
        Hinweis: Die Zerlegung der Wirkung (Reaktion vs. Vertrauensklima) wird nicht angezeigt – nur das Ergebnis.
      </footer>
    </section>
  );
}

function Bar({ label, value, max, color }:{label:string; value:number; max:number; color:string}){
  const widthPct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-gray-700">{label}</span>
        <span className="text-sm tabular-nums text-gray-500">{value.toFixed(2)}</span>
      </div>
      <div className="w-full h-3 rounded-full bg-gray-100">
        <div className={`h-3 rounded-full ${color}`} style={{ width: `${widthPct}%` }} />
      </div>
    </div>
  );
}
