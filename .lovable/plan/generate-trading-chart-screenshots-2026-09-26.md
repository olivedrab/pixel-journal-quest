# Generate trading chart screenshots

## What will be added
- Add a **Generate chart** action to every saved trade in the daily detail view.
- After screenshot import, offer **Generate all charts** to create one image per selected trade, matching the provided multi-row example.
- Generate a realistic trading-platform chart image from that trade’s symbol, direction, entry, exit, stop, target, size, date, and P&L.
- Show generation progress and a preview in a pixel-themed dialog.
- Let the user download the finished PNG or regenerate it.
- Surface image-service errors directly and keep existing trade logging and screenshot-import behavior unchanged.

## Technical details
- Add an authenticated image-generation route that validates the signed-in user before calling Lovable AI Gateway.
- Use the assigned image model `openai/gpt-image-2.5-sunburst`, the OpenAI image endpoint, streaming previews, and a landscape 1536×1024 result.
- Keep the API key and generated prompt server-side; only validated trade fields are accepted from the browser.
- Add the standard streaming image parser and the small required parser dependency.
- Add a focused chart preview dialog and connect it to saved trade cards.
- Add a small batch queue that generates selected trades sequentially, shows per-trade progress, and lets each PNG be downloaded.
- Verify the build, signed-in single and batch generation flows, preview rendering, and PNG downloads.
