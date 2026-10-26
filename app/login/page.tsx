"use client";

import { useActionState } from "react";
import { login } from "../actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, null);
  return (
    <div className="login-wrap">
      <div className="card login">
        <h1>Order Desk</h1>
        <div className="muted">Sign in to manage orders.</div>
        <form action={action}>
          {state?.error && <div className="alert alert-error" style={{ margin: 0 }}>{state.error}</div>}
          <label className="field">
            Admin password
            <input type="password" name="password" autoFocus required autoComplete="current-password" />
          </label>
          <button className="btn btn-primary" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
