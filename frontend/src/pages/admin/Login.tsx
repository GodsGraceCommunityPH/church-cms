import { useEffect, useState } from "react";
import { Info, Lock, LogIn, Mail } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import logo from "../../assets/ggccc-logo.png";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import { useAuth } from "../../features/auth/auth";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, loading: authLoading, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const destination = location.state?.from || "/admin/dashboard";

  useEffect(() => {
    if (!authLoading && session) {
      navigate(destination, { replace: true });
    }
  }, [authLoading, destination, navigate, session]);

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await signIn(email.trim(), password);
    } catch {
      setError("Invalid email or password. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading || session) {
    return <p className="py-16 text-center text-slate-500">Checking session...</p>;
  }

  return (
    <section className="flex min-h-screen items-center justify-center bg-[#F8F7F3] px-6 py-12">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="mb-8 inline-flex items-center gap-2 text-slate-600 transition hover:text-[#556B2F]"
        >
          ← Back to Website
        </Link>

        <div className="rounded-3xl bg-white p-8 shadow-xl sm:p-10">
          <div className="mb-4 flex justify-center">
            <img
              src={logo}
              alt="GGCCC Logo"
              className="h-20 w-20 object-contain"
            />
          </div>
          <p className="text-center text-sm font-semibold uppercase tracking-[0.4em] text-[#A3B18A]">
            Staff Portal
          </p>
          <h1 className="mt-3 text-center text-4xl font-semibold text-slate-900">
            Welcome Back
          </h1>
          <p className="mt-3 text-center text-slate-500">
            Sign in with your authorized church account.
          </p>

          <form className="mt-8 space-y-5" onSubmit={handleLogin}>
            {error && (
              <p
                role="alert"
                className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </p>
            )}
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Email
              </span>
              <div className="relative">
                <Mail
                  size={18}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <Input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="pl-10"
                  placeholder="you@example.com"
                />
              </div>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Password
              </span>
              <div className="relative">
                <Lock
                  size={18}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <Input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="pl-10"
                />
              </div>
            </label>
            <Button
              type="submit"
              className="h-12 w-full gap-2"
              disabled={submitting}
            >
              <LogIn size={18} />
              {submitting ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <div className="mt-8 flex gap-3 rounded-xl bg-slate-50 p-4">
            <Info size={20} className="mt-0.5 shrink-0 text-[#556B2F]" />
            <p className="text-sm leading-6 text-slate-600">
              Need access? Contact the{" "}
              <Link to="/contact" className="font-semibold text-[#556B2F]">
                GGCCC IT Ministry
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
