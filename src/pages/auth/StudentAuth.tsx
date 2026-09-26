import React, { useState } from "react";
import { useNavigate, Link } from "react-router";
import { 
  GraduationCap, User, Lock, Mail, Hash, BookOpen, 
  Eye, EyeOff, ArrowRight, CheckCircle2, AlertCircle, Loader2 
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label } from "../../app/components/ui";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";

export function StudentAuth() {
  const navigate = useNavigate();
  const { signInStudent, signUpStudent, signInWithEmail } = useAuth();

  const [mode, setMode] = useState<"login" | "register">("register");
  
  // Registration Form State
  const [matricNo, setMatricNo] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [cohortCode, setCohortCode] = useState("");

  // Live Matric Validation
  const MATRIC_REGEX = /^[A-Z0-9]{5,15}$/i;
  const isMatricValid = MATRIC_REGEX.test(matricNo.trim());
  const showMatricError = matricNo.trim().length > 0 && !isMatricValid;

  // Collision & Contest States
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [isContesting, setIsContesting] = useState(false);
  const [contestEmail, setContestEmail] = useState("");
  const [isContestSubmitting, setIsContestSubmitting] = useState(false);
  const [contestSuccess, setContestSuccess] = useState(false);
  const [contestErrorMessage, setContestErrorMessage] = useState<string | null>(null);

  // Login Form State
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // UI States
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Handle Student Registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsDuplicate(false);

    // Validation
    const cleanMatric = matricNo.trim().toUpperCase();
    if (!cleanMatric) {
      setErrorMessage("Please enter your Matric Number.");
      return;
    }
    if (!isMatricValid) {
      setErrorMessage("Expected format: 5-15 letters and numbers");
      return;
    }
    if (!fullName.trim()) {
      setErrorMessage("Please enter your Full Name.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setErrorMessage("Please enter your Institutional Email.");
      return;
    }
    if (!cohortCode.trim()) {
      setErrorMessage("Please enter your 6-character Cohort Code.");
      return;
    }
    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await signUpStudent({
        matricNo: cleanMatric,
        fullName: fullName.trim(),
        institutionalEmail: email.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        password: password,
        cohortCode: cohortCode.trim().toUpperCase(),
      });

      if (error) throw error;

      setSuccessMessage("Account created successfully! Redirecting to Student Portal...");
      setTimeout(() => {
        navigate("/student");
      }, 1000);

    } catch (err: any) {
      console.error("Student Registration Error:", err);
      const rawMsg = err.message || "Registration failed. Please check your details and try again.";
      setErrorMessage(rawMsg);
      if (typeof rawMsg === "string" && rawMsg.toLowerCase().includes("already registered")) {
        setIsDuplicate(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Registration Dispute Submission
  const handleContestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setContestErrorMessage(null);

    const cleanEmail = contestEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setContestErrorMessage("Please enter your institutional email address.");
      return;
    }

    if (!/^[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}$/.test(cleanEmail)) {
      setContestErrorMessage("Please enter a valid institutional email.");
      return;
    }

    setIsContestSubmitting(true);
    try {
      let advisorStaffId: string | null = null;
      if (cohortCode.trim()) {
        const { data: cohortRow } = await supabase
          .from('cohorts')
          .select('advisor_staff_id')
          .eq('cohort_code', cohortCode.trim().toUpperCase())
          .maybeSingle();
        advisorStaffId = cohortRow?.advisor_staff_id ?? null;
      }

      const { error } = await supabase.from('registration_disputes').insert({
        matric_no: matricNo.trim().toUpperCase(),
        disputed_by_email: cleanEmail,
        advisor_staff_id: advisorStaffId,
      });

      if (error) throw error;

      setContestSuccess(true);
    } catch (err: any) {
      console.error("Contest Registration Error:", err);
      setContestErrorMessage(err.message || "Failed to submit dispute. Please try again or contact your faculty office.");
    } finally {
      setIsContestSubmitting(false);
    }
  };

  // Handle Student Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanInput = loginIdentifier.trim();
    if (!cleanInput) {
      setErrorMessage("Please enter your Matric Number or Email.");
      return;
    }
    if (!loginPassword) {
      setErrorMessage("Please enter your password.");
      return;
    }

    setIsLoading(true);
    try {
      let result;
      if (cleanInput.includes("@")) {
        result = await signInWithEmail(cleanInput, loginPassword);
      } else {
        result = await signInStudent(cleanInput, loginPassword);
      }

      if (result.error) throw result.error;

      // SECURITY FIX #1: Hard-check the DB-resolved role returned by signInWithEmail.
      // fetchUserProfile always resolves the REAL role from the advisors/students table.
      // If an advisor's credentials are entered here, role will be 'advisor' — reject it.
      if (result.role === 'advisor') {
        // Force sign-out so the advisor session is not left active
        await supabase.auth.signOut();
        throw new Error(
          "This account belongs to an Advisor. Please use the Advisor Portal to log in."
        );
      }

      setSuccessMessage("Authentication successful! Loading your dashboard...");
      setTimeout(() => {
        navigate("/student");
      }, 800);

    } catch (err: any) {
      console.error("Student Login Error:", err);
      setErrorMessage(err.message || "Invalid credentials. Please verify your matric number and password.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col md:flex-row">
      {/* Brand & Institution Hero Section */}
      <div className="flex-1 bg-[#990033] text-white p-8 md:p-16 flex flex-col justify-center relative overflow-hidden">
        {/* Background Ambient Accents */}
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-white/5 blur-3xl" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[300px] h-[300px] rounded-full bg-[#FFCC00]/10 blur-2xl" />

        <div className="relative z-10 max-w-xl">
          <div className="flex items-center space-x-3 mb-8">
            <div className="bg-white p-2.5 rounded-xl shadow-md">
              <GraduationCap className="h-8 w-8 text-[#990033]" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-wider uppercase">LUMA Academic Advising</h1>
              <p className="text-xs text-white/70 tracking-widest uppercase">Smart Academic Advising System</p>
            </div>
          </div>

          <h2 className="text-3xl md:text-5xl font-extrabold mb-6 leading-tight">
            Student Academic Access & Degree Audit
          </h2>
          <p className="text-base md:text-lg text-white/80 mb-8 leading-relaxed">
            Upload your academic slips, track prerequisite clearances in real time, and forecast your degree progression with automated transcript intelligence.
          </p>

          <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-6 text-sm text-white/90">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-[#FFCC00] shrink-0" />
              <span>Zero-Waste Transcript Parsing</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-[#FFCC00] shrink-0" />
              <span>Direct Academic Advisor Link</span>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Form Section */}
      <div className="w-full lg:w-[560px] xl:w-[640px] bg-white flex items-center justify-center p-6 md:p-12 shadow-2xl z-10 relative overflow-y-auto">
        <div className="w-full max-w-[460px] py-4">
          
          {/* Mode Switcher Tabs */}
          {!isContesting ? (
            <div className="flex bg-gray-100 p-1 rounded-xl mb-6 shadow-inner">
              <button
                type="button"
                onClick={() => { setMode("register"); setErrorMessage(null); setIsDuplicate(false); }}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                  mode === "register"
                    ? "bg-white text-[#990033] shadow-md"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                New Student Registration
              </button>
              <button
                type="button"
                onClick={() => { setMode("login"); setErrorMessage(null); setIsDuplicate(false); }}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                  mode === "login"
                    ? "bg-white text-[#990033] shadow-md"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                Sign In
              </button>
            </div>
          ) : (
            <div className="mb-6 flex items-center justify-between">
              <span className="text-xs font-semibold text-[#990033] uppercase tracking-wider bg-rose-50 px-3 py-1.5 rounded-full border border-rose-200">
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

          <Card className="border-gray-200 shadow-sm bg-white">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl font-bold text-gray-900">
                {isContesting
                  ? "Contest Registration"
                  : mode === "register"
                  ? "Create Student Account"
                  : "Welcome Back"}
              </CardTitle>
              <p className="text-xs text-gray-500 mt-1">
                {isContesting
                  ? "Verify ownership of your Matric Number with your institutional email."
                  : mode === "register" 
                  ? "Register using your Matric Number and assigned Cohort Code." 
                  : "Sign in with your Matric Number or registered email."}
              </p>
            </CardHeader>

            <CardContent>
              {/* Error Alert */}
              {errorMessage && (
                <div className="mb-5 p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium animate-in fade-in space-y-2.5">
                  <div className="flex items-start space-x-2.5">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                  {isDuplicate && (
                    <div className="pt-2 border-t border-rose-200 flex items-center justify-between">
                      <span className="text-gray-700">Is this your matric number?</span>
                      <button
                        type="button"
                        onClick={() => {
                          setIsContesting(true);
                          setErrorMessage(null);
                        }}
                        className="text-[#990033] hover:text-[#80002A] font-semibold underline underline-offset-2 ml-1 cursor-pointer transition-colors"
                      >
                        Contest this registration.
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Success Alert */}
              {successMessage && (
                <div className="mb-5 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-start space-x-2.5 text-emerald-700 text-xs font-medium animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{successMessage}</span>
                </div>
              )}

              {isContesting ? (
                /* ========================================================= */
                /* CONTEST REGISTRATION FORM                                 */
                /* ========================================================= */
                contestSuccess ? (
                  <div className="p-5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs space-y-4">
                    <div className="flex items-center space-x-2.5">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      <span className="text-sm font-bold">Dispute Submitted Successfully</span>
                    </div>
                    <p className="leading-relaxed">
                      Your registration dispute for matric number <strong className="font-mono text-emerald-900">{matricNo.toUpperCase()}</strong> has been submitted. Your academic advisor will verify your institutional claim (<strong className="font-mono text-emerald-900">{contestEmail}</strong>) and review the collision.
                    </p>
                    <Button
                      type="button"
                      onClick={() => {
                        setIsContesting(false);
                        setContestSuccess(false);
                        setIsDuplicate(false);
                        setErrorMessage(null);
                      }}
                      className="w-full h-10 bg-[#990033] hover:bg-[#80002A] text-white font-medium text-xs rounded-lg transition-colors cursor-pointer"
                    >
                      Return to Registration
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleContestSubmit} className="space-y-4">
                    {contestErrorMessage && (
                      <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 flex items-start space-x-2.5 text-rose-700 text-xs font-medium">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <span>{contestErrorMessage}</span>
                      </div>
                    )}

                    {/* Locked Matric Number */}
                    <div className="space-y-1.5">
                      <Label htmlFor="lockedMatricNo" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Matric Number <span className="text-gray-400 font-normal">(Locked)</span>
                      </Label>
                      <div className="relative flex items-center">
                        <Hash className="w-4 h-4 text-gray-400 absolute left-3" />
                        <Input
                          id="lockedMatricNo"
                          value={matricNo.toUpperCase()}
                          disabled
                          readOnly
                          className="pl-9 pr-9 bg-gray-100 font-mono text-sm text-gray-700 cursor-not-allowed border-gray-300"
                        />
                        <Lock className="w-4 h-4 text-gray-400 absolute right-3" />
                      </div>
                      <p className="text-[11px] text-gray-500">
                        This matric number is locked to match the collided registration.
                      </p>
                    </div>

                    {/* Institutional Email */}
                    <div className="space-y-1.5">
                      <Label htmlFor="contestEmail" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Institutional Email <span className="text-rose-500">*</span>
                      </Label>
                      <div className="relative flex items-center">
                        <Mail className="w-4 h-4 text-gray-400 absolute left-3" />
                        <Input
                          id="contestEmail"
                          type="email"
                          value={contestEmail}
                          onChange={(e) => setContestEmail(e.target.value)}
                          placeholder="e.g. student@university.edu.my"
                          required
                          className="pl-9 text-sm border-gray-300 focus:border-[#990033] focus:ring-[#990033]"
                        />
                      </div>
                      <p className="text-[11px] text-gray-500">
                        Provide your official institutional email to prove ownership.
                      </p>
                    </div>

                    <Button
                      type="submit"
                      disabled={isContestSubmitting || !contestEmail.trim()}
                      className="w-full h-11 mt-4 bg-[#990033] hover:bg-[#80002A] text-white font-medium text-sm shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isContestSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          <span>Submitting Dispute...</span>
                        </>
                      ) : (
                        <>
                          <span>Submit Registration Contest</span>
                          <ArrowRight className="w-4 h-4 ml-1" />
                        </>
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
              ) : mode === "register" ? (
                /* ========================================================= */
                /* REGISTRATION FORM                                         */
                /* ========================================================= */
                <form onSubmit={handleRegister} className="space-y-4">
                  {/* Matric Number */}
                  <div className="space-y-1.5">
                    <Label htmlFor="matricNo" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Matric Number <span className="text-rose-500">*</span>
                    </Label>
                    <div className="relative flex items-center">
                      <Hash className="w-4 h-4 text-gray-400 absolute left-3" />
                      <Input
                        id="matricNo"
                        value={matricNo}
                        onChange={(e) => {
                          setMatricNo(e.target.value.toUpperCase());
                          if (isDuplicate) setIsDuplicate(false);
                        }}
                        placeholder="e.g. CS12345 or A24CS0001"
                        required
                        className={`pl-9 text-sm font-mono border-gray-300 focus:border-[#990033] focus:ring-[#990033] ${
                          showMatricError ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500" : ""
                        }`}
                      />
                    </div>
                    {showMatricError && (
                      <p className="text-xs text-rose-600 font-medium mt-1">
                        Expected format: 5-15 letters and numbers
                      </p>
                    )}
                  </div>

                  {/* Full Legal Name */}
                  <div className="space-y-1.5">
                    <Label htmlFor="fullName" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Full Name <span className="text-rose-500">*</span>
                    </Label>
                    <div className="relative flex items-center">
                      <User className="w-4 h-4 text-gray-400 absolute left-3" />
                      <Input
                        id="fullName"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Student Name"
                        required
                        className="pl-9 text-sm border-gray-300 focus:border-[#990033] focus:ring-[#990033]"
                      />
                    </div>
                  </div>

                  {/* Institutional Email */}
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Institutional Email <span className="text-rose-500">*</span>
                    </Label>
                    <div className="relative flex items-center">
                      <Mail className="w-4 h-4 text-gray-400 absolute left-3" />
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. student@university.edu.my"
                        required
                        className="pl-9 text-sm border-gray-300 focus:border-[#990033] focus:ring-[#990033]"
                      />
                    </div>
                  </div>

                  {/* 6-Character Cohort Code */}
                  <div className="space-y-1.5">
                    <Label htmlFor="cohortCode" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Cohort Code <span className="text-rose-500">*</span>
                    </Label>
                    <div className="relative flex items-center">
                      <BookOpen className="w-4 h-4 text-gray-400 absolute left-3" />
                      <Input
                        id="cohortCode"
                        value={cohortCode}
                        onChange={(e) => setCohortCode(e.target.value.toUpperCase())}
                        placeholder="e.g. ABC-123"
                        required
                        className="pl-9 text-sm font-mono border-gray-300 focus:border-[#990033] focus:ring-[#990033]"
                      />
                    </div>
                    <p className="text-[11px] text-gray-500">
                      Enter the 6-character Cohort Code provided by your advisor. Degree Program and Syllabus are automatically configured.
                    </p>
                  </div>

                  {/* Password */}
                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Account Password <span className="text-rose-500">*</span>
                    </Label>
                    <div className="relative flex items-center">
                      <Lock className="w-4 h-4 text-gray-400 absolute left-3" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        className="pl-9 pr-10 text-sm border-gray-300 focus:border-[#990033] focus:ring-[#990033]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-1.5">
                    <Label htmlFor="confirmPassword" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Confirm Password <span className="text-rose-500">*</span>
                    </Label>
                    <div className="relative flex items-center">
                      <Lock className="w-4 h-4 text-gray-400 absolute left-3" />
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        className="pl-9 pr-10 text-sm border-gray-300 focus:border-[#990033] focus:ring-[#990033]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 text-gray-400 hover:text-gray-600"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={isLoading || !isMatricValid}
                    className="w-full h-11 mt-4 bg-[#990033] hover:bg-[#80002A] text-white font-medium text-sm shadow-md transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        <span>Creating Student Account...</span>
                      </>
                    ) : (
                      <>
                        <span>Complete Registration</span>
                        <ArrowRight className="w-4 h-4 ml-1" />
                      </>
                    )}
                  </Button>
                </form>
              ) : (
                /* ========================================================= */
                /* LOGIN FORM                                                */
                /* ========================================================= */
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="loginIdentifier" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Matric Number or Email
                    </Label>
                    <div className="relative flex items-center">
                      <Hash className="w-4 h-4 text-gray-400 absolute left-3" />
                      <Input
                        id="loginIdentifier"
                        value={loginIdentifier}
                        onChange={(e) => setLoginIdentifier(e.target.value)}
                        placeholder="e.g. A24EC0000 or student@university.edu.my"
                        required
                        className="pl-9 text-sm border-gray-300 focus:border-[#990033] focus:ring-[#990033]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="loginPassword" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Password
                    </Label>
                    <div className="relative flex items-center">
                      <Lock className="w-4 h-4 text-gray-400 absolute left-3" />
                      <Input
                        id="loginPassword"
                        type={showPassword ? "text" : "password"}
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        className="pl-9 pr-10 text-sm border-gray-300 focus:border-[#990033] focus:ring-[#990033]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-11 mt-4 bg-[#990033] hover:bg-[#80002A] text-white font-medium text-sm shadow-md transition-all flex items-center justify-center space-x-2"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        <span>Authenticating...</span>
                      </>
                    ) : (
                      <>
                        <span>Sign In to Student Portal</span>
                        <ArrowRight className="w-4 h-4 ml-1" />
                      </>
                    )}
                  </Button>
                </form>
              )}

              <div className="mt-6 text-center">
                <Link to="/" className="text-xs text-gray-500 hover:text-[#990033] font-medium transition-colors">
                  ← Back to Main Institutional Portal
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
