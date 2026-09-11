import React, { useState } from "react";
import { useNavigate, Link } from "react-router";
import { Button, Input, Label } from "../components/ui";
import { ShieldCheck, GraduationCap, Users, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export function LandingPage() {
  const navigate = useNavigate();
  const { signInWithEmail, signUpStudent, signUpAdvisor } = useAuth();

  // Navigation / View State: 'login' | 'register'
  const [authMode, setAuthMode] = useState<"login" | "register">("login");

  // Registration Role State: 'student' | 'advisor'
  const [registrationRole, setRegistrationRole] = useState<"student" | "advisor">("student");

  // Login Form State
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Student Registration Form State
  const [studentFullName, setStudentFullName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [studentMatric, setStudentMatric] = useState("");
  const [studentPassword, setStudentPassword] = useState("");
  const [studentSessionCode, setStudentSessionCode] = useState("");
  const [showStudentPassword, setShowStudentPassword] = useState(false);

  // Advisor Registration Form State
  const [advisorFullName, setAdvisorFullName] = useState("");
  const [advisorEmail, setAdvisorEmail] = useState("");
  const [advisorStaffId, setAdvisorStaffId] = useState("");
  const [advisorPassword, setAdvisorPassword] = useState("");
  const [showAdvisorPassword, setShowAdvisorPassword] = useState(false);

  // UI Status State
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const resetFormFeedback = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFormFeedback();

    const cleanEmail = loginEmail.trim();
    if (!cleanEmail) {
      setErrorMessage("Please enter your email address.");
      return;
    }
    if (!loginPassword) {
      setErrorMessage("Please enter your password.");
      return;
    }

    setProcessing(true);

    try {
      const { error, role: loggedInRole } = await signInWithEmail(cleanEmail, loginPassword);

      if (error) throw error;

      if (loggedInRole === "student") {
        navigate("/student");
      } else if (loggedInRole === "advisor") {
        navigate("/advisor");
      } else {
        navigate("/admin");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Invalid credentials. Please verify your email and password.");
    } finally {
      setProcessing(false);
    }
  };

  const handleRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFormFeedback();

    if (registrationRole === "student") {
      if (!studentFullName.trim()) {
        setErrorMessage("Please enter your full name.");
        return;
      }
      if (!studentEmail.trim()) {
        setErrorMessage("Please enter your email address.");
        return;
      }
      if (!studentMatric.trim()) {
        setErrorMessage("Please enter your matric number.");
        return;
      }
      if (!studentPassword || studentPassword.length < 6) {
        setErrorMessage("Password must be at least 6 characters.");
        return;
      }
      if (!studentSessionCode.trim()) {
        setErrorMessage("Please enter your lecturer session code.");
        return;
      }

      setProcessing(true);

      try {
        const { error } = await signUpStudent({
          matricNo: studentMatric.trim().toUpperCase(),
          fullName: studentFullName.trim(),
          email: studentEmail.trim().toLowerCase(),
          password: studentPassword,
          advisorId: studentSessionCode.trim().toUpperCase(),
          program: "SECJ",
          syllabusType: "2024/2025",
        });

        if (error) throw error;

        setSuccessMessage("Account created successfully. Redirecting to Student Portal...");
        setTimeout(() => {
          navigate("/student");
        }, 900);
      } catch (err: any) {
        setErrorMessage(err.message || "Student registration failed. Please verify your details and try again.");
      } finally {
        setProcessing(false);
      }
    } else {
      if (!advisorFullName.trim()) {
        setErrorMessage("Please enter your full name.");
        return;
      }
      if (!advisorEmail.trim()) {
        setErrorMessage("Please enter your email address.");
        return;
      }
      if (!advisorStaffId.trim()) {
        setErrorMessage("Please enter your staff ID.");
        return;
      }
      if (!advisorPassword || advisorPassword.length < 6) {
        setErrorMessage("Password must be at least 6 characters.");
        return;
      }

      setProcessing(true);

      try {
        const { error } = await signUpAdvisor({
          fullName: advisorFullName.trim(),
          email: advisorEmail.trim().toLowerCase(),
          staffId: advisorStaffId.trim().toUpperCase(),
          password: advisorPassword,
        });

        if (error) throw error;

        setSuccessMessage("Account created successfully. Redirecting to Advisor Portal...");
        setTimeout(() => {
          navigate("/advisor");
        }, 900);
      } catch (err: any) {
        setErrorMessage(err.message || "Advisor registration failed. Please verify your details and try again.");
      } finally {
        setProcessing(false);
      }
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-100 flex flex-col lg:flex-row font-sans text-slate-900 antialiased">
      {/* Left Branding Section */}
      <div className="w-full lg:w-[50%] xl:w-[52%] bg-slate-950 text-white p-8 sm:p-12 lg:p-16 flex flex-col justify-between relative overflow-hidden border-b lg:border-b-0 lg:border-r border-slate-800">
        {/* Subtle Ambient Decorative Gradients */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Institutional Badge */}
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-slate-800 bg-slate-900/80 text-xs font-medium text-slate-300 tracking-tight">
            <ShieldCheck className="w-4 h-4 text-blue-400" />
            <span>Institutional Academic Intelligence Platform</span>
          </div>
        </div>

        {/* Main Branding Content */}
        <div className="relative z-10 my-12 lg:my-0 max-w-xl">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white mb-3">
            LUMA
          </h1>
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-200 mb-6">
            Academic Advising &amp; Degree Audit System
          </h2>
          <p className="text-sm sm:text-base text-slate-400 leading-relaxed tracking-tight mb-8">
            An enterprise-grade academic evaluation infrastructure engineered to streamline degree trajectory audits, prerequisite validation, and secure advisor-student collaboration across accredited curricula.
          </p>

          {/* Value Propositions */}
          <div className="space-y-3.5 pt-4 border-t border-slate-800/80">
            <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
              <span>Automated prerequisite graph verification and graduation clearance</span>
            </div>
            <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
              <span>Real-time academic advising cohorts and grade progress audits</span>
            </div>
            <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
              <span>Role-governed institutional access for students and faculty advisors</span>
            </div>
          </div>
        </div>

        {/* Bottom System Meta */}
        <div className="relative z-10 pt-6 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 font-mono">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            <span className="tracking-tight">System Operational</span>
          </div>
          <span className="text-slate-500">Curriculum Syllabus 2024/2025</span>
        </div>
      </div>

      {/* Right Auth Section */}
      <div className="w-full lg:w-[50%] xl:w-[48%] bg-slate-50 flex items-center justify-center p-6 sm:p-10 lg:p-12">
        <div className="w-full max-w-md bg-white border border-slate-200 shadow-sm rounded-xl p-6 sm:p-8">
          {/* Top Auth Mode Tabs */}
          <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-lg mb-6 border border-slate-200/80">
            <button
              type="button"
              onClick={() => {
                setAuthMode("login");
                resetFormFeedback();
              }}
              className={`py-2 text-xs font-semibold rounded-md transition-all tracking-tight cursor-pointer ${
                authMode === "login"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode("register");
                resetFormFeedback();
              }}
              className={`py-2 text-xs font-semibold rounded-md transition-all tracking-tight cursor-pointer ${
                authMode === "register"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Form Header */}
          <div className="mb-6">
            <h3 className="text-xl font-bold tracking-tight text-slate-900">
              {authMode === "login" ? "Sign In" : "Register Account"}
            </h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              {authMode === "login"
                ? "Enter your academic credentials to access your portal."
                : "Select your institutional role and enter your details to register."}
            </p>
          </div>

          {/* Feedback Messages */}
          {errorMessage && (
            <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-700 leading-relaxed">
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="mb-5 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-700 leading-relaxed">
              {successMessage}
            </div>
          )}

          {/* Form Content */}
          {authMode === "login" ? (
            /* ================= LOGIN FORM ================= */
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="loginEmail" className="text-xs font-semibold text-slate-700">
                  Email Address
                </Label>
                <Input
                  id="loginEmail"
                  type="text"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="name@university.edu or student ID"
                  required
                  className="h-10 text-sm border-slate-200 focus:border-slate-400 focus:ring-slate-900"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="loginPassword" className="text-xs font-semibold text-slate-700">
                  Password
                </Label>
                <div className="relative flex items-center">
                  <Input
                    id="loginPassword"
                    type={showLoginPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="h-10 text-sm pr-10 border-slate-200 focus:border-slate-400 focus:ring-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                    aria-label={showLoginPassword ? "Hide password" : "Show password"}
                  >
                    {showLoginPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={processing}
                className="w-full h-10 mt-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium tracking-tight rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                {processing ? "Signing In..." : "Sign In"}
              </Button>
            </form>
          ) : (
            /* ================= REGISTRATION FORM ================= */
            <form onSubmit={handleRegistration} className="space-y-4">
              {/* Role Toggle */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Select Role
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRegistrationRole("student");
                      resetFormFeedback();
                    }}
                    className={`h-10 px-3 text-xs font-semibold rounded-lg border transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      registrationRole === "student"
                        ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <GraduationCap className="w-4 h-4" />
                    <span>I am a Student</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRegistrationRole("advisor");
                      resetFormFeedback();
                    }}
                    className={`h-10 px-3 text-xs font-semibold rounded-lg border transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      registrationRole === "advisor"
                        ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    <span>I am an Advisor</span>
                  </button>
                </div>
              </div>

              {/* Student Registration Fields */}
              {registrationRole === "student" ? (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="studentFullName" className="text-xs font-semibold text-slate-700">
                      Full Name
                    </Label>
                    <Input
                      id="studentFullName"
                      type="text"
                      value={studentFullName}
                      onChange={(e) => setStudentFullName(e.target.value)}
                      placeholder="e.g. Alex Tan"
                      required
                      className="h-10 text-sm border-slate-200 focus:border-slate-400 focus:ring-slate-900"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="studentEmail" className="text-xs font-semibold text-slate-700">
                      Email Address
                    </Label>
                    <Input
                      id="studentEmail"
                      type="email"
                      value={studentEmail}
                      onChange={(e) => setStudentEmail(e.target.value)}
                      placeholder="e.g. alex@student.utm.my"
                      required
                      className="h-10 text-sm border-slate-200 focus:border-slate-400 focus:ring-slate-900"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="studentMatric" className="text-xs font-semibold text-slate-700">
                      Matric Number
                    </Label>
                    <Input
                      id="studentMatric"
                      type="text"
                      value={studentMatric}
                      onChange={(e) => setStudentMatric(e.target.value.toUpperCase())}
                      placeholder="e.g. A21EC0001"
                      required
                      className="h-10 text-sm uppercase font-mono border-slate-200 focus:border-slate-400 focus:ring-slate-900"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="studentPassword" className="text-xs font-semibold text-slate-700">
                      Password
                    </Label>
                    <div className="relative flex items-center">
                      <Input
                        id="studentPassword"
                        type={showStudentPassword ? "text" : "password"}
                        autoComplete="new-password"
                        value={studentPassword}
                        onChange={(e) => setStudentPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        className="h-10 text-sm pr-10 border-slate-200 focus:border-slate-400 focus:ring-slate-900"
                      />
                      <button
                        type="button"
                        onClick={() => setShowStudentPassword(!showStudentPassword)}
                        className="absolute right-3 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                        aria-label={showStudentPassword ? "Hide password" : "Show password"}
                      >
                        {showStudentPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="studentSessionCode" className="text-xs font-semibold text-slate-700">
                      Lecturer Session Code
                    </Label>
                    <Input
                      id="studentSessionCode"
                      type="text"
                      value={studentSessionCode}
                      onChange={(e) => setStudentSessionCode(e.target.value.toUpperCase())}
                      placeholder="e.g. STAFF-LIYANA"
                      required
                      className="h-10 text-sm uppercase font-mono border-slate-200 focus:border-slate-400 focus:ring-slate-900"
                    />
                    <p className="text-[11px] text-slate-500 leading-normal">
                      Provided by your advisor
                    </p>
                  </div>
                </>
              ) : (
                /* Advisor Registration Fields */
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="advisorFullName" className="text-xs font-semibold text-slate-700">
                      Full Name
                    </Label>
                    <Input
                      id="advisorFullName"
                      type="text"
                      value={advisorFullName}
                      onChange={(e) => setAdvisorFullName(e.target.value)}
                      placeholder="e.g. Dr. Jane Doe"
                      required
                      className="h-10 text-sm border-slate-200 focus:border-slate-400 focus:ring-slate-900"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="advisorEmail" className="text-xs font-semibold text-slate-700">
                      Email Address
                    </Label>
                    <Input
                      id="advisorEmail"
                      type="email"
                      value={advisorEmail}
                      onChange={(e) => setAdvisorEmail(e.target.value)}
                      placeholder="e.g. jane@utm.my"
                      required
                      className="h-10 text-sm border-slate-200 focus:border-slate-400 focus:ring-slate-900"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="advisorStaffId" className="text-xs font-semibold text-slate-700">
                      Staff ID
                    </Label>
                    <Input
                      id="advisorStaffId"
                      type="text"
                      value={advisorStaffId}
                      onChange={(e) => setAdvisorStaffId(e.target.value.toUpperCase())}
                      placeholder="e.g. STAFF-001"
                      required
                      className="h-10 text-sm uppercase font-mono border-slate-200 focus:border-slate-400 focus:ring-slate-900"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="advisorPassword" className="text-xs font-semibold text-slate-700">
                      Password
                    </Label>
                    <div className="relative flex items-center">
                      <Input
                        id="advisorPassword"
                        type={showAdvisorPassword ? "text" : "password"}
                        autoComplete="new-password"
                        value={advisorPassword}
                        onChange={(e) => setAdvisorPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        className="h-10 text-sm pr-10 border-slate-200 focus:border-slate-400 focus:ring-slate-900"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAdvisorPassword(!showAdvisorPassword)}
                        className="absolute right-3 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                        aria-label={showAdvisorPassword ? "Hide password" : "Show password"}
                      >
                        {showAdvisorPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </>
              )}

              <Button
                type="submit"
                disabled={processing}
                className="w-full h-10 mt-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium tracking-tight rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                {processing
                  ? "Creating Account..."
                  : registrationRole === "student"
                  ? "Register as Student"
                  : "Register as Advisor"}
              </Button>
            </form>
          )}

          {/* Bottom Links */}
          <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setAuthMode(authMode === "login" ? "register" : "login");
                resetFormFeedback();
              }}
              className="text-xs text-slate-600 hover:text-slate-900 font-medium transition-colors cursor-pointer"
            >
              {authMode === "login"
                ? "Don't have an account? Create one"
                : "Already registered? Sign in"}
            </button>

            <Link
              to="/showcase"
              className="text-xs text-slate-400 hover:text-slate-700 transition-colors"
            >
              System Architecture &amp; Showcase
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}