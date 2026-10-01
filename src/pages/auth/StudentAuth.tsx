import React, { useState } from "react";
import { useNavigate, Link, Navigate } from "react-router";
import { LoadingScreen } from "../../components/shared/LoadingScreen";
import { 
  GraduationCap, User, Lock, Mail, 
  Eye, EyeOff, ArrowRight, CheckCircle2, AlertCircle, Loader2 
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label } from "../../app/components/ui";

export function StudentAuth() {
  const navigate = useNavigate();
  const { user, role, signInStudent, signUpStudent, signInWithEmail } = useAuth();

  const [mode, setMode] = useState<"login" | "register">("register");
  
  // Registration Form State
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Login Form State
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // UI States
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Early returns placed strictly below all hook calls
  if (user && role === 'advisor') return <Navigate replace to="/advisor" />;
  if (user && role === 'student') return <Navigate replace to="/student" />;
  if (user && !role) return <Navigate replace to="/complete-registration" />;

  // Handle Student Registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Validation
    if (!fullName.trim()) {
      setErrorMessage("Please enter your Full Name.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setErrorMessage("Please enter your Institutional Email.");
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
        fullName: fullName.trim(),
        institutionalEmail: email.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        password: password,
      });

      if (error) throw error;

      setSuccessMessage("Check your email to confirm.");
      setMode("login");
      setPassword("");
      setConfirmPassword("");

    } catch (err: any) {
      console.error("Student Registration Error:", err);
      const rawMsg = err.message || "Registration failed. Please check your details and try again.";
      setErrorMessage(rawMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Student Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanEmail = loginEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMessage("Please enter your institutional email.");
      return;
    }
    if (!cleanEmail.includes("@")) {
      setErrorMessage("Please enter a valid institutional email address.");
      return;
    }
    if (!loginPassword) {
      setErrorMessage("Please enter your password.");
      return;
    }

    setIsLoading(true);
    try {
      const result = await signInWithEmail(cleanEmail, loginPassword);

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
      } else if (!result.role) {
        navigate("/complete-registration");
        return;
      }

      setSuccessMessage("Authentication successful! Loading your dashboard...");
      setTimeout(() => {
        navigate("/student");
      }, 800);

    } catch (err: any) {
      console.error("Student Login Error:", err);
      setErrorMessage(err.message || "Invalid credentials. Please verify your email and password.");
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
              <h1 className="text-xl font-bold tracking-wider uppercase">SynGrad Academic Advising</h1>
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
          <div className="flex bg-gray-100 p-1 rounded-xl mb-6 shadow-inner">
            <button
              type="button"
              onClick={() => { setMode("register"); setErrorMessage(null); }}
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
              onClick={() => { setMode("login"); setErrorMessage(null); }}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                mode === "login"
                  ? "bg-white text-[#990033] shadow-md"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              Sign In
            </button>
          </div>

          <Card className="border-gray-200 shadow-sm bg-white">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl font-bold text-gray-900">
                {mode === "register" ? "Create Student Account" : "Welcome Back"}
              </CardTitle>
              <p className="text-xs text-gray-500 mt-1">
                {mode === "register" 
                  ? "Sign up with your name, institutional email, and password." 
                  : "Sign in with your registered institutional email."}
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
                </div>
              )}

              {/* Success Alert */}
              {successMessage && (
                <div className="mb-5 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-start space-x-2.5 text-emerald-700 text-xs font-medium animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{successMessage}</span>
                </div>
              )}

              {mode === "register" ? (
                /* ========================================================= */
                /* REGISTRATION FORM                                         */
                /* ========================================================= */
                <form onSubmit={handleRegister} className="space-y-4">
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
                    disabled={isLoading}
                    className="w-full h-11 mt-4 bg-[#990033] hover:bg-[#80002A] text-white font-medium text-sm shadow-md transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        <span>Creating Student Account...</span>
                      </>
                    ) : (
                      <>
                        <span>Create Account</span>
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
                    <Label htmlFor="loginEmail" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Institutional Email
                    </Label>
                    <div className="relative flex items-center">
                      <Mail className="w-4 h-4 text-gray-400 absolute left-3" />
                      <Input
                        id="loginEmail"
                        type="email"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="e.g. student@university.edu.my"
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
