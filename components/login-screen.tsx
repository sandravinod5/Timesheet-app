"use client";

import Image from "next/image";
import { useState } from "react";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { Button, InputShell, Panel } from "@/components/ui";

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const contentType = response.headers.get("content-type") || "";
      const payload = contentType.includes("application/json")
        ? ((await response.json().catch(() => ({}))) as { error?: string })
        : null;

      if (!response.ok) {
        setError(payload?.error || `Unable to sign in (${response.status}).`);
        return;
      }

      window.location.assign("/");
    } catch {
      setError("Sign in could not be completed right now. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-glow" />
      <div className="auth-glow-alt" />
      <div className="auth-glow-third" />

      <Panel className="auth-card">
        <div className="auth-brand-block">
          <p className="auth-kicker">Secure sign in</p>
          <div className="auth-logo-wrap">
            <Image
              src="/marks-leaps.png"
              alt="Marks and Leaps logo"
              width={320}
              height={140}
              className="auth-logo"
              priority
            />
          </div>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div>
            <p className="eyebrow">Email</p>
            <InputShell>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Enter your work email"
                autoComplete="email"
              />
            </InputShell>
          </div>

          <div>
            <p className="eyebrow">Password</p>
            <InputShell>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="password-toggle"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                onClick={(e) => { e.preventDefault(); setShowPassword((current) => !current); }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </InputShell>
          </div>

          {error ? <p className="error-text">{error}</p> : null}

          <Button className="auth-submit-button" disabled={loading} type="submit">
            {loading ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
                <LoaderCircle size={18} className="spin" />
                Signing In...
              </span>
            ) : (
              "Sign In"
            )}
          </Button>
        </form>

        <p className="auth-hint">Protected employee access for Marks & Leaps.</p>
      </Panel>
    </div>
  );
}
