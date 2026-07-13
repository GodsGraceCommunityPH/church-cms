import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Lock, LogIn, User, Info } from "lucide-react";

import logo from "../../assets/ggccc-logo.png";
import PrimaryButton from "../../components/PrimaryButton";

function Login() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    const ADMIN_USERNAME = "admin";
    const ADMIN_PASSWORD = "ggccc123";

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      navigate("/admin/dashboard");
      return;
    }

    alert(
      "Invalid username or password.\n\nPlease contact the GGCCC IT Ministry if you need access.",
    );
  }

  return (
    <section className="flex min-h-screen items-center justify-center bg-[#F8F7F3] px-6 py-12">
      <div className="w-full max-w-md">
        {/* Back */}
        <Link
          to="/"
          className="mb-8 inline-flex items-center gap-2 text-slate-600 transition hover:text-[#556B2F]"
        >
          ← Back to Website
        </Link>

        {/* Card */}
        <div className="rounded-3xl bg-white p-10 shadow-xl">
          {/* Logo */}
          <div
            style={{ padding: "5px 0px" }}
            className="mb-4 flex justify-center"
          >
            <img
              src={logo}
              alt="GGCCC Logo"
              className="h-20 w-20 object-contain"
            />
          </div>

          <p className="text-center text-sm font-semibold uppercase tracking-[0.4em] text-[#A3B18A]">
            Staff Portal
          </p>

          <h1 className="font-heading mt-3 text-center text-4xl font-semibold text-slate-900">
            Welcome Back
          </h1>

          <p className="mt-3 text-center text-slate-500">
            Sign in to access the Church Management System.
          </p>

          <form
            style={{
              padding: "0 20px",
            }}
            onSubmit={handleLogin}
            className="mt-10 space-y-7"
          >
            {/* Username */}
            <div style={{ padding: "10px 0px" }}>
              {/* <label className="mb-2 block font-medium text-slate-700">
                Username
              </label> */}

              <div
                style={{
                  padding: "0 10px",
                }}
                className="flex h-14 items-center gap-3 rounded-lg border border-slate-300 px-4 transition focus-within:border-[#556B2F]"
              >
                <User size={20} className="shrink-0 text-slate-400" />

                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  className="h-full w-full bg-transparent outline-none"
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ padding: "10px 0px" }}>
              {/* <label className="mb-2 block font-medium text-slate-700">
                Password
              </label> */}

              <div
                style={{
                  padding: "0 10px",
                }}
                className="flex h-14 items-center gap-3 rounded-lg border border-slate-300 px-4 transition focus-within:border-[#556B2F]"
              >
                <Lock size={20} className="mr-3 text-slate-400" />

                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="h-full w-full bg-transparent outline-none"
                />
              </div>
            </div>
            <div style={{ padding: "10px 0px" }}>
              <PrimaryButton
                type="submit"
                className="flex h-14 w-full items-center justify-center gap-2"
              >
                <LogIn size={20} />
                Sign In
              </PrimaryButton>
            </div>
          </form>

          {/* Divider */}
          <div className="my-10 h-px bg-slate-200" />

          {/* Notice */}
          <div
            style={{
              padding: "20px 10px",
            }}
            className="rounded-xl bg-slate-50 p-5"
          >
            <div className="flex items-start gap-3">
              <Info size={22} className="mt-0.5 text-[#556B2F]" />

              <div>
                <p className="font-semibold text-slate-800">Need access?</p>

                <p className="mt-1 text-sm leading-6 text-slate-600">
                  This portal is for authorized church staff and ministry
                  leaders. Please contact the{" "}
                  <Link
                    to="/contact"
                    className="font-semibold text-[#556B2F] transition hover:underline"
                  >
                    GGCCC IT Ministry
                  </Link>{" "}
                  if you need an account. if you need an account.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Login;
