"use client";

import { useEffect, useState } from "react";

// Sales-floor motivation. Rotates every few seconds; starts on a random one.
const QUOTES: { t: string; a: string }[] = [
  { t: "The fortune is in the follow-up.", a: "Sales proverb" },
  { t: "You miss 100% of the calls you don't make.", a: "Wayne Gretzky" },
  { t: "Every ‘no’ gets you closer to a ‘yes’.", a: "Sales floor" },
  { t: "Success is the sum of small efforts, repeated day in and day out.", a: "Robert Collier" },
  { t: "Make the call. Change the day.", a: "Rocky Solutions" },
  { t: "Persistence beats resistance.", a: "Sales floor" },
  { t: "Dial with purpose. Listen with intent.", a: "Rocky Solutions" },
  { t: "The best time to call was an hour ago. The next best time is now.", a: "Sales floor" },
  { t: "Confidence is contagious — so is doubt.", a: "Vince Lombardi" },
  { t: "Don't watch the clock; do what it does — keep going.", a: "Sam Levenson" },
];

export default function Quote({ hero = false }: { hero?: boolean }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    setI(Math.floor(Math.random() * QUOTES.length));
    const t = setInterval(() => setI((v) => (v + 1) % QUOTES.length), 9000);
    return () => clearInterval(t);
  }, []);
  const q = QUOTES[i];
  return (
    <div className={hero ? "quote-hero" : "quote"}>
      “{q.t}”<span>— {q.a}</span>
    </div>
  );
}
