<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Screenshot extraction runs in an authenticated server function so private trade data and the Lovable API key remain server-side.
- Trade execution details are nullable columns on trades, with exchange-local timestamp strings and shared normalization, to preserve displayed times without assuming a timezone or breaking existing entries.
- Normalize execution text from notes on trade reads, imports, and validated saves so legacy records display dedicated fields and future saves do not duplicate execution details in journal commentary.

- Backtests use a dedicated minimal input schema and per-entry confirmed outcomes/rule checklists, separate from live execution inputs, so chart price differences never become monetary P&L.
- Backtest screenshot scanning fills the editable backtest form and uploads the original file only when saving, using owner-scoped private storage and signed previews to keep charts private.
