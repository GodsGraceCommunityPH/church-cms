import { useState } from "react";
import { Lock, User } from "lucide-react";
import PrimaryButton from "../../components/PrimaryButton";
// import { Link } from "react-router-dom";

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    // Temporary
    alert("Login functionality coming next.");
  }

  return (
    <section
      className="flex min-h-screen items-center justify-center bg-[#F8F7F3]"
      style={{
        padding: "40px",
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-10 shadow-xl">
        <p className="mb-3 text-center text-sm font-semibold uppercase tracking-[0.4em] text-[#A3B18A]">
          STAFF PORTAL
        </p>

        <h1 className="font-heading mb-8 text-center text-4xl font-semibold text-slate-900">
          Welcome Back
        </h1>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="mb-2 block font-medium text-slate-700">
              Username
            </label>

            <div className="flex items-center rounded-lg border border-slate-300 px-4">
              <User size={20} className="mr-3 text-slate-400" />

              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                className="w-full py-4 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block font-medium text-slate-700">
              Password
            </label>

            <div className="flex items-center rounded-lg border border-slate-300 px-4">
              <Lock size={20} className="mr-3 text-slate-400" />

              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full py-4 outline-none"
              />
            </div>
          </div>

          <PrimaryButton className="w-full" onClick={() => {}}>
            Sign In
          </PrimaryButton>
        </form>

        <p className="mt-8 text-center text-sm leading-7 text-slate-500">
          This portal is intended for authorized church staff and ministry
          leaders.
          <br />
          <br />
          Need access?
          <br />
          Please contact the <strong>GGCCC IT Ministry.</strong>
        </p>
      </div>
      <div className="absolute left-8 top-8">
        <PrimaryButton
          to="/"
          variant="primary"
          className="px-5 py-2 text-slate-700 border-slate-300 hover:border-[#556B2F] hover:text-[#556B2F]"
        >
          ← Back to Website
        </PrimaryButton>
      </div>
    </section>
  );
}

export default Login;
