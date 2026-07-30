import { apiGet, apiPost, apiPut, apiDelete } from "./http";

export type UserRole = "guest" | "operator" | "administrator";
export type AccountStatus = "pending" | "approved" | "disabled";

export interface AccountUser {
  id: number;
  full_name: string;
  username: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  created_at: string;
}

export async function login(username: string, password: string): Promise<AccountUser> {
  const res = await apiPost<{ user: AccountUser }>("/auth/login", { username, password });
  return res.user;
}

export async function registerAccount(payload: {
  full_name: string;
  username: string;
  email: string;
  password: string;
}): Promise<AccountUser> {
  const res = await apiPost<{ user: AccountUser }>("/auth/register", payload);
  return res.user;
}

export async function deleteAccount(accountId: number): Promise<{ message: string }> {
  return apiDelete<{ message: string }>(`/auth/accounts/${accountId}`);
}

export function listAccounts(): Promise<AccountUser[]> {
  return apiGet<AccountUser[]>("/auth/accounts");
}

export async function updateAccount(
  accountId: number,
  payload: Partial<Pick<AccountUser, "role" | "status">>
): Promise<AccountUser> {
  const res = await apiPut<{ user: AccountUser }>(`/auth/accounts/${accountId}`, payload);
  return res.user;
}