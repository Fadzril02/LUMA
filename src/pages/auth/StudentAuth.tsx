import React, { useState } from "react";
import { useNavigate, Link } from "react-router";
import { 
  GraduationCap, User, Lock, Mail, Hash, BookOpen, 
  Eye, EyeOff, ArrowRight, CheckCircle2, AlertCircle, Loader2 
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label } from "../../app/components/ui";
import { useAuth } from "../../context/AuthContext";

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
  const [advisorId, setAdvisorId] = useState("");
  const [program, setProgram] = useState("SECJ");
  const [syllabusType, setSyllabusType] = useState("2023/2024");

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

    // Validation
    const cleanMatric = matricNo.trim().toUpperCase();
    if (!cleanMatric) {
      setErrorMessage("Please enter your Matric Number.");
      return;
    }
    if (!fullName.trim()) {
      setErrorMessage("Please enter your Full Name.");
      return;
    }
    if (!advisorId.trim()) {
      setErrorMessage("Please enter your Advisor Code / ID.");
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
        email: email.trim() || undefined,
        password: password,
        advisorId: advisorId.trim().toUpperCase(),
        program: program,
        syllabusType: syllabusType,
      });

      if (error) throw error;

      setSuccessMessage("Account created successfully! Redirecting to Student Portal...");
      setTimeout(() => {
        navigate("/student");
      }, 1000);

    } catch (err: any) {
      console.error("Student Registration Error:", err);
      setErrorMessage(err.message || "Registration failed. Please check your details and try again.");
    } finally {
      setIsLoading(false);
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
              <h1 className="text-xl font-bold tracking-wider uppercase">LUMA • UTM</h1>
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
                  ? "Register using your UTM Matric Number and assigned Advisor Code." 
                  : "Sign in with your Matric Number or registered email."}
              </p>
            </CardHeader>

            <CardContent>
              {/* Error Alert */}
              {errorMessage && (
                <div className="mb-5 p-3.5 rounded-lg bg-rose-50 border border-rose-200 flex items-start space-x-2.5 text-rose-700 text-xs font-medium animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
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
                        onChange={(e) => setMatricNo(e.target.value.toUpperCase())}
                        placeholder="e.g. A24EC0000"
                        required
                        className="pl-9 text-sm font-mono border-gray-300 focus:border-[#990033] focus:ring-[#990033]"
                      />
                    </div>
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

                  {/* Optional Personal / Institutional Email */}
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Institutional / Personal Email <span className="text-gray-400 font-normal">(Optional)</span>
                    </Label>
                    <div className="relative flex items-center">
                      <Mail className="w-4 h-4 text-gray-400 absolute left-3" />
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. student@utm.my"
                        className="pl-9 text-sm border-gray-300 focus:border-[#990033] focus:ring-[#990033]"
                      />
                    </div>
                  </div>

                  {/* Advisor Code / ID */}
                  <div className="space-y-1.5">
                    <Label htmlFor="advisorId" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Advisor Code / ID <span className="text-rose-500">*</span>
                    </Label>
                    <div className="relative flex items-center">
                      <BookOpen className="w-4 h-4 text-gray-400 absolute left-3" />
                      <Input
                        id="advisorId"
                        value={advisorId}
                        onChange={(e) => setAdvisorId(e.target.value.toUpperCase())}
                        placeholder="e.g. STAFF-001"
                        required
                        className="pl-9 text-sm font-mono border-gray-300 focus:border-[#990033] focus:ring-[#990033]"
                      />
                    </div>
                    <p className="text-[11px] text-gray-500">Provided by your faculty advisor (e.g. STAFF-LIYANA).</p>
                  </div>

                  {/* Program & Curriculum Syllabus */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="program" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Program
                      </Label>
                      <select
                        id="program"
                        value={program}
                        onChange={(e) => setProgram(e.target.value)}
                        className="w-full h-10 px-3 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-[#990033] focus:ring-1 focus:ring-[#990033]"
                      >
                        <option value="SECJ">SECJ (Software Eng.)</option>
                        <option value="SECR">SECR (Networks & Security)</option>
                        <option value="SECP">SECP (Data Engineering)</option>
                        <option value="SECV">SECV (Graphics & Multimedia)</option>
                        <option value="SECB">SECB (Bioinformatics)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="syllabusType" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Syllabus Year
                      </Label>
                      <select
                        id="syllabusType"
                        value={syllabusType}
                        onChange={(e) => setSyllabusType(e.target.value)}
                        className="w-full h-10 px-3 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-[#990033] focus:ring-1 focus:ring-[#990033]"
                      >
                        <option value="2024_REVISED">2024/2025 (Revised)</option>
                        <option value="2023/2024">2023/2024</option>
                        <option value="2022/2023">2022/2023</option>
                        <option value="SCSE">Legacy (SCSE)</option>
                      </select>
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
                    className="w-full h-11 mt-4 bg-[#990033] hover:bg-[#80002A] text-white font-medium text-sm shadow-md transition-all flex items-center justify-center space-x-2"
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
                        placeholder="e.g. A24EC0000 or student@utm.my"
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
