// src/routes/Join.tsx
import React, { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  type Team,
  type Mode,
  type Reaction,
  playArgument,
  reactToOpponent,
  subscribeHost,
  sendTrustInvest,
  type AnyMsg,
  type StateSnapshot
} from "../lib/transport";

// --------------------------------------------------------
// Argument-Definitionen für Auftragnehmer (A) & Auftraggeber (B)
// --------------------------------------------------------

type ArgumentDefinition = {
  id: number;
  strength: number; // 1–10
  category: "weak" | "medium" | "strong";
  title: string;
  subtitle: string;
  details: string;
};

type Card = ArgumentDefinition & {
  used: boolean;
};

const AN_ARGUMENTS: ArgumentDefinition[] = [
  {
    id: 1,
    strength: 2,
    category: "weak",
    title: "Kleinteilige Zusatzarbeiten ohne klare Beauftragung",
    subtitle: "Viele kleine Handgriffe, aber kaum dokumentiert.",
    details:
      "Im Laufe der Baustelle wurden immer wieder kurze Zusatzaufgaben übernommen (kleine Anpassungen, zusätzliche Bohrungen, kurzfristige Hilfe bei anderen Gewerken). Diese wurden oft mündlich angefragt, aber nicht sauber protokolliert. Für sich genommen sind sie klein, in Summe haben sie aber messbaren Mehraufwand verursacht."
  },
  {
    id: 2,
    strength: 4,
    category: "medium",
    title: "Mehrkoordination mit Drittgewerken",
    subtitle: "Zusätzliche Abstimmungen mit anderen Firmen.",
    details:
      "Ursprünglich war die Koordination mit anderen Gewerken in einem überschaubaren Rahmen geplant. Tatsächlich mussten deutlich mehr Abstimmungstermine wahrgenommen werden (Baubesprechungen, kurzfristige Vor-Ort-Klärungen), um Schnittstellenprobleme zu vermeiden. Diese zusätzliche Koordination wurde im Angebot nicht kalkuliert."
  },
  {
    id: 3,
    strength: 5,
    category: "medium",
    title: "Gestiegene Materialpreise mit Nachweisen",
    subtitle: "Dokumentierte Preissteigerungen der Lieferanten.",
    details:
      "Nach Vertragsabschluss sind die Einkaufspreise für bestimmte Materialien deutlich gestiegen. Es liegen aktuelle Angebote und Preislisten der Lieferanten vor, die diese Steigerung belegen. In der ursprünglichen Kalkulation waren diese Mehrkosten nicht enthalten."
  },
  {
    id: 4,
    strength: 6,
    category: "medium",
    title: "Entscheidungsverzögerungen durch den Auftraggeber",
    subtitle: "Freigaben kamen später als im Terminplan vorgesehen.",
    details:
      "Mehrfach mussten wir auf Entscheidungen und Freigaben des Auftraggebers warten (z. B. Bemusterungen, Freigabe von Ausführungsdetails). Diese Verzögerungen sind in Besprechungsprotokollen dokumentiert und haben zu Leerlauf, Umplanungen und zusätzlicher Koordination geführt."
  },
  {
    id: 5,
    strength: 7,
    category: "medium",
    title: "Planänderungen mit Mehrmengen",
    subtitle: "Erweiterter Leistungsumfang gegenüber der Ursprungsversion.",
    details:
      "Im Laufe des Projekts gab es Änderungen in der Planung (z. B. zusätzliche Leitungen, vergrößerte Flächen, geänderte konstruktive Details). Diese führen zu klar messbaren Mehrmengen. Die Änderungen sind in den Planständen und Protokollen nachvollziehbar dokumentiert."
  },
  {
    id: 6,
    strength: 8,
    category: "strong",
    title: "Neue Anforderungen aus Normen / Richtlinien",
    subtitle: "Nachvertragliche Vorgaben erhöhen den Aufwand.",
    details:
      "Nach Vertragsabschluss wurden neue oder konkretisierte Anforderungen eingeführt (z. B. geänderte technische Richtlinien, verschärfte Dokumentationspflichten). Um diese zu erfüllen, waren zusätzliche Leistungen und ausführlichere Nachweise erforderlich, die in der ursprünglichen Kalkulation nicht berücksichtigt waren."
  },
  {
    id: 7,
    strength: 9,
    category: "strong",
    title: "Zusatzleistungen außerhalb des ursprünglichen LV",
    subtitle: "Leistungen, die im Vertrag nicht vorgesehen waren.",
    details:
      "Der Auftraggeber hat uns mit Leistungen beauftragt, die klar außerhalb des ursprünglichen Leistungsverzeichnisses liegen (z. B. zusätzliche Räume, Erweiterung des Funktionsumfangs). Diese Leistungen sind separat beschrieben und können eindeutig von der Ursprungsleistung abgegrenzt werden."
  },
  {
    id: 8,
    strength: 10,
    category: "strong",
    title: "Schriftlich genehmigte Planänderung mit Nachtragsankündigung",
    subtitle: "Veränderte Ausführung mit vorab angekündigtem Mehrpreis.",
    details:
      "Vor der Ausführung wesentlicher Planänderungen wurde der Mehrbedarf angekündigt (z. B. per E-Mail oder Protokoll) und vom Auftraggeber freigegeben. Die genehmigten Änderungen sind dokumentiert, und der Zusammenhang zwischen Änderung und Mehrkosten ist transparent nachvollziehbar."
  }
];

