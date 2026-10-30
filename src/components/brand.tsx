import type { Account } from "../auth";

export function Avatar({ account }: { account: Pick<Account, "name" | "picture"> }) {
  return account.picture ? (
    <img className="avatar" src={account.picture} alt="" referrerPolicy="no-referrer" />
  ) : (
    <span className="avatar" aria-hidden="true">{account.name.charAt(0).toUpperCase()}</span>
  );
}
