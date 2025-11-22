import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Login from "./pages/Login";
import SignupStudent from "./pages/SignupStudent";
import SignupFaculty from "./pages/SignupFaculty";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import BusDetails from "./pages/BusDetails";
import EPass from "./pages/EPass";
import AdminDashboard from "./pages/AdminDashboard";
import AdminBuses from "./pages/AdminBuses";
import AdminBusDashboard from "./pages/AdminBusDashboard";
import AdminUserProfile from "./pages/AdminUserProfile";
import ExpiredPassLetter from "./pages/ExpiredPassLetter";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignupStudent />} />
            <Route path="/signup-faculty" element={<SignupFaculty />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute allowedRoles={['student', 'faculty']}>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute allowedRoles={['student', 'faculty', 'admin']}>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/bus-details"
              element={
                <ProtectedRoute allowedRoles={['student', 'faculty']}>
                  <BusDetails />
                </ProtectedRoute>
              }
            />
            <Route
              path="/epass"
              element={
                <ProtectedRoute allowedRoles={['student', 'faculty']}>
                  <EPass />
                </ProtectedRoute>
              }
            />
            <Route
              path="/expired-pass-letter"
              element={
                <ProtectedRoute allowedRoles={['student', 'faculty']}>
                  <ExpiredPassLetter />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/buses"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminBuses />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/bus/:busNumber"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminBusDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/user/:userId"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminUserProfile />
                </ProtectedRoute>
              }
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
