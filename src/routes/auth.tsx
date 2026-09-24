import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — PIXEL P&L" },
      {
        name: "description",
        content: "Sign in to your pixel trading journal to log trades and review your calendar.",
      },
      { property: "og:title", content: "Sign in — PIXEL P&L" },
      { property: "og:description", content: "Access your private pixel-art trading journal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/journal", replace: true });
    });
  }, [navigate]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim() || password.length < 6) {
      toast.error("Enter an email and a password of at least 6 characters.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (data.session) {
          navigate({ to: "/journal", replace: true });
        } else {
          toast.success("Check your email to confirm your account.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        navigate({ to: "/journal", replace: true });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      toast.error("Google sign-in failed. Try again.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/journal", replace: true });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-12">
      <Link to="/" className="mb-6 font-pixel text-[0.6rem] text-muted-foreground">
        ← back
      </Link>
      <div className="pixel-panel scanlines p-6">
        <h1 className="pixel-heading mb-6 text-base text-primary">
          {mode === "signin" ? "Log in" : "New player"}
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="font-pixel text-[0.6rem] text-muted-foreground">Email</span>
            <input
              type="email"
              className="pixel-field mt-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={255}
              autoComplete="email"
            />
          </label>
          <label className="block">
            <span className="font-pixel text-[0.6rem] text-muted-foreground">Password</span>
            <input
              type="password"
              className="pixel-field mt-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              maxLength={72}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />
          </label>
          <button type="submit" disabled={busy} className="pixel-btn pixel-btn-primary w-full">
            {mode === "signin" ? "Continue" : "Create account"}
          </button>
        </form>
        <div className="my-5 text-center font-pixel text-[0.6rem] text-muted-foreground">or</div>
        <button
          type="button"
          onClick={handleGoogle}
          disabled={busy}
          className="pixel-btn pixel-btn-ghost w-full"
        >
          Continue with Google
        </button>
        <button
          type="button"
          className="mt-6 w-full text-xl text-muted-foreground underline"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        >
          {mode === "signin" ? "No account yet? Sign up" : "Already have an account? Log in"}
        </button>
      </div>
    </main>
  );
}