const AG_ARGUMENTS: ArgumentDefinition[] = [
  {
    id: 1,
    strength: 3,
    category: "weak",
    title: "Optische Mängel und unsaubere Details",
    subtitle: "Nicht sicherheitsrelevant, aber sichtbar störend.",
    details:
      "Es gibt kleinere optische Unsauberkeiten (z. B. Silikonfugen, Putzoberflächen, kleine Beschädigungen), die funktional nicht kritisch sind, aber den Gesamteindruck beeinträchtigen. Sie wurden teilweise dokumentiert, sind aber nicht in allen Fällen mit Fotos oder Protokollen belegt."
  },
  {
    id: 2,
    strength: 5,
    category: "medium",
    title: "Wiederholte Terminüberschreitungen",
    subtitle: "Mehrfach kleine Verzögerungen, die sich summieren.",
    details:
      "Mehrere Zwischentermine wurden nicht wie vereinbart eingehalten. Jede Verzögerung war für sich genommen überschaubar, in der Summe kam es aber zu spürbaren Verschiebungen im Gesamtablauf. Diese Terminabweichungen sind in Bautagebüchern oder Besprechungsprotokollen dokumentiert."
  },
  {
    id: 3,
    strength: 6,
    category: "medium",
    title: "Abweichungen von der Leistungsbeschreibung",
    subtitle: "Ausführung weicht teilweise vom vertraglichen Soll ab.",
    details:
      "An einigen Stellen entspricht die Ausführung nicht vollständig der vereinbarten Leistungsbeschreibung (z. B. andere Fabrikate, abweichende Ausführungsdetails, nicht exakt eingehaltene Spezifikationen). Die Abweichungen wurden auf der Baustelle festgestellt und sind in Mängellisten vermerkt."
  },
  {
    id: 4,
    strength: 7,
    category: "medium",
    title: "Nicht eingehaltene Toleranzen",
    subtitle: "Maß- oder Qualitätsabweichungen über Grenzwert.",
    details:
      "Es liegen Prüfungen bzw. Messungen vor, die zeigen, dass bestimmte Toleranzen nicht eingehalten wurden (z. B. Ebenheit, Maßhaltigkeit, Dämmstärken). Die Überschreitungen führen zu funktionalen Einschränkungen oder höherem Aufwand bei Folgegewerken."
  },
  {
    id: 5,
    strength: 8,
    category: "strong",
    title: "Beeinträchtigung der Nutzung",
    subtitle: "Die Mängel stören den laufenden Betrieb.",
    details:
      "Die festgestellten Mängel führen dazu, dass Räume oder Anlagen nicht wie geplant genutzt werden können (z. B. wiederkehrende Störungen, erhöhter Wartungsaufwand, Komforteinbußen). Dies verursacht zusätzliche interne Kosten und Unzufriedenheit bei Nutzern oder Kunden."
  },
  {
    id: 6,
    strength: 7,
    category: "medium",
    title: "Mehrfache Nacharbeiten durch den Auftragnehmer",
    subtitle: "Nachbesserungen waren wiederholt erforderlich.",
    details:
      "Für bestimmte Leistungen waren mehrere Nachbesserungen notwendig, weil der erste Mangel nicht vollständig behoben wurde. Jede Nacharbeit führte zu zusätzlicher Abstimmung, Terminverschiebungen und teilweise zu Stillständen in angrenzenden Bereichen."
  },
  {
    id: 7,
    strength: 8,
    category: "strong",
    title: "Wiederholte Mängel gleicher Art",
    subtitle: "Das Qualitätsniveau wirkt insgesamt instabil.",
    details:
      "Ähnliche Mängel treten an mehreren Stellen oder Bauteilen auf (z. B. gleiche Undichtigkeiten, gleiche Montagefehler). Dies deutet auf systematische Probleme in der Ausführung oder Qualitätssicherung hin und erhöht das Risiko weiterer versteckter Mängel."
  },
  {
    id: 8,
    strength: 9,
    category: "strong",
    title: "Gefahr von Vertragsstrafen oder Folgekosten",
    subtitle: "Qualität und Termine gefährden vertragliche Zusagen.",
    details:
      "Aufgrund der Mängel und Verzögerungen drohen Vertragsstrafen, Pönalen oder wirtschaftliche Nachteile gegenüber Dritten (z. B. Mietausfälle, Produktionsstörungen). Diese Risiken sind vertraglich verankert oder wurden gegenüber unseren eigenen Kunden bereits adressiert."
  }
];

