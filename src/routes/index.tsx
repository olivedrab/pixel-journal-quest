import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import heroTerminal from "@/assets/hero-terminal.png";
import pixelCalendar from "@/assets/pixel-calendar.png";
import pixelScreenshotDrop from "@/assets/pixel-screenshot-drop.png";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PIXEL P&L — Pixel Art Trading Journal" },
      {
        name: "description",
        content:
          "Log every trade, see daily totals and profit or loss on a retro pixel calendar, and fill the form automatically from a screenshot.",
      },
      { property: "og:title", content: "PIXEL P&L — Pixel Art Trading Journal" },
      {
        property: "og:description",
        content:
          "A retro pixel-art trading journal with a calendar of daily trade counts and P&L, plus screenshot auto-fill.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setLoggedIn(!!data.session));
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-8 px-5 py-16 text-center">
      <p className="font-pixel text-xs text-gold">★ INSERT COIN ★</p>
      <h1 className="pixel-heading text-2xl leading-relaxed text-primary sm:text-4xl">
        PIXEL P&amp;L
      </h1>
      <p className="max-w-xl text-2xl text-muted-foreground">
        A retro trading journal. Log entries, exits, risk and notes — then watch every day of
        the month light up green or red on your calendar.
      </p>
      <div className="pixel-panel scanlines w-full max-w-xl p-6 text-left">
        <ul className="space-y-3 text-2xl">
          <li>▸ Calendar with trade count and P&amp;L per day</li>
          <li>▸ Click a day for the full trade breakdown</li>
          <li>▸ Manual entry form with risk, tags and notes</li>
          <li>▸ Drop in a screenshot and let it fill the fields</li>
        </ul>
      </div>
      <Link
        to={loggedIn ? "/journal" : "/auth"}
        className="pixel-btn pixel-btn-primary inline-block"
      >
        Press start
      </Link>
      <section className="pixel-panel scanlines w-full max-w-xl p-6 text-left">
        <h2 className="font-pixel mb-4 text-sm text-gold">HOW TO PLAY</h2>
        <ol className="list-decimal space-y-3 pl-6 text-2xl">
          <li>Create an account or sign in — your journal is private to you.</li>
          <li>Open your journal and press <span className="text-primary">New trade</span> to log a
            trade by hand, or drop in a broker screenshot and let the app fill the fields for you.</li>
          <li>Review the scanned details, tweak anything, and save — duplicates are skipped
            automatically.</li>
          <li>Watch the calendar: each day shows your trade count and P&amp;L. Click a day to see
            the full breakdown, edit entries, or attach screenshots.</li>
        </ol>
      </section>
    </main>
  );
}
