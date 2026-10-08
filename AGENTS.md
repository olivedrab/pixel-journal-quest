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
