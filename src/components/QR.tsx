// src/components/QR.tsx
import React from "react";

export default function QR({ text }: { text: string }) {
  // Minimaler Fallback: zeigt nur den Text in einem Rahmen.
  // Du kannst hier später deine echte QR-Implementierung einbauen.
  return (
    <div className="border rounded p-3 bg-white text-xs break-all">
      {text}
    </div>
  );
}