// streng genommen: nur Hilfsfunktion, falls wir später ändern wollen
function buildInitialHand(team: Team): Card[] {
  const base = team === "A" ? AN_ARGUMENTS : AG_ARGUMENTS;
  return base.map((arg) => ({
    ...arg,
    used: false
  }));
}

function clampPercent(v: number): number {
  if (v < 0) return 0;
  if (v > 100) return 100;
  return v;
}

const INVEST_OPTIONS = [0, 3, 5, 7, 10];

function categoryLabel(cat: "weak" | "medium" | "strong"): string {
  if (cat === "weak") return "schwächeres Argument";
  if (cat === "medium") return "mittleres Argument";
  return "sehr starkes Argument";
}

function categoryColorClasses(
  cat: "weak" | "medium" | "strong",
  selected: boolean,
  used: boolean
): string {
  const base =
    cat === "weak"
      ? "bg-blue-50 border-blue-300"
      : cat === "medium"
      ? "bg-yellow-50 border-yellow-300"
      : "bg-red-50 border-red-300";

  const selectedRing = selected ? " ring-2 ring-black" : "";
  const usedStyle = used ? " opacity-50" : "";

  return `border rounded-lg px-3 py-2 text-xs text-left ${base}${selectedRing}${usedStyle}`;
}

