import { useEffect, useState } from "react";
import { AccountStatus, AccountUser, UserRole, listAccounts, updateAccount, deleteAccount} from "../api/auth";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

const roleLabels: Record<UserRole, string> = {
  guest: "Worker",
  operator: "Operator",
  administrator: "Administrator",
};

const statusLabels: Record<AccountStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  disabled: "Disabled",
};

export function AccountManagementPanel() {
  const [accounts, setAccounts] = useState<AccountUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadAccounts = async () => {
    setLoading(true);
    setMessage("");

    try {
      const data = await listAccounts();
      setAccounts(data);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not load accounts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const changeAccount = async (
    account: AccountUser,
    changes: Partial<Pick<AccountUser, "role" | "status">>
  ) => {
    setMessage("");

    try {
      const updated = await updateAccount(account.id, changes);
      setAccounts((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      );
      setMessage(`Updated ${updated.username}.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Update failed.");
    }
  };

  const removeAccount = async (account: AccountUser) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${account.username}? This cannot be undone.`
    );

    if (!confirmed) return;

    try {
      const res = await deleteAccount(account.id);
      setAccounts((current) => current.filter((item) => item.id !== account.id));
      setMessage(`${res.message} User: ${account.username}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Delete failed.");
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>Account Access Management</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Admins can approve accounts and assign access tiers from the database.
          </p>
        </div>

        <Button variant="outline" onClick={loadAccounts}>
          Refresh
        </Button>
      </CardHeader>

      <CardContent>
        {message && <p className="mb-4 text-sm text-muted-foreground">{message}</p>}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading accounts...</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left">
                <tr>
                  <th className="p-3">Name</th>
                  <th className="p-3">Username</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Created</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>

              <tbody>
                {accounts.map((account) => (
                  <tr key={account.id} className="border-t">
                    <td className="p-3 font-medium">{account.full_name}</td>
                    <td className="p-3">{account.username}</td>
                    <td className="p-3">{account.email}</td>

                    <td className="p-3">
                      <select
                        className="rounded-md border bg-background px-2 py-1"
                        value={account.role}
                        disabled={account.username === "guest"}
                        onChange={(e) =>
                          changeAccount(account, { role: e.target.value as UserRole })
                        }
                      >
                        {Object.entries(roleLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{statusLabels[account.status]}</Badge>

                        <select
                          className="rounded-md border bg-background px-2 py-1"
                          value={account.status}
                          disabled={account.username === "guest"}
                          onChange={(e) =>
                            changeAccount(account, {
                              status: e.target.value as AccountStatus,
                            })
                          }
                        >
                          {Object.entries(statusLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>

                    <td className="p-3 text-muted-foreground">{account.created_at}</td>

                    <td className="p-3">
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={account.username === "guest"}
                        onClick={() => removeAccount(account)}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
