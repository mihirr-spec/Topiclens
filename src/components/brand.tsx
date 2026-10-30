import type { ReactNode } from "react";
import type { Account } from "../auth";

/** Serif wordmark: "Topic" in ink, "Lens" in the accent navy. */
export function Wordmark() {
  return (
    <span className="wordmark">
      Topic<span>Lens</span>
    </span>
  );
}

/** Small monospace label with a hairline rule, used above section headlines. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="eyebrow">{children}</p>;
}

export function Avatar({ account }: { account: Pick<Account, "name" | "picture"> }) {
  return account.picture ? (
    <img className="avatar" src={account.picture} alt="" referrerPolicy="no-referrer" />
  ) : (
    <span className="avatar" aria-hidden="true">{account.name.charAt(0).toUpperCase()}</span>
  );
}
