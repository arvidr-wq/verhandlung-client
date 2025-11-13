// src/routes/Start.tsx
import React, { useState } from "react";
import { Link } from "react-router-dom";

export default function Start() {
  const [session, setSession] = useState("TEST");

  const trimmed = session.trim() || "TEST";
  const sessionParam = encodeURIComponent(trimmed);
  const baseQuery = `s=${sessionParam}`;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Verhandlungsspiel · Start</h1>
        <p className="text-sm text-gray-600 mt-1">
          Lege eine Session fest und starte dann den Host oder eines der Teams.
        </p>
      </header>

      {/* Session-Code einstellen */}
      <section className="border rounded-xl p-4 bg-white shadow-sm mb-6">
        <label className="block text-sm font-medium mb-2">
          Session-Code
          <input
            type="text"
            className="mt-1 w-full border rounded px-3 py-2 text-sm"
            value={session}
            onChange={(e) => setSession(e.target.value)}
            placeholder="z.B. TEST oder WORKSHOP1"
          />
        </label>
        <p className="text-xs text-gray-500">
          Dieser Code verbindet Host und Teams.  
          Alle Geräte (Host, Team A, Team B) müssen denselben Session-Code verwenden.
        </p>
      </section>

      {/* Navigation Host / Teams */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Link
          to={`/host?${baseQuery}`}
          className="border rounded-xl p-4 bg-white shadow-sm hover:bg-gray-50 transition text-sm flex flex-col justify-between"
        >
          <div>
            <div className="font-semibold mb-1">Host starten</div>
            <p className="text-xs text-gray-600">
              Übersicht für Spielleitung mit Score- und Vertrauensanzeige.
            </p>
          </div>
          <div className="mt-3 text-xs text-gray-500 font-mono">
            /host?{baseQuery}
          </div>
        </Link>

        <Link
          to={`/join?r=A&${baseQuery}`}
          className="border rounded-xl p-4 bg-white shadow-sm hover:bg-gray-50 transition text-sm flex flex-col justify-between"
        >
          <div>
            <div className="font-semibold mb-1">Team A beitreten</div>
            <p className="text-xs text-gray-600">
              Oberfläche für die Gruppe, die als Team A spielt.
            </p>
          </div>
          <div className="mt-3 text-xs text-gray-500 font-mono">
            /join?r=A&{baseQuery}
          </div>
        </Link>

        <Link
          to={`/join?r=B&${baseQuery}`}
          className="border rounded-xl p-4 bg-white shadow-sm hover:bg-gray-50 transition text-sm flex flex-col justify-between"
        >
          <div>
            <div className="font-semibold mb-1">Team B beitreten</div>
            <p className="text-xs text-gray-600">
              Oberfläche für die Gruppe, die als Team B spielt.
            </p>
          </div>
          <div className="mt-3 text-xs text-gray-500 font-mono">
            /join?r=B&{baseQuery}
          </div>
        </Link>
      </section>

      <section className="text-xs text-gray-500 space-y-1">
        <p>
          Tipp: Auf dem Host-Rechner die <span className="font-mono">Host</span>-Ansicht öffnen.
        </p>
        <p>
          Auf zwei weiteren Geräten (oder Browser-Tabs){" "}
          <span className="font-mono">Team A</span> und{" "}
          <span className="font-mono">Team B</span> öffnen – immer mit demselben Session-Code.
        </p>
      </section>
    </div>
  );
}