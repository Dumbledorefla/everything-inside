import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import Dashboard from "./pages/Dashboard";
import ProjectHome from "./pages/ProjectHome";
import ProjectDNA from "./pages/ProjectDNA";
import Production from "./pages/Production";
import ProjectLibrary from "./pages/ProjectLibrary";
import Planning from "./pages/Planning";
import GlobalLibrary from "./pages/GlobalLibrary";
import Models from "./pages/Models";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/library" element={<GlobalLibrary />} />
            <Route path="/models" element={<Models />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/project/:projectId" element={<Navigate to="home" replace />} />
            <Route path="/project/:projectId/home" element={<ProjectHome />} />
            <Route path="/project/:projectId/dna" element={<ProjectDNA />} />
            <Route path="/project/:projectId/production" element={<Production />} />
            <Route path="/project/:projectId/library" element={<ProjectLibrary />} />
            <Route path="/project/:projectId/planning" element={<Planning />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
