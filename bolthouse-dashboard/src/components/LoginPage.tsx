import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { AccountUser, login, registerAccount } from "../api/auth";

interface LoginPageProps {
  onLogin: (user: AccountUser) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading] = useState(false);

  // Controls visibility of Forgot Password and Register modals
  const [showForgot,   setShowForgot]   = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  // Forgot password form state
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotMsg,   setForgotMsg]   = useState("");

  // Register form state
  const [regName,     setRegName]     = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regEmail,    setRegEmail]    = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm,  setRegConfirm]  = useState("");
  const [regMsg,      setRegMsg]      = useState("");
  

  const handleLogin = async () => {
    if (!username || !password) {
      setError("Please enter your username and password.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const user = await login(username, password);
      onLogin(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const user = await login("guest", "guest");
      onLogin(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Worker login failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = () => {
    if (!forgotEmail) {
      setForgotMsg("Please enter your email address.");
      return;
    }
    setForgotMsg("If this email is registered, a reset link has been sent.");
  };

  const handleRegisterSubmit = async () => {
    if (!regName || !regUsername || !regEmail || !regPassword || !regConfirm) {
      setRegMsg("Please fill in all fields.");
      return;
    }
    if (regPassword !== regConfirm) {
      setRegMsg("Passwords do not match.");
      return;
    }

    setRegMsg("");
    try {
      await registerAccount({
        full_name: regName,
        username: regUsername,
        email: regEmail,
        password: regPassword,
      });
      setRegMsg("Registration submitted! An admin can approve your account.");
      setRegName("");
      setRegUsername("");
      setRegEmail("");
      setRegPassword("");
      setRegConfirm("");
    } catch (err) {
      setRegMsg(err instanceof Error ? err.message : "Registration failed.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center space-y-3">

          {/* Bolthouse Logo — added in PR 3 */}
          <div className="flex flex-col items-center gap-2">
            <img
              src="/bolthouse-logo.png"
              alt="Bolthouse Farms Logo"
              className="h-40 w-70"
            />
            <span className="text-lg font-bold tracking-wide text-purple-600 dark:text-purple-400">
            
            </span>
          </div>

          <CardTitle>System Login</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-2">
            <Button onClick={handleLogin} disabled={loading} className="w-full">
              {loading ? "Logging in..." : "Login"}
            </Button>
            <Button variant="outline" onClick={handleGuestLogin} disabled={loading} className="w-full">
              Worker
            </Button>
          </div>

          {/* Forgot Password + Register links from PR 1 */}
          <div className="flex justify-between pt-1">
            <button
              onClick={() => { setShowForgot(true); setForgotMsg(""); setForgotEmail(""); }}
              className="text-sm text-purple-600 dark:text-purple-400 hover:underline"
            >
              Forgot Password?
            </button>
            <button
              onClick={() => { setShowRegister(true); setRegMsg(""); setRegName(""); setRegUsername(""); setRegEmail(""); setRegPassword(""); setRegConfirm(""); }}
              className="text-sm text-purple-600 dark:text-purple-400 hover:underline"
            >
              Register Account
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Forgot Password Modal */}
      {showForgot && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-sm">
            <CardHeader>
              <CardTitle className="text-lg">Forgot Password</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Enter your email address and we'll send you a reset link.
              </p>
              <div className="space-y-2">
                <Label htmlFor="forgot-email">Email Address</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="Enter your email"
                />
              </div>
              {forgotMsg && (
                <p className="text-sm text-green-600 dark:text-green-400">{forgotMsg}</p>
              )}
              <div className="flex gap-2">
                <Button onClick={handleForgotSubmit} className="w-full">
                  Send Reset Link
                </Button>
                <Button variant="outline" onClick={() => setShowForgot(false)} className="w-full">
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Register Account Modal */}
      {showRegister && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-sm">
            <CardHeader>
              <CardTitle className="text-lg">Register Account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Fill in your details. An admin will review and approve your account.
              </p>
              <div className="space-y-2">
                <Label htmlFor="reg-name">Full Name</Label>
                <Input
                  id="reg-name"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Enter your full name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-username">Username</Label>
                <Input
                  id="reg-username"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  placeholder="Choose a username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-email">Email Address</Label>
                <Input
                  id="reg-email"
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="Enter your email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-password">Password</Label>
                <Input
                  id="reg-password"
                  type="password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Choose a password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-confirm">Confirm Password</Label>
                <Input
                  id="reg-confirm"
                  type="password"
                  value={regConfirm}
                  onChange={(e) => setRegConfirm(e.target.value)}
                  placeholder="Confirm your password"
                />
              </div>
              {regMsg && (
                <p className={`text-sm ${regMsg.includes("submitted") ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                  {regMsg}
                </p>
              )}
              <div className="flex gap-2 pt-1">
                <Button onClick={handleRegisterSubmit} className="w-full">
                  Register
                </Button>
                <Button variant="outline" onClick={() => setShowRegister(false)} className="w-full">
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
