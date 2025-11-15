// src/routes/Start.tsx
import React, { useState } from "react";
import { Link } from "react-router-dom";

export default function Start() {
  const [session, setSession] = useState("TEST");

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Start / Join</h1>

      <div className="mb-6">
        <label className="block text-sm mb-1 font-semibold">
          Session-ID
        </label>
        <input
          className="border rounded px-2 py-1 w-full text-sm"
          value={session}
          onChange={e => setSession(e.target.value)}
        />
        <p className="text-xs text-gray-500 mt-1">
          Alle drei Rollen (Host, Team A, Team B) müssen dieselbe Session-ID verwenden.
        </p>
      </div>

      <div className="space-y-3">
        <Link
          to={`/host?s=${encodeURIComponent(session)}`}
          className="block px-4 py-2 rounded bg-black text-white text-sm text-center"
        >
          Host starten
        </Link>

        <Link
          to={`/join?s=${encodeURIComponent(session)}&r=A`}
          className="block px-4 py-2 rounded bg-gray-100 text-sm text-center border"
        >
          Team A beitreten
        </Link>

        <Link
          to={`/join?s=${encodeURIComponent(session)}&r=B`}
          className="block px-4 py-2 rounded bg-gray-100 text-sm text-center border"
        >
          Team B beitreten
        </Link>
      </div>
    </div>
  );
}