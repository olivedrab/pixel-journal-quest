import { createFileRoute, Link } from "@tanstack/react-router";

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
      <Link to="/auth" className="pixel-btn pixel-btn-primary inline-block">
        Press start
      </Link>
    </main>
  );
}
