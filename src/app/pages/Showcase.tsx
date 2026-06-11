import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { useNavigate } from "react-router";
import {
  LayoutDashboard, Upload, Users, CheckSquare, GraduationCap,
  ArrowRight, Sparkles, Zap, Shield
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from "../components/ui";
import { db } from "../../lib/supabase"; // Ensure this path matches your project structure

export function Showcase() {
  const navigate = useNavigate();

  // ✨ State to hold live database counts
  const [liveMetrics, setLiveMetrics] = useState({
    totalStudents: 0,
    pendingCorrections: 0,
    atRiskAlerts: 0,
    isLoading: true
  });

  // ✨ Real-time Database Polling
  useEffect(() => {
    const fetchLiveSystemStats = async () => {
      try {
        // 1. Count Total Active Students
        const { count: studentCount } = await db
          .from('students')
          .select('*', { count: 'exact', head: true });

        // 2. Count Pending Correction Requests
        const { count: pendingCount } = await db
          .from('correction_requests')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'Pending');

        // 3. Count At-Risk Flags (Checking results table for failed grades)
        const { count: failCount } = await db
          .from('results')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'Fail');

        setLiveMetrics({
          totalStudents: studentCount || 0,
          pendingCorrections: pendingCount || 0,
          atRiskAlerts: failCount || 0,
          isLoading: false
        });
      } catch (error) {
        console.error("Failed to fetch live showcase metrics:", error);
        setLiveMetrics(prev => ({ ...prev, isLoading: false }));
      }
    };

    fetchLiveSystemStats();
  }, []);

  // 🚀 Your features array is now dynamically mapped to the database state!
  const features = [
    {
      title: "Academic Advisor Dashboard",
      description: "High-fidelity dashboard with hero metrics, at-risk student tracking, and quick actions",
      route: "/advisor",
      icon: LayoutDashboard,
      color: "#990033",
      highlights: [
        liveMetrics.isLoading ? "Loading..." : `${liveMetrics.totalStudents} Total Students`, 
        liveMetrics.isLoading ? "Loading..." : `${liveMetrics.atRiskAlerts} At-Risk Alerts`, 
        liveMetrics.isLoading ? "Loading..." : `${liveMetrics.pendingCorrections} Pending Verifications`
      ],
    },
    {
      title: "PDF Upload & Extraction",
      description: "Drag & drop interface with AI-powered grade extraction from result slips",
      route: "/advisor/upload",
      icon: Upload,
      color: "#FFCC00",
      highlights: ["Drag & Drop Interface", "AI Extraction", "Real-time Progress"],
    },
    {
      title: "Students Management",
      description: "Search, filter, and manage all assigned students with CGPA tracking",
      route: "/advisor/students",
      icon: Users,
      color: "#030213",
      highlights: ["Advanced Search", "Status Filtering", "At-Risk Detection"],
    },
    {
      title: "Correction Queue",
      description: "Review and approve student correction requests with audit logging",
      route: "/advisor/corrections",
      icon: CheckSquare,
      color: "#d4183d",
      highlights: [
        liveMetrics.isLoading ? "Loading..." : `${liveMetrics.pendingCorrections} Pending Requests`, 
        "Approve/Reject", 
        "Audit Trail"
      ],
    },
  ];

  const designPrinciples = [
    {
      icon: Sparkles,
      title: "Premium UI/UX",
      description: "Card-based layouts, smooth animations, and interactive hover states",
    },
    {
      icon: Zap,
      title: "High Performance",
      description: "Optimized for both mobile (students) and desktop (advisors)",
    },
    {
      icon: Shield,
      title: "UTM Branding",
      description: "Strict adherence to UTM Maroon (#990033) and Gold (#FFCC00)",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#990033] via-[#7a0026] to-[#990033]">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-20" />

        <div className="relative z-10 max-w-7xl mx-auto px-6 py-20 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center justify-center space-x-3 mb-6">
              <GraduationCap className="w-12 h-12 text-[#FFCC00]" />
              <h1 className="text-4xl md:text-6xl font-bold text-white">
                SE Smart AA System
              </h1>
            </div>
            <p className="text-xl md:text-2xl text-white/90 mb-4">
              High-Fidelity Academic Assessment Platform
            </p>
            <p className="text-lg text-white/70 max-w-3xl mx-auto mb-8">
              A comprehensive, production-ready web application for UTM's Software Engineering program featuring
              role-based authentication, PDF processing, and modern UI/UX design.
            </p>
            <div className="flex flex-wrap justify-center gap-3 mb-12">
              <Badge variant="secondary" className="text-base px-4 py-2 bg-white/10 text-white border-white/20">
                UTM Branded
              </Badge>
              <Badge variant="secondary" className="text-base px-4 py-2 bg-white/10 text-white border-white/20">
                Mobile-First
              </Badge>
              <Badge variant="secondary" className="text-base px-4 py-2 bg-white/10 text-white border-white/20">
                All-in-One Architecture
              </Badge>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-[#F8F9FA] pb-20">
        <div className="max-w-7xl mx-auto px-6 -mt-10">
          {/* Design Principles */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {designPrinciples.map((principle, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 + 0.3 }}
              >
                <Card className="h-full border-t-4 border-t-[#FFCC00] hover:shadow-xl transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-start space-x-4">
                      <div className="bg-[#990033]/10 p-3 rounded-lg">
                        <principle.icon className="w-6 h-6 text-[#990033]" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-2">{principle.title}</h3>
                        <p className="text-sm text-gray-600">{principle.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Feature Showcase */}
          <div className="mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-6 text-center">Explore All Features</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {features.map((feature, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.1 + 0.5 }}
                >
                  <Card className="h-full hover:shadow-2xl transition-all cursor-pointer group border-l-4" style={{ borderLeftColor: feature.color }}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 rounded-lg" style={{ backgroundColor: `${feature.color}15` }}>
                            <feature.icon className="w-6 h-6" style={{ color: feature.color }} />
                          </div>
                          <CardTitle className="text-xl">{feature.title}</CardTitle>
                        </div>
                        <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-[#990033] group-hover:translate-x-1 transition-all" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-600 mb-4">{feature.description}</p>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {feature.highlights.map((highlight, hIdx) => (
                          <Badge key={hIdx} variant="outline" className="text-xs transition-colors group-hover:border-[#990033]/30">
                            {highlight}
                          </Badge>
                        ))}
                      </div>
                      <Button
                        variant="primary"
                        className="w-full"
                        onClick={() => navigate(feature.route)}
                      >
                        View {feature.title}
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Portal Navigation */}
          <Card className="bg-gradient-to-r from-[#990033] to-[#7a0026] border-none text-white shadow-xl">
            <CardContent className="py-12">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold mb-3">Ready to Get Started?</h2>
                <p className="text-white/80">Choose your portal to access the full system</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
                <Button
                  variant="secondary"
                  className="h-16 text-lg bg-white text-[#990033] hover:bg-white/90 border-0 cursor-pointer"
                  onClick={() => navigate("/student")}
                >
                  <GraduationCap className="w-5 h-5 mr-2" />
                  Student Portal
                </Button>
                <Button
                  variant="secondary"
                  className="h-16 text-lg bg-[#FFCC00] text-gray-900 hover:bg-[#FFCC00]/90 border-2 border-white cursor-pointer"
                  onClick={() => navigate("/advisor")}
                >
                  <Users className="w-5 h-5 mr-2" />
                  Advisor Dashboard
                </Button>
                <Button
                  variant="secondary"
                  className="h-16 text-lg bg-white text-[#990033] hover:bg-white/90 border-0 cursor-pointer"
                  onClick={() => navigate("/")}
                >
                  <LayoutDashboard className="w-5 h-5 mr-2" />
                  Back to Login
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Tech Stack */}
          <div className="mt-12 text-center">
            <p className="text-sm text-gray-500 mb-3">Built with modern web technologies</p>
            <div className="flex flex-wrap justify-center gap-3">
              {["React", "TypeScript", "Tailwind CSS v4", "Radix UI", "Motion/React", "React Router", "Recharts"].map((tech) => (
                <span key={tech} className="text-xs font-medium px-3 py-1 bg-gray-100 text-gray-700 rounded-full border border-gray-200">
                  {tech}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}