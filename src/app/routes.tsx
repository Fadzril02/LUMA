import { createBrowserRouter } from "react-router";
import { LandingPage } from "./pages/LandingPage";
import { Showcase } from "./pages/Showcase";
import { StudentPortal } from "./pages/student/StudentPortal";
import { StudentAuth } from "../pages/auth/StudentAuth";
import { AdvisorPortal } from "./pages/advisor/AdvisorPortal";
import { AdvisorDashboard } from "./pages/advisor/AdvisorDashboard";
import { StudentsList } from "./pages/advisor/StudentsList";
import { UploadResults } from "./pages/advisor/UploadResults";
import { CorrectionsQueue } from "./pages/advisor/CorrectionsQueue";
import { AdminPortal } from "./pages/admin/AdminPortal";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: LandingPage,
  },
  {
    path: "/showcase",
    Component: Showcase,
  },
  {
    path: "/student",
    Component: StudentPortal,
  },
  {
    path: "/student/auth",
    Component: StudentAuth,
  },
  {
    path: "/student/register",
    Component: StudentAuth,
  },
  {
    path: "/advisor",
    Component: AdvisorDashboard,
  },
  {
    path: "/advisor/old",
    Component: AdvisorPortal,
  },
  {
    path: "/advisor/students",
    Component: StudentsList,
  },
  {
    path: "/advisor/upload",
    Component: UploadResults,
  },
  {
    path: "/advisor/corrections",
    Component: CorrectionsQueue,
  },
  {
    path: "/admin",
    Component: AdminPortal,
  },
]);
