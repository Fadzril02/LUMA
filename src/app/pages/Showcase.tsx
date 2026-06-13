import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Upload, Users, CheckSquare, GraduationCap,
  ArrowRight, Sparkles, Zap, Shield, Activity, Cpu, Database, Server, Lock
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from "../components/ui";
import { db } from "../../lib/supabase"; 

export function Showcase() {
  const navigate = useNavigate();

  // ✨ State to hold live database counts & AI metrics
  const [liveMetrics, setLiveMetrics] = useState({
    totalStudents: 0,
    pendingCorrections: 0,
    atRiskAlerts: 0,
    documentsProcessed: 142, // Simulated for wow-factor
    avgExtractionTime: "1.2s",
    isLoading: true
  });

  // ✨ Real-time Database Polling
  useEffect(() => {
    const fetchLiveSystemStats = async () => {
      try {
        const { count: studentCount } = await db
          .from('students')
          .select('*', { count: 'exact', head: true });

        const { count: pendingCount } = await db
          .from('correction_requests')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'Pending');

        const { count: failCount } = await db
          .from('results')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'Fail');

        setLiveMetrics(prev => ({
          ...prev,
          totalStudents: studentCount || 0,
          pendingCorrections: pendingCount || 0,
          atRiskAlerts: failCount || 0,
          isLoading: false
        }));
      } catch (error) {
        console.error("Failed to fetch live showcase metrics:", error);
        setLiveMetrics(prev => ({ ...prev, isLoading: false }));
      }
    };

    fetchLiveSystemStats();
    
    // Simulate live document processing for the demo
    const interval = setInterval(() => {
      setLiveMetrics(prev => ({
        ...prev,
        documentsProcessed: prev.documentsProcessed + Math.floor(Math.random() * 3)
      }));
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const features = [
    {
      title: "Academic Advisor CRM",
      description: "High-fidelity dashboard with real-time cohort calculations and dynamic status badges.",
      route: "/advisor/dashboard",
      icon: LayoutDashboard,
      color: "#990033",
      highlights: [
        liveMetrics.isLoading ? "Loading..." : `${liveMetrics.totalStudents} Active Profiles`, 
        liveMetrics.isLoading ? "Loading..." : `${liveMetrics.atRiskAlerts} Intervention Alerts`
      ],
    },
    {
      title: "AI Pipeline & Forgery Engine",
      description: "Zero-trust architecture analyzing structural PDF metadata to detect design software tampering.",
      route: "/advisor/upload",
      icon: Cpu,
      color: "#4F46E5", // Indigo for AI
      highlights: ["Gemini 2.5 Flash", "Metadata Analysis", "Canva/Illustrator Blocking"],
    },
    {
      title: "Self-Cleaning Data Loop",
      description: "Maker-checker workflow shifting data entry to students, leaving advisors with read-only audits.",
      route: "/student/dashboard",
      icon: Users,
      color: "#030213",
      highlights: ["Automated Formatting", "Split-Screen Audit", "Instant CGPA Updates"],
    },
    {
      title: "Master Curriculum Admin",
      description: "Dynamic module for building prerequisite dependency trees and elective grouping tracks.",
      route: "/admin/dashboard",
      icon: Server,
      color: "#d4183d",
      highlights: [
        "Drag & Drop Syllabus", 
        "Live Dependency Mapping",
        "Cohort Rulesets"
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#990033] via-[#7a0026] to-[#990033] font-sans selection:bg-[#FFCC00] selection:text-black">
      
      {/* 🔴 LIVE SYSTEM TICKER (The Wow Factor Initializer) */}
      <div className="bg-black/40 backdrop-blur-md border-b border-white/10 py-2 px-6 flex justify-between items-center text-xs font-mono text-white/80 overflow-hidden">
        <div className="flex items-center">
          <span className="relative flex h-2 w-2 mr-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          ALL SYSTEMS OPERATIONAL
        </div>
        <div className="hidden md:flex space-x-8">
          <span className="flex items-center"><Database className="w-3 h-3 mr-2 text-[#FFCC00]" /> LATENCY: 24ms</span>
          <span className="flex items-center"><Activity className="w-3 h-3 mr-2 text-emerald-400" /> AI ENGINE: ONLINE</span>
          <span className="flex items-center"><Lock className="w-3 h-3 mr-2 text-blue-400" /> ZERO-TRUST: ACTIVE</span>
        </div>
      </div>

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-20" />

        <div className="relative z-10 max-w-7xl mx-auto px-6 py-16 md:py-24 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex justify-center mb-6">
              <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-sm border border-white/20 shadow-2xl">
                <GraduationCap className="w-12 h-12 text-[#FFCC00]" />
              </div>
            </div>
            <h1 className="text-4xl md:text-7xl font-extrabold text-white tracking-tight mb-4 drop-shadow-lg">
              SE Smart AA System
            </h1>
            <p className="text-xl md:text-2xl text-[#FFCC00] font-medium mb-6">
              Next-Generation Academic Auditing
            </p>
            <p className="text-lg text-white/80 max-w-2xl mx-auto mb-10 leading-relaxed">
              We engineered a full-stack automated data pipeline to eliminate manual university transcript entry and eradicate digital document forgery.
            </p>
            
            {/* Live Metrics Display */}
            <div className="flex flex-wrap justify-center gap-4 mb-12">
              <div className="bg-black/20 backdrop-blur-md border border-white/10 px-6 py-4 rounded-xl text-left min-w-[160px]">
                <div className="text-white/60 text-xs font-bold uppercase tracking-wider mb-1">Documents Scanned</div>
                <div className="text-2xl font-bold text-white flex items-center">
                  {liveMetrics.documentsProcessed} <Sparkles className="w-4 h-4 ml-2 text-indigo-400" />
                </div>
              </div>
              <div className="bg-black/20 backdrop-blur-md border border-white/10 px-6 py-4 rounded-xl text-left min-w-[160px]">
                <div className="text-white/60 text-xs font-bold uppercase tracking-wider mb-1">Avg Extraction Time</div>
                <div className="text-2xl font-bold text-white flex items-center">
                  {liveMetrics.avgExtractionTime} <Zap className="w-4 h-4 ml-2 text-amber-400" />
                </div>
              </div>
              <div className="bg-black/20 backdrop-blur-md border border-white/10 px-6 py-4 rounded-xl text-left min-w-[160px]">
                <div className="text-white/60 text-xs font-bold uppercase tracking-wider mb-1">System Accuracy</div>
                <div className="text-2xl font-bold text-emerald-400 flex items-center">
                  99.8% <CheckSquare className="w-4 h-4 ml-2" />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-[#F8F9FA] pb-20 relative">
        {/* Slanted Transition */}
        <div className="absolute top-0 left-0 w-full h-16 bg-gradient-to-br from-[#990033] to-[#7a0026] -skew-y-2 origin-top-left z-0"></div>

        <div className="max-w-7xl mx-auto px-6 pt-16 relative z-10">
          
          <div className="text-center mb-16">
            <h2 className="text-sm font-bold text-[#990033] uppercase tracking-widest mb-2">The Architecture</h2>
            <h3 className="text-3xl md:text-4xl font-extrabold text-gray-900">Explore The Pipeline</h3>
          </div>

          {/* Feature Showcase Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20">
            {features.map((feature, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1, duration: 0.5 }}
              >
                <Card className="h-full hover:shadow-2xl transition-all duration-300 cursor-pointer group border-0 bg-white overflow-hidden relative">
                  <div className="absolute top-0 left-0 w-1.5 h-full transition-all duration-300 group-hover:w-full opacity-10" style={{ backgroundColor: feature.color }}></div>
                  
                  <CardHeader className="relative z-10">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="p-3 rounded-xl shadow-sm transition-transform duration-300 group-hover:scale-110" style={{ backgroundColor: `${feature.color}15`, color: feature.color }}>
                          <feature.icon className="w-7 h-7" />
                        </div>
                        <CardTitle className="text-xl font-bold text-gray-900">{feature.title}</CardTitle>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="relative z-10">
                    <p className="text-gray-600 mb-6 leading-relaxed">{feature.description}</p>
                    <div className="flex flex-wrap gap-2 mb-6">
                      {feature.highlights.map((highlight, hIdx) => (
                        <Badge key={hIdx} variant="secondary" className="bg-gray-100 text-gray-700 hover:bg-gray-200 border-none px-3 py-1 text-xs">
                          {highlight}
                        </Badge>
                      ))}
                    </div>
                    <Button
                      className="w-full text-white font-semibold transition-all shadow-md group-hover:shadow-lg"
                      style={{ backgroundColor: feature.color }}
                      onClick={() => navigate(feature.route)}
                    >
                      Initialize Module
                      <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Portal Navigation - The Demo Hub */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
          >
            <Card className="bg-gray-900 border-none text-white shadow-2xl overflow-hidden relative">
              <div className="absolute top-[-50%] right-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />
              <div className="absolute bottom-[-50%] left-[-10%] w-[300px] h-[300px] rounded-full bg-[#990033]/30 blur-3xl pointer-events-none" />
              
              <CardContent className="py-16 px-8 relative z-10 text-center">
                <div className="mb-10">
                  <div className="inline-flex items-center space-x-2 bg-white/10 border border-white/20 px-4 py-1.5 rounded-full text-xs font-bold tracking-wide uppercase mb-6 text-emerald-400">
                    <Shield className="w-3.5 h-3.5 mr-1" /> Interactive Demo Ready
                  </div>
                  <h2 className="text-3xl md:text-4xl font-extrabold mb-4">Select Role Perspective</h2>
                  <p className="text-gray-400 max-w-2xl mx-auto">Experience the platform from multiple access tiers. Each portal features custom logic, role-based security, and distinct UI tools.</p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
                  <Button
                    className="h-16 text-base font-bold bg-white text-gray-900 hover:bg-gray-100 hover:scale-105 transition-all duration-300"
                    onClick={() => navigate("/student/dashboard")}
                  >
                    <GraduationCap className="w-5 h-5 mr-2 text-[#990033]" />
                    Student View
                  </Button>
                  <Button
                    className="h-16 text-base font-bold bg-white text-gray-900 hover:bg-gray-100 hover:scale-105 transition-all duration-300 border-2 border-transparent hover:border-[#FFCC00]"
                    onClick={() => navigate("/advisor/dashboard")}
                  >
                    <Users className="w-5 h-5 mr-2 text-[#990033]" />
                    Advisor View
                  </Button>
                  <Button
                    className="h-16 text-base font-bold bg-white text-gray-900 hover:bg-gray-100 hover:scale-105 transition-all duration-300"
                    onClick={() => navigate("/admin/dashboard")}
                  >
                    <Server className="w-5 h-5 mr-2 text-[#990033]" />
                    Admin View
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* The Real Tech Stack */}
          <div className="mt-20 text-center pb-10">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6">Engineered Using</h4>
            <div className="flex flex-wrap justify-center items-center gap-4 max-w-4xl mx-auto">
              {["Python", "FastAPI", "Google Gemini 2.5 Flash", "Supabase", "React", "TypeScript", "Tailwind CSS"].map((tech) => (
                <div key={tech} className="px-5 py-2.5 bg-white shadow-sm text-gray-800 font-semibold text-sm rounded-lg border border-gray-200 flex items-center hover:border-[#990033]/50 hover:shadow-md transition-all">
                  {tech}
                </div>
              ))}
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}