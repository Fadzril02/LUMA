import React, { useState } from "react";
import { useNavigate, Link } from "react-router";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "../components/ui";
import { BookOpen, GraduationCap, Users, Settings, Eye, EyeOff } from "lucide-react";
import { motion } from "motion/react";
import { db } from "../../lib/supabase"; 
import { useAuth } from "../../context/AuthContext";

export function LandingPage() {
  const navigate = useNavigate();
  const { signInWithEmail } = useAuth();
  
  const [role, setRole] = useState<"student" | "advisor" | "admin">("student");
  const [utmId, setUtmId] = useState("");
  const [password, setPassword] = useState("");
  
  // 👁️ Visibility States
  const [showPassword, setShowPassword] = useState(false);
  
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setProcessing(true);

    const inputCredentials = utmId.trim().toLowerCase();
    const isValidEmailFormat = inputCredentials.includes("@");

    // Apply institutional domain formatting rules
    let finalAuthEmail = "";
    if (role === "student") {
      finalAuthEmail = isValidEmailFormat ? inputCredentials : `${inputCredentials}@student.utm.my`;
    } else {
      finalAuthEmail = isValidEmailFormat ? inputCredentials : `${inputCredentials}@utm.my`;
    }

    try {
      const { error, role: loggedInRole } = await signInWithEmail(finalAuthEmail, password);

      if (error) throw error;
      
      const effectiveRole = loggedInRole || role;
      if (effectiveRole === "student") {
        navigate("/student");
      } else if (effectiveRole === "advisor") {
        navigate("/advisor");
      } else {
        navigate("/admin");
      }
      
    } catch (err: any) {
      setErrorMessage(`Login Failed: ${err.message || "Invalid credentials."}`);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col md:flex-row">
      
      {/* Hero Section from Figma */}
      <div className="flex-1 bg-[#990033] text-white p-8 md:p-16 flex flex-col justify-center relative overflow-hidden">
        {/* Abstract shapes for design */}
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-white/5 blur-3xl" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[300px] h-[300px] rounded-full bg-[#FFCC00]/10 blur-2xl" />
        
        <div className="relative z-10 max-w-xl">
          <div className="flex items-center space-x-3 mb-8">
            <div className="bg-white p-2 rounded-lg">
              <BookOpen className="h-8 w-8 text-[#990033]" />
            </div>
            <h1 className="text-2xl font-bold tracking-wider uppercase">Universiti Teknologi Malaysia</h1>
          </div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
              SE Smart Academic Advisor (AA) System
            </h2>
            <p className="text-lg text-white/80 mb-8">
              A comprehensive platform streamlining academic tracking, pre-requisite validation, and result management for the Software Engineering program.
            </p>
          </motion.div>
          
          <div className="flex items-center space-x-4 text-sm font-medium text-white/90 flex-wrap gap-y-2">
            <span className="flex items-center"><GraduationCap className="w-4 h-4 mr-2 text-[#FFCC00]" /> Students</span>
            <span className="flex items-center"><Users className="w-4 h-4 mr-2 text-[#FFCC00]" /> Academic Advisors</span>
            <span className="flex items-center"><Settings className="w-4 h-4 mr-2 text-[#FFCC00]" /> Administrators</span>
          </div>
        </div>
      </div>

      {/* Login Section - WIDENED WHITE BACKGROUND */}
      <div className="w-full lg:w-[500px] xl:w-[800px] bg-white flex items-center justify-center p-8 md:p-12 shadow-2xl z-10 relative">
        
        {/* Inner container to keep the card perfectly sized inside the wider white panel */}
        <div className="w-full max-w-[420px]">
          <Card className="w-full border-[#990033]/10 shadow-xl bg-white">
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-2xl text-gray-900">Sign In</CardTitle>
              <p className="text-sm text-gray-500 mt-2">Access your SE Smart AA Dashboard</p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-6">
                
                {errorMessage && (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3.5 text-xs font-mono text-red-600">
                    {errorMessage}
                  </div>
                )}

                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-2 p-1 bg-gray-100 rounded-lg">
                    {(["student", "advisor", "admin"] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRole(r)}
                        className={`py-2 px-1 text-xs sm:text-sm rounded-md font-medium transition-all capitalize ${
                          role === r
                            ? "bg-white text-[#990033] shadow-sm ring-1 ring-gray-200"
                            : "text-gray-500 hover:text-gray-900"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="utmId">UTMID / Email</Label>
                    <Input 
                      id="utmId" 
                      value={utmId}
                      onChange={(e) => setUtmId(e.target.value)}
                      placeholder="e.g., A20EC0001" 
                      required 
                      className="border-gray-300 focus:border-[#990033] focus:ring-[#990033]"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative flex items-center">
                      <Input 
                        id="password" 
                        type={showPassword ? "text" : "password"} 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••" 
                        className="pr-10 w-full border-gray-300 focus:border-[#990033] focus:ring-[#990033]"
                        required 
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 text-gray-400 hover:text-gray-600 focus:outline-none cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  disabled={processing || loading}
                  className="w-full text-base h-11 bg-[#990033] hover:bg-[#80002A] text-white transition-all shadow-md cursor-pointer font-medium"
                >
                  {processing ? "AUTHENTICATING..." : `Sign In to ${role.charAt(0).toUpperCase() + role.slice(1)} Portal`}
                </Button>
              </form>

              <div className="mt-6 text-center border-t border-gray-100 pt-5 space-y-2">
                {role === "student" && (
                  <div>
                    <Link
                      to="/student/register"
                      className="text-xs font-semibold text-[#990033] hover:underline"
                    >
                      New Student? Create an Account & Link Advisor →
                    </Link>
                  </div>
                )}
                <Link
                  to="/showcase"
                  className="text-xs font-medium text-gray-500 hover:text-[#990033] transition-colors cursor-pointer block"
                >
                  View Feature Showcase
                </Link>
              </div>

            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}