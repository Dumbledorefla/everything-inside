import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/hooks/useAuth";
import { AssistantProvider } from "@/contexts/AssistantContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "./components/AppLayout";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import ProjectHome from "./pages/ProjectHome";
import ProjectDNA from "./pages/ProjectDNA";
import Production from "./pages/Production";
import ProjectLibrary from "./pages/ProjectLibrary";
import Planning from "./pages/Planning";
import Sprints from "./pages/Sprints";
import ProjectHistory from "./pages/ProjectHistory";
import ProjectPages from "./pages/ProjectPages";
import GlobalLibrary from "./pages/GlobalLibrary";
import Models from "./pages/Models";
import SettingsPage from "./pages/SettingsPage";
import Logs from "./pages/Logs";
import ProjectReferences from "./pages/ProjectReferences";
import AdFactory from "./pages/AdFactory";
import Characters from "./pages/Characters";
import Videos from "./pages/Videos";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AssistantProvider>
                <Routes>
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/library" element={<GlobalLibrary />} />
                    <Route path="/models" element={<Models />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/logs" element={<Logs />} />
                    <Route path="/project/:projectId" element={<Navigate to="home" replace />} />
                    <Route path="/project/:projectId/home" element={<ProjectHome />} />
                    <Route path="/project/:projectId/dna" element={<ProjectDNA />} />
                    <Route path="/project/:projectId/production" element={<Production />} />
                    <Route path="/project/:projectId/library" element={<ProjectLibrary />} />
                    <Route path="/project/:projectId/planning" element={<Planning />} />
                    <Route path="/project/:projectId/sprints" element={<Sprints />} />
                    <Route path="/project/:projectId/history" element={<ProjectHistory />} />
                    <Route path="/project/:projectId/pages" element={<ProjectPages />} />
                    <Route path="/project/:projectId/references" element={<ProjectReferences />} />
                    <Route path="/project/:projectId/ad-factory" element={<AdFactory />} />
                    <Route path="/project/:projectId/characters" element={<Characters />} />
                    <Route path="/project/:projectId/videos" element={<Videos />} />
                    <Route path="/project/:projectId/models" element={<Models />} />
                  </Route>
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </AssistantProvider>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