export default function Join() {
  const [sp] = useSearchParams();
  const team = (sp.get("r") ?? "A") as Team;
  const session = sp.get("s") ?? "TEST";

  const [round, setRound] = useState(1);
  const [hand, setHand] = useState<Card[]>(() => buildInitialHand(team));

  const [selectedCardId, setSelectedCardId] = useState<number | null>(
    null
  );
  const selectedCard = hand.find((c) => c.id === selectedCardId) ?? null;

  const [mode, setMode] = useState<Mode>("fair");
  const [argSent, setArgSent] = useState(false);

  const [reveal, setReveal] =
    useState<null | "weak" | "medium" | "strong">(null);
  const [reactionEnabled, setReactionEnabled] = useState(false);
  const [status, setStatus] = useState<string>(
    "Wähle ein Argument und sende es."
  );

  const [score, setScore] = useState(0);
  const [fairScore, setFairScore] = useState(0);
  const [trust, setTrust] = useState(50);

  const [selectedInvest, setSelectedInvest] = useState<number>(0);
  const [investSent, setInvestSent] = useState(false);

  const [summary, setSummary] =
    useState<StateSnapshot["summary"] | null>(null);

  const isTrustRound = round === 4 || round === 8;
  const isFinished = summary !== null;

  useEffect(() => {
    const stop = subscribeHost(session, (msg: AnyMsg) => {
      if (msg.type === "reveal" && msg.to === team) {
        setReveal(msg.oppCategory);
        setReactionEnabled(true);
        setStatus("Reveal erhalten – reagiere jetzt.");
      }

      if (msg.type === "next") {
        setRound(msg.round);
        setReveal(null);
        setArgSent(false);
        setSelectedCardId(null);
        setReactionEnabled(false);
        setSelectedInvest(0);
        setInvestSent(false);
        setStatus("Neue Runde – bitte Argument wählen.");
      }

      if (msg.type === "reset") {
        setRound(1);
        setHand(buildInitialHand(team));
        setArgSent(false);
        setSelectedCardId(null);
        setReveal(null);
        setReactionEnabled(false);
        setSelectedInvest(0);
        setInvestSent(false);
        setSummary(null);
        setStatus("Session zurückgesetzt.");
        setScore(0);
        setFairScore(0);
        setTrust(50);
      }

      if (msg.type === "stateUpdate") {
        const self = team === "A" ? msg.A : msg.B;
        setScore(self.score ?? 0);
        setFairScore(self.fairScore ?? 0);
        setTrust(self.trust ?? 50);
        if (self.summary) {
          setSummary(self.summary);
          setStatus("Spiel beendet – Auswertung verfügbar.");
        }
      }
    });

    return () => stop();
  }, [session, team]);

  const sendArg = () => {
    if (isFinished || isTrustRound) return;
    if (!selectedCard) {
      setStatus("Bitte eine Karte auswählen.");
      return;
    }
    if (selectedCard.used) {
      setStatus("Diese Karte wurde bereits gespielt.");
      return;
    }

    playArgument(session, {
      who: team,
      base: selectedCard.strength,
      mode
    });

    setHand((h) =>
      h.map((c) =>
        c.id === selectedCard.id ? { ...c, used: true } : c
      )
    );
    setArgSent(true);
    setStatus("Argument gesendet – warte auf Reveal.");
  };

  const react = (r: Reaction) => {
    if (isFinished || isTrustRound) return;
    if (!reactionEnabled) return;
    reactToOpponent(session, {
      who: team,
      reaction: r
    });
    setReactionEnabled(false);
    setStatus("Reaktion gesendet – warte auf nächste Runde.");
  };

  const sendInvestment = () => {
    if (isFinished || !isTrustRound) return;
    if (investSent) return;

    const clean = Math.max(
      0,
      Math.min(10, Math.round(selectedInvest))
    );
    sendTrustInvest(session, team, clean);
    setInvestSent(true);
    setStatus(
      `Investition (${clean}%) gesendet – warte auf nächste Runde.`
    );
  };

  const diff = score - fairScore;
  const scorePercent = clampPercent(score);
  const fairPercent = clampPercent(fairScore);
  const trustPercent = clampPercent(trust);

  const renderSummary = () => {
    if (!summary) return null;
    const { cooperation, fairness, sensitivity, opportunism } = summary;

    const level = (v: number, highIsGood: boolean) => {
      if (v < 33) return highIsGood ? "niedrig" : "hoch";
      if (v < 66) return "mittel";
      return highIsGood ? "hoch" : "niedrig";
    };

    const explain = (label: string, value: number) => {
      if (label === "Kooperationsindex") {
        if (value < 33)
          return "Du blockierst die Gegenseite häufig und gehst eher selten auf Angebote ein.";
        if (value < 66)
          return "Du hältst die Balance zwischen Entgegenkommen und Blockieren.";
        return "Du gehst meist auf Angebote der Gegenseite ein und spielst deutlich kooperativ.";
      }
      if (label === "Fairnessindex") {
        if (value < 33)
          return "Du spielst deine Argumente häufig stärker aus, als sie eigentlich sind.";
        if (value < 66)
          return "Du mischst faire und leicht übertriebene Argumente.";
        return "Du spielst deine Argumente überwiegend fair und nur selten übertrieben.";
      }
      if (label === "Reaktionssensibilität") {
        if (value < 33)
          return "Dein Verhalten verändert sich kaum, wenn Vertrauen steigt oder sinkt.";
        if (value < 66)
          return "Du reagierst teilweise auf Veränderungen im Vertrauen der Gegenseite.";
        return "Du reagierst deutlich auf Vertrauensaufbau der Gegenseite und passt dein Verhalten entsprechend an.";
      }
      if (label === "Opportunismusindex") {
        if (value < 33)
          return "Du nutzt Vertrauen der Gegenseite kaum für kurzfristige Vorteile aus.";
        if (value < 66)
          return "Du nutzt Chancen situativ, ohne durchgehend opportunistisch zu agieren.";
        return "Du nutzt hohes Vertrauen der Gegenseite häufig für eigene Vorteile.";
      }
      return "";
    };

    const items = [
      {
        label: "Kooperationsindex",
        value: cooperation,
        good: true
      },
      {
        label: "Fairnessindex",
        value: fairness,
        good: true
      },
      {
        label: "Reaktionssensibilität",
        value: sensitivity,
        good: true
      },
      {
        label: "Opportunismusindex",
        value: opportunism,
        good: false
      }
    ];

    return (
      <section className="border rounded-xl p-4 bg-white shadow mt-6">
        <h2 className="font-semibold mb-2 text-sm">
          Auswertung deines Spielstils
        </h2>
        <p className="text-xs text-gray-600 mb-3">
          Alle Werte liegen zwischen 0 und 100. 50 ist der neutrale
          Bereich. Höhere Werte bedeuten mehr von der jeweiligen
          Eigenschaft (beim Opportunismus eher vorsichtig interpretieren).
        </p>

        {items.map((item) => (
          <div key={item.label} className="mb-3">
            <div className="flex justify-between text-xs mb-1">
              <span>{item.label}</span>
              <span>{item.value.toFixed(0)} / 100</span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-1">
              <div
                className="h-2"
                style={{
                  width: `${clampPercent(item.value)}%`,
                  background: "#000"
                }}
              />
            </div>
            <div className="text-[11px] text-gray-600 mb-0.5">
              Niveau: {level(item.value, item.good)}
            </div>
            <div className="text-[11px] text-gray-700">
              {explain(item.label, item.value)}
            </div>
          </div>
        ))}

        <p className="text-xs text-gray-700 mt-3">
          Nutzt diese Auswertung im Plenum: Wo habt ihr Vertrauen
          aufgebaut, wo eher gepokert, wo liegen Chancen, euch
          kooperativer oder strategischer aufzustellen?
        </p>
      </section>
    );
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <nav className="mb-4 text-sm text-gray-500">
        <Link to="/">Start</Link> / Join ({team})
      </nav>

      <h1 className="text-xl font-semibold mb-2">
        Runde {round} / 10 – Team {team}
      </h1>
      <p className="text-xs text-gray-500 mb-4">
        Team {team === "A" ? "A = Auftragnehmer (Nachträge)" : "B = Auftraggeber (Qualität & Termine)"}
      </p>

      {/* eigene Kennzahlen */}
      <div className="border rounded-xl p-4 bg-white shadow mb-6">
        <div className="text-sm font-semibold mb-1">
          Team {team} – eigene Werte
        </div>

        <div className="text-[11px] mb-1">Score</div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-1">
          <div
            className="h-2"
            style={{ width: `${scorePercent}%`, background: "#000" }}
          />
        </div>
        <div className="text-xs mb-2">Score: {score.toFixed(1)}</div>

        <div className="text-[11px] mb-1">Fair-Score</div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-1">
          <div
            className="h-2"
            style={{ width: `${fairPercent}%`, background: "#555" }}
          />
        </div>
        <div className="text-xs mb-2">
          Fair-Score (wenn beide fair gespielt hätten):{" "}
          {fairScore.toFixed(1)}
        </div>

        <div className="text-xs mb-3">
          Δ (aktuell − fair): {diff.toFixed(1)}
        </div>

        <div className="text-[11px] mb-1">Trust</div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-1">
          <div
            className="h-2"
            style={{ width: `${trustPercent}%`, background: "#2563eb" }}
          />
        </div>
        <div className="text-xs text-gray-500">
          Trust: {trust.toFixed(0)}
        </div>
      </div>

      {isFinished ? (
        renderSummary()
      ) : isTrustRound ? (
        <section className="border rounded-xl p-4 bg-white shadow mb-6">
          <h2 className="font-semibold mb-2 text-sm">
            Trust-Runde – Investition in Vertrauen
          </h2>
          <p className="text-xs text-gray-600 mb-3">
            In dieser Runde spielst du kein Argument. Du kannst einen
            Prozentsatz deines Scores investieren, damit die Gegenseite
            mehr Vertrauen in dich gewinnt.
          </p>

          <div className="flex flex-wrap gap-2 mb-3 text-sm">
            {INVEST_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                disabled={investSent}
                onClick={() => setSelectedInvest(opt)}
                className={[
                  "px-3 py-1 border rounded text-xs",
                  selectedInvest === opt
                    ? "border-black"
                    : "border-gray-300",
                  investSent ? "bg-gray-200 text-gray-400" : "bg-white"
                ].join(" ")}
              >
                {opt}%
              </button>
            ))}
          </div>

          <button
            onClick={sendInvestment}
            disabled={investSent}
            className="px-4 py-2 text-sm bg-black text-white rounded disabled:bg-gray-300"
          >
            Investition senden
          </button>
        </section>
      ) : (
        <>
          {/* Argument wählen */}
          <section className="border rounded-xl p-4 bg-white shadow mb-6">
            <h2 className="font-semibold mb-2 text-sm">
              1) Argument wählen
            </h2>
            <p className="text-xs text-gray-600 mb-3">
              Tippe eine Karte an. Farbe = Stärke des Arguments
              (blau = eher schwach, gelb = mittel, rot = sehr stark).
              Beim Antippen siehst du eine kurze Erklärung.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
              {hand.map((card) => {
                const selected = selectedCardId === card.id;
                return (
                  <button
                    key={card.id}
                    type="button"
                    disabled={argSent || card.used}
                    onClick={() => setSelectedCardId(card.id)}
                    className={categoryColorClasses(
                      card.category,
                      selected,
                      card.used
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] uppercase tracking-wide">
                        {categoryLabel(card.category)}
                      </span>
                      <span className="text-[10px] font-mono">
                        Stärke {card.strength}
                      </span>
                    </div>
                    <div className="text-[11px] font-semibold mb-0.5">
                      {card.title}
                    </div>
                    <div className="text-[10px] text-gray-700 mb-0.5">
                      {card.subtitle}
                    </div>
                    {selected && (
                      <div className="text-[10px] text-gray-600 mt-1">
                        {card.details}
                      </div>
                    )}
                    {card.used && (
                      <div className="mt-1 text-[10px] text-gray-500">
                        (bereits gespielt)
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-4 text-sm mb-3">
              <label className="text-xs">
                <input
                  type="radio"
                  checked={mode === "fair"}
                  onChange={() => setMode("fair")}
                  disabled={argSent}
                />{" "}
                fair / offen
              </label>
              <label className="text-xs">
                <input
                  type="radio"
                  checked={mode === "leicht"}
                  onChange={() => setMode("leicht")}
                  disabled={argSent}
                />{" "}
                leicht überzogen
              </label>
              <label className="text-xs">
                <input
                  type="radio"
                  checked={mode === "deutlich"}
                  onChange={() => setMode("deutlich")}
                  disabled={argSent}
                />{" "}
                stark überzogen
              </label>
            </div>

            <button
              onClick={sendArg}
              disabled={argSent}
              className="px-4 py-2 text-sm bg-black text-white rounded disabled:bg-gray-300"
            >
              Argument senden
            </button>
          </section>

          {/* Reaktion */}
          <section className="border rounded-xl p-4 bg-white shadow">
            <h2 className="font-semibold mb-2 text-sm">
              2) Reaktion auf Gegner
            </h2>

            <p className="text-xs text-gray-600 mb-2">
              {reveal === null
                ? "Warte auf Reveal..."
                : reveal === "weak"
                ? "Die Gegenseite spielt ein eher schwächeres Argument."
                : reveal === "medium"
                ? "Die Gegenseite spielt ein mittleres Argument."
                : "Die Gegenseite spielt ein sehr starkes Argument."}
            </p>

            <div className="flex gap-2 flex-wrap">
              <button
                disabled={!reactionEnabled}
                onClick={() => react("annehmen")}
                className="px-3 py-1 text-xs border rounded bg-white disabled:text-gray-400"
              >
                annehmen
              </button>
              <button
                disabled={!reactionEnabled}
                onClick={() => react("zurückstellen")}
                className="px-3 py-1 text-xs border rounded bg-white disabled:text-gray-400"
              >
                zurückstellen
              </button>
              <button
                disabled={!reactionEnabled}
                onClick={() => react("ablehnen")}
                className="px-3 py-1 text-xs border rounded bg-white disabled:text-gray-400"
              >
                ablehnen
              </button>
            </div>
          </section>
        </>
      )}

      <div className="text-xs text-gray-600 mt-4">{status}</div>
    </div>
  );
}