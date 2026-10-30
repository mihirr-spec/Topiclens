import type { Account } from "../auth";

export function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <path d="M15.5 15.5 21 21" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M7.5 12.5v-2M10.5 12.5v-5M13.5 12.5v-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function Avatar({ account }: { account: Pick<Account, "name" | "picture"> }) {
  return account.picture ? (
    <img className="avatar" src={account.picture} alt="" referrerPolicy="no-referrer" />
  ) : (
    <span className="avatar" aria-hidden="true">{account.name.charAt(0).toUpperCase()}</span>
  );
}
