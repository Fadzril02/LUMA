import React, { useState } from "react";
import { useNavigate, Link } from "react-router";
import { Button, Input, Label } from "../components/ui";
import { 
  ShieldCheck, 
  GraduationCap, 
  Users, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  ArrowRight, 
  AlertCircle,
  Lock,
  Hash,
  Mail,
  Loader2
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { toast } from "sonner";

export function LandingPage() {
  const navigate = useNavigate();
  const { signInWithEmail, signUpStudent, signUpAdvisor, authError, clearAuthError } = useAuth();

  // Navigation / View State: 'login' | 'register'
  const [authMode, setAuthMode] = useState<"login" | "register">("login");

  // Login Role Context: 'student' | 'advisor'
  const [loginRole, setLoginRole] = useState<"student" | "advisor">("student");

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
  const [cohortCode, setCohortCode] = useState("");
  const [showStudentPassword, setShowStudentPassword] = useState(false);

  // Live Matric Validation
  const MATRIC_REGEX = /^[A-Z0-9]{5,15}$/i;
  const isStudentMatricValid = MATRIC_REGEX.test(studentMatric.trim());
  const showStudentMatricError = studentMatric.trim().length > 0 && !isStudentMatricValid;

  // Collision & Dispute Contest States
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [isContesting, setIsContesting] = useState(false);
  const [contestEmail, setContestEmail] = useState("");
  const [contestProcessing, setContestProcessing] = useState(false);
  const [contestSuccess, setContestSuccess] = useState(false);
  const [contestErrorMessage, setContestErrorMessage] = useState<string | null>(null);

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
    setIsDuplicate(false);
    setIsContesting(false);
    setContestErrorMessage(null);
    setContestSuccess(false);
    clearAuthError();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFormFeedback();

    const cleanEmail = loginEmail.trim().toLowerCase();
    if (!cleanEmail) {
      toast.error("Please enter your email address or ID.");
      setErrorMessage("Please enter your email address or ID.");
      return;
    }
    if (!loginPassword) {
      toast.error("Please enter your password.");
      setErrorMessage("Please enter your password.");
      return;
    }

    setProcessing(true);

    try {
      const { error, role: loggedInRole } = await signInWithEmail(cleanEmail, loginPassword);

      if (error) throw error;

      toast.success("Welcome back! Signing into your portal...");

      if (loggedInRole === "student") {
        navigate("/student");
      } else if (loggedInRole === "advisor") {
        navigate("/advisor");
      } else {
        navigate("/admin");
      }
    } catch (err: any) {
      let friendlyError = "Invalid credentials. Please verify your credentials.";
      const rawMsg = (err.message || "").toLowerCase();
      if (rawMsg.includes("invalid login credentials") || rawMsg.includes("invalid grant")) {
        friendlyError = "Invalid email or password. Please verify your credentials.";
      } else if (rawMsg.includes("network") || rawMsg.includes("failed to fetch")) {
        friendlyError = "Network error: Unable to connect to authentication services. Please retry.";
      } else if (rawMsg.includes("email not confirmed")) {
        friendlyError = "Your email has not been confirmed yet. Please check your inbox.";
      } else if (err.message) {
        friendlyError = err.message;
      }

      toast.error(friendlyError);
      setErrorMessage(friendlyError);
    } finally {
      setProcessing(false);
    }
  };

  const handleRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFormFeedback();

    if (registrationRole === "student") {
      const sanitizedFullName = studentFullName.trim();
      const sanitizedEmail = studentEmail.trim().toLowerCase();
      const sanitizedMatric = studentMatric.trim().toUpperCase();
      const sanitizedCohortCode = cohortCode.trim().toUpperCase();

      if (!sanitizedFullName) {
        toast.error("Please enter your full name.");
        setErrorMessage("Please enter your full name.");
        return;
      }
      if (!sanitizedEmail) {
        toast.error("Please enter your email address.");
        setErrorMessage("Please enter your email address.");
        return;
      }
      if (!sanitizedMatric) {
        toast.error("Please enter your matric number.");
        setErrorMessage("Please enter your matric number.");
        return;
      }
      if (!isStudentMatricValid) {
        toast.error("Expected format: 5-15 letters and numbers");
        setErrorMessage("Expected format: 5-15 letters and numbers");
        return;
      }
      if (!studentPassword || studentPassword.length < 6) {
        toast.error("Password must be at least 6 characters.");
        setErrorMessage("Password must be at least 6 characters.");
        return;
      }
      if (!sanitizedCohortCode) {
        toast.error("Please enter your 6-character Cohort Code.");
        setErrorMessage("Please enter your 6-character Cohort Code.");
        return;
      }

      setProcessing(true);

      try {
        // Direct registration: Dynamic variable-driven payload with no manual program/syllabus input
        const { error } = await signUpStudent({
          matricNo: sanitizedMatric,
          fullName: sanitizedFullName,
          institutionalEmail: sanitizedEmail,
          email: sanitizedEmail,
          password: studentPassword,
          cohortCode: sanitizedCohortCode,
        });

        if (error) throw error;

        toast.success("Account created successfully! Redirecting to Student Portal...");
        setSuccessMessage("Account created successfully. Redirecting to Student Portal...");
        setTimeout(() => {
          navigate("/student");
        }, 900);
      } catch (err: any) {
        let friendlyError = err.message || "Student registration failed. Please verify your details.";
        if (friendlyError.toLowerCase().includes("already registered")) {
          friendlyError = `Matric number "${sanitizedMatric}" is already registered. If this is you, please sign in.`;
          setIsDuplicate(true);
        } else if (friendlyError.includes("pre-registered") || friendlyError.includes("not found")) {
          friendlyError = `Matric number "${sanitizedMatric}" not found in institutional roster. Contact your advisor to initialize your record.`;
        }
        toast.error(friendlyError);
        setErrorMessage(friendlyError);
      } finally {
        setProcessing(false);
      }
    } else {
      const sanitizedFullName = advisorFullName.trim();
      const sanitizedEmail = advisorEmail.trim().toLowerCase();
      const sanitizedStaffId = advisorStaffId.trim().toUpperCase();

      if (!sanitizedFullName) {
        toast.error("Please enter your full name.");
        setErrorMessage("Please enter your full name.");
        return;
      }
      if (!sanitizedEmail) {
        toast.error("Please enter your email address.");
        setErrorMessage("Please enter your email address.");
        return;
      }
      if (!sanitizedStaffId) {
        toast.error("Please enter your staff ID.");
        setErrorMessage("Please enter your staff ID.");
        return;
      }
      if (!advisorPassword || advisorPassword.length < 6) {
        toast.error("Password must be at least 6 characters.");
        setErrorMessage("Password must be at least 6 characters.");
        return;
      }

      setProcessing(true);

      try {
        const { error } = await signUpAdvisor({
          fullName: sanitizedFullName,
          email: sanitizedEmail,
          staffId: sanitizedStaffId,
          password: advisorPassword,
        });

        if (error) throw error;

        toast.success("Advisor account created successfully! Redirecting to Advisor Portal...");
        setSuccessMessage("Account created successfully. Redirecting to Advisor Portal...");
        setTimeout(() => {
          navigate("/advisor");
        }, 900);
      } catch (err: any) {
        let friendlyError = err.message || "Advisor registration failed. Please verify your details.";
        if (friendlyError.includes("already registered")) {
          friendlyError = "An account with this email or staff ID already exists. Please sign in.";
        }
        toast.error(friendlyError);
        setErrorMessage(friendlyError);
      } finally {
        setProcessing(false);
      }
    }
  };

  const handleContestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setContestErrorMessage(null);

    const cleanEmail = contestEmail.trim().toLowerCase();
    if (!cleanEmail) {
      toast.error("Please enter your institutional email address.");
      setContestErrorMessage("Please enter your institutional email address.");
      return;
    }

    if (!/^[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}$/.test(cleanEmail)) {
      toast.error("Please provide a valid institutional email.");
      setContestErrorMessage("Please provide a valid institutional email.");
      return;
    }

    setContestProcessing(true);
    try {
      let advisorStaffIdVal: string | null = null;
      if (cohortCode.trim()) {
        const { data: cohortRow } = await supabase
          .from('cohorts')
          .select('advisor_staff_id')
          .eq('cohort_code', cohortCode.trim().toUpperCase())
          .maybeSingle();
        advisorStaffIdVal = cohortRow?.advisor_staff_id ?? null;
      }

      const { error } = await supabase.from('registration_disputes').insert({
        matric_no: studentMatric.trim().toUpperCase(),
        disputed_by_email: cleanEmail,
        advisor_staff_id: advisorStaffIdVal,
      });

      if (error) throw error;

      toast.success("Contest filed successfully!");
      setContestSuccess(true);
    } catch (err: any) {
      console.error("Contest Registration Error:", err);
      const errMsg = err.message || "Failed to submit dispute. Please try again.";
      setContestErrorMessage(errMsg);
      toast.error(errMsg);
    } finally {
      setContestProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-gray-900 font-sans flex flex-col justify-between antialiased selection:bg-blue-900 selection:text-white">
      {/* Top Institutional Header */}
      <header className="w-full bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-blue-900 flex items-center justify-center text-white shadow-sm">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="font-extrabold text-xl text-blue-900 tracking-tight">LUMA</span>
              <span className="hidden sm:inline-block text-xs font-medium text-gray-500 border-l border-gray-200 pl-2">
                Academic Advising Platform
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-50 border border-gray-200 text-xs font-medium text-gray-700">
              <span className="w-2 h-2 rounded-full bg-emerald-600" />
              <span>System Operational</span>
            </div>
            <Link
              to="/showcase"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-900 hover:text-blue-800 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
            >
              <span>Architecture</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 flex flex-col items-center">
        {/* Authoritative Hero Section */}
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-xs font-medium text-blue-900 mb-4 shadow-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-900" />
            <span>Institutional Degree Audit &amp; Academic Intelligence Infrastructure</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-blue-900">
            LUMA Academic Advising
          </h1>

          <p className="text-lg text-gray-600 mt-4 max-w-2xl mx-auto leading-relaxed">
            Streamlining curriculum tracking and prerequisite validation for university faculty and students.
          </p>
        </div>

        {/* Pristine Auth Card */}
        <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8">
          {/* Main Auth Mode Segmented Control */}
          {!isContesting ? (
            <div className="grid grid-cols-2 p-1 bg-gray-100 rounded-lg mb-6 border border-gray-200/80">
              <button
                type="button"
                onClick={() => {
                  setAuthMode("login");
                  resetFormFeedback();
                }}
                className={`py-2 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  authMode === "login"
                    ? "bg-white text-blue-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
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
                className={`py-2 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  authMode === "register"
                    ? "bg-white text-blue-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Create Account
              </button>
            </div>
          ) : (
            <div className="mb-6 flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-900 uppercase tracking-wider bg-blue-50 px-3 py-1.5 rounded-full border border-blue-200">
                Dispute Flow
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsContesting(false);
                  setContestErrorMessage(null);
                }}
                className="text-xs text-gray-500 hover:text-gray-900 font-medium cursor-pointer"
              >
                ← Back to Registration
              </button>
            </div>
          )}

          {/* Form Header */}
          <div className="mb-5">
            <h2 className="text-xl font-bold tracking-tight text-gray-900">
              {isContesting
                ? "Contest Registration"
                : authMode === "login"
                ? "Sign In to Portal"
                : "Create Institutional Account"}
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              {isContesting
                ? "Verify ownership of your UTM Matric Number with your institutional email."
                : authMode === "login"
                ? "Enter your academic credentials to access your advising dashboard."
                : "Select your role and complete details to initialize your credentials."}
            </p>
          </div>

          {/* Feedback Messages */}
          {errorMessage && (
            <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-700 leading-relaxed space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
              {isDuplicate && (
                <div className="pt-2 border-t border-red-200 flex items-center justify-between">
                  <span className="text-gray-700">Is this your matric number?</span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsContesting(true);
                      setErrorMessage(null);
                    }}
                    className="text-blue-900 hover:text-blue-700 font-semibold underline underline-offset-2 ml-1 cursor-pointer transition-colors"
                  >
                    Contest this registration.
                  </button>
                </div>
              )}
            </div>
          )}

          {successMessage && (
            <div className="mb-5 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-700 leading-relaxed">
              {successMessage}
            </div>
          )}

          {/* Form Content */}
          {isContesting ? (
            /* ================= CONTEST REGISTRATION FORM ================= */
            contestSuccess ? (
              <div className="p-5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs space-y-4">
                <div className="flex items-center space-x-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span className="text-sm font-bold">Dispute Submitted Successfully</span>
                </div>
                <p className="leading-relaxed">
                  Your registration dispute for matric number <strong className="font-mono text-emerald-900">{studentMatric.toUpperCase()}</strong> has been recorded. Your academic advisor will review your institutional claim (<strong className="font-mono text-emerald-900">{contestEmail}</strong>) and resolve the collision.
                </p>
                <Button
                  type="button"
                  onClick={() => {
                    setIsContesting(false);
                    setContestSuccess(false);
                    setIsDuplicate(false);
                    setErrorMessage(null);
                  }}
                  className="w-full h-10 bg-blue-900 hover:bg-blue-800 text-white font-medium text-xs rounded-lg transition-colors cursor-pointer"
                >
                  Return to Registration
                </Button>
              </div>
            ) : (
              <form onSubmit={handleContestSubmit} className="space-y-4">
                {contestErrorMessage && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-700 leading-relaxed flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                    <span>{contestErrorMessage}</span>
                  </div>
                )}

                {/* Locked Matric Number */}
                <div className="space-y-1.5">
                  <Label htmlFor="lockedStudentMatric" className="text-xs font-semibold text-gray-700">
                    Matric Number <span className="text-gray-400 font-normal">(Locked)</span>
                  </Label>
                  <div className="relative flex items-center">
                    <Hash className="w-4 h-4 text-gray-400 absolute left-3" />
                    <Input
                      id="lockedStudentMatric"
                      value={studentMatric.toUpperCase()}
                      disabled
                      readOnly
                      className="pl-9 pr-9 bg-gray-100 font-mono text-sm text-gray-700 cursor-not-allowed border-gray-200 h-10"
                    />
                    <Lock className="w-4 h-4 text-gray-400 absolute right-3" />
                  </div>
                  <p className="text-[11px] text-gray-500">
                    This matric number is locked to match the collided registration.
                  </p>
                </div>

                {/* Institutional Email */}
                <div className="space-y-1.5">
                  <Label htmlFor="contestStudentEmail" className="text-xs font-semibold text-gray-700">
                    Institutional Email <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative flex items-center">
                    <Mail className="w-4 h-4 text-gray-400 absolute left-3" />
                    <Input
                      id="contestStudentEmail"
                      type="email"
                      value={contestEmail}
                      onChange={(e) => setContestEmail(e.target.value)}
                      placeholder="e.g. student@university.edu.my"
                      required
                      className="pl-9 bg-gray-50 border-gray-200 focus:ring-2 focus:ring-blue-900 focus:border-transparent text-gray-900 h-10 text-sm"
                    />
                  </div>
                  <p className="text-[11px] text-gray-500">
                    Provide your official institutional email to prove ownership.
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={contestProcessing || !contestEmail.trim()}
                  className="w-full h-10 mt-2 bg-blue-900 hover:bg-blue-800 text-white font-medium rounded-lg shadow-sm transition-colors cursor-pointer text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {contestProcessing ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Submitting Dispute...</span>
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <span>Submit Registration Contest</span>
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  )}
                </Button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsContesting(false);
                      setContestErrorMessage(null);
                    }}
                    className="text-xs text-gray-500 hover:text-gray-900 font-medium transition-colors cursor-pointer"
                  >
                    Cancel and return
                  </button>
                </div>
              </form>
            )
          ) : authMode === "login" ? (
            /* ================= LOGIN FORM ================= */
            <form onSubmit={handleLogin} className="space-y-4">
              {/* Role Toggle for Login */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-700">
                  Portal Role
                </Label>
                <div className="grid grid-cols-2 p-1 bg-gray-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setLoginRole("student");
                      resetFormFeedback();
                    }}
                    className={`h-9 px-3 text-xs rounded-md transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      loginRole === "student"
                        ? "bg-white text-blue-900 font-semibold shadow-sm"
                        : "text-gray-600 hover:text-gray-900 font-medium"
                    }`}
                  >
                    <GraduationCap className="w-4 h-4" />
                    <span>Student</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setLoginRole("advisor");
                      resetFormFeedback();
                    }}
                    className={`h-9 px-3 text-xs rounded-md transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      loginRole === "advisor"
                        ? "bg-white text-blue-900 font-semibold shadow-sm"
                        : "text-gray-600 hover:text-gray-900 font-medium"
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    <span>Advisor</span>
                  </button>
                </div>
              </div>

              {(errorMessage || authError) && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs font-medium flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                  <span className="leading-snug">{errorMessage || authError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="loginEmail" className="text-xs font-semibold text-gray-700">
                  {loginRole === "student" ? "Institutional Email or Matric Number" : "Institutional Email or Staff ID"}
                </Label>
                <Input
                  id="loginEmail"
                  type="text"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder={loginRole === "student" ? "e.g. student@university.edu.my or A24CS0001" : "e.g. advisor@university.edu or STAFF-8842"}
                  required
                  className="bg-gray-50 border-gray-200 focus:ring-2 focus:ring-blue-900 focus:border-transparent text-gray-900 h-10 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="loginPassword" className="text-xs font-semibold text-gray-700">
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
                    className="bg-gray-50 border-gray-200 focus:ring-2 focus:ring-blue-900 focus:border-transparent text-gray-900 h-10 text-sm pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 text-gray-400 hover:text-gray-600 focus:outline-none cursor-pointer"
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
                className="w-full h-10 mt-2 bg-blue-900 hover:bg-blue-800 text-white font-medium rounded-lg shadow-sm transition-colors cursor-pointer text-sm"
              >
                {processing ? "Signing In..." : "Sign In"}
              </Button>
            </form>
          ) : (
            /* ================= REGISTRATION FORM ================= */
            <form onSubmit={handleRegistration} className="space-y-4">
              {/* Role Toggle for Registration */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-700">
                  Select Role
                </Label>
                <div className="grid grid-cols-2 p-1 bg-gray-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setRegistrationRole("student");
                      resetFormFeedback();
                    }}
                    className={`h-9 px-3 text-xs rounded-md transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      registrationRole === "student"
                        ? "bg-white text-blue-900 font-semibold shadow-sm"
                        : "text-gray-600 hover:text-gray-900 font-medium"
                    }`}
                  >
                    <GraduationCap className="w-4 h-4" />
                    <span>Student</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRegistrationRole("advisor");
                      resetFormFeedback();
                    }}
                    className={`h-9 px-3 text-xs rounded-md transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      registrationRole === "advisor"
                        ? "bg-white text-blue-900 font-semibold shadow-sm"
                        : "text-gray-600 hover:text-gray-900 font-medium"
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    <span>Advisor</span>
                  </button>
                </div>
              </div>

              {/* Student Registration Fields */}
              {registrationRole === "student" ? (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="studentFullName" className="text-xs font-semibold text-gray-700">
                      Full Name
                    </Label>
                    <Input
                      id="studentFullName"
                      type="text"
                      value={studentFullName}
                      onChange={(e) => setStudentFullName(e.target.value)}
                      placeholder="e.g. Alex Tan"
                      required
                      className="bg-gray-50 border-gray-200 focus:ring-2 focus:ring-blue-900 focus:border-transparent text-gray-900 h-10 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="studentEmail" className="text-xs font-semibold text-gray-700">
                      Email Address
                    </Label>
                    <Input
                      id="studentEmail"
                      type="email"
                      value={studentEmail}
                      onChange={(e) => setStudentEmail(e.target.value)}
                      placeholder="e.g. alex@university.edu.my"
                      required
                      className="bg-gray-50 border-gray-200 focus:ring-2 focus:ring-blue-900 focus:border-transparent text-gray-900 h-10 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="studentMatric" className="text-xs font-semibold text-gray-700">
                      Matric Number
                    </Label>
                    <Input
                      id="studentMatric"
                      type="text"
                      value={studentMatric}
                      onChange={(e) => {
                        setStudentMatric(e.target.value.toUpperCase());
                        if (isDuplicate) setIsDuplicate(false);
                      }}
                      placeholder="e.g. CS12345 or A24CS0001"
                      required
                      className={`bg-gray-50 border-gray-200 focus:ring-2 focus:ring-blue-900 focus:border-transparent text-gray-900 h-10 text-sm uppercase font-mono ${
                        showStudentMatricError ? "border-red-500 focus:ring-red-500" : ""
                      }`}
                    />
                    {showStudentMatricError && (
                      <p className="text-xs text-red-600 font-medium mt-1">
                        Expected format: 5-15 letters and numbers
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="studentPassword" className="text-xs font-semibold text-gray-700">
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
                        className="bg-gray-50 border-gray-200 focus:ring-2 focus:ring-blue-900 focus:border-transparent text-gray-900 h-10 text-sm pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowStudentPassword(!showStudentPassword)}
                        className="absolute right-3 text-gray-400 hover:text-gray-600 focus:outline-none cursor-pointer"
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

                  {/* 6-Character Cohort Code */}
                  <div className="space-y-1.5">
                    <Label htmlFor="cohortCode" className="text-xs font-semibold text-gray-700">
                      Cohort Code
                    </Label>
                    <Input
                      id="cohortCode"
                      type="text"
                      value={cohortCode}
                      onChange={(e) => setCohortCode(e.target.value.toUpperCase())}
                      placeholder="e.g. ABC-123"
                      required
                      className="bg-gray-50 border-gray-200 focus:ring-2 focus:ring-blue-900 focus:border-transparent text-gray-900 h-10 text-sm uppercase font-mono"
                    />
                    <p className="text-[11px] text-gray-500">
                      Enter the 6-character Cohort Code provided by your advisor. Degree Program and Syllabus are automatically configured.
                    </p>
                  </div>
                </>
              ) : (
                /* Advisor Registration Fields */
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="advisorFullName" className="text-xs font-semibold text-gray-700">
                      Full Name
                    </Label>
                    <Input
                      id="advisorFullName"
                      type="text"
                      value={advisorFullName}
                      onChange={(e) => setAdvisorFullName(e.target.value)}
                      placeholder="e.g. Dr. Jane Doe"
                      required
                      className="bg-gray-50 border-gray-200 focus:ring-2 focus:ring-blue-900 focus:border-transparent text-gray-900 h-10 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="advisorEmail" className="text-xs font-semibold text-gray-700">
                      Email Address
                    </Label>
                    <Input
                      id="advisorEmail"
                      type="email"
                      value={advisorEmail}
                      onChange={(e) => setAdvisorEmail(e.target.value)}
                      placeholder="e.g. advisor@university.edu"
                      required
                      className="bg-gray-50 border-gray-200 focus:ring-2 focus:ring-blue-900 focus:border-transparent text-gray-900 h-10 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="advisorStaffId" className="text-xs font-semibold text-gray-700">
                      Staff ID
                    </Label>
                    <Input
                      id="advisorStaffId"
                      type="text"
                      value={advisorStaffId}
                      onChange={(e) => setAdvisorStaffId(e.target.value.toUpperCase())}
                      placeholder="e.g. STAFF-001"
                      required
                      className="bg-gray-50 border-gray-200 focus:ring-2 focus:ring-blue-900 focus:border-transparent text-gray-900 h-10 text-sm uppercase font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="advisorPassword" className="text-xs font-semibold text-gray-700">
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
                        className="bg-gray-50 border-gray-200 focus:ring-2 focus:ring-blue-900 focus:border-transparent text-gray-900 h-10 text-sm pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAdvisorPassword(!showAdvisorPassword)}
                        className="absolute right-3 text-gray-400 hover:text-gray-600 focus:outline-none cursor-pointer"
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
                disabled={processing || (registrationRole === "student" && !isStudentMatricValid)}
                className="w-full h-10 mt-2 bg-blue-900 hover:bg-blue-800 text-white font-medium rounded-lg shadow-sm transition-colors cursor-pointer text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing
                  ? "Creating Account..."
                  : registrationRole === "student"
                  ? "Register as Student"
                  : "Register as Advisor"}
              </Button>
            </form>
          )}

          {/* Bottom Switch Links */}
          {!isContesting && (
            <div className="mt-6 pt-5 border-t border-gray-100 flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setAuthMode(authMode === "login" ? "register" : "login");
                  resetFormFeedback();
                }}
                className="text-xs text-gray-600 hover:text-blue-900 font-medium transition-colors cursor-pointer"
              >
                {authMode === "login"
                  ? "Don't have an account? Create one"
                  : "Already registered? Sign in"}
              </button>
            </div>
          )}
        </div>

        {/* Institutional Pillars / Value Propositions */}
        <div className="max-w-4xl w-full mx-auto mt-14 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-900 mb-3">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-gray-900 mb-1">Prerequisite Verification</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Automated directed acyclic graph validation ensuring accurate course sequence progression and graduation eligibility.
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-900 mb-3">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-gray-900 mb-1">Advisor Roster Diagnostics</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Real-time cohort monitoring with GPA distribution metrics, credit accumulation flags, and standing alerts.
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-900 mb-3">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-gray-900 mb-1">Institutional Integrity</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Role-governed audit trails and cryptographic session verification aligned with university curriculum standards.
            </p>
          </div>
        </div>
      </main>

      {/* Institutional Minimal Footer */}
      <footer className="border-t border-gray-200 bg-white py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
          <div className="flex items-center space-x-2">
            <GraduationCap className="w-4 h-4 text-blue-900" />
            <span className="font-semibold text-gray-800">LUMA Academic Advising Platform</span>
            <span className="text-gray-300">|</span>
            <span>Curriculum Syllabus 2024/2025</span>
          </div>

          <div className="flex items-center space-x-4">
            <Link to="/showcase" className="text-blue-900 hover:underline font-medium">
              Architecture &amp; Showcase
            </Link>
            <span className="text-gray-300">•</span>
            <span>Universiti Teknologi Malaysia</span>
          </div>
        </div>
      </footer>
    </div>
  );
}