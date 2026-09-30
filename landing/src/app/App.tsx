import { Navbar } from "./components/Navbar";
import { HeroSection } from "./components/HeroSection";
import { DashboardShowcase } from "./components/DashboardShowcase";
import { ChallengesSection } from "./components/ChallengesSection";
import { PlatformArchitecture } from "./components/PlatformArchitecture";
import { FeaturesSection } from "./components/FeaturesSection";
import { AdvancedFeatures } from "./components/AdvancedFeatures";
import { AnalyticsDashboard } from "./components/AnalyticsDashboard";
import { TargetCustomers } from "./components/TargetCustomers";
import { PricingSection } from "./components/PricingSection";
import { ProjectExecutionFlow } from "./components/ProjectExecutionFlow";
import { FinalCTA } from "./components/FinalCTA";
import { Footer } from "./components/Footer";

{/* MARKER-MAKE-KIT-INVOKED */}

export default function App() {
  return (
    <div className="min-h-screen bg-white font-sans">
      <Navbar />
      <HeroSection />
      <DashboardShowcase />
      <ChallengesSection />
      <PlatformArchitecture />
      <FeaturesSection />
      <AdvancedFeatures />
      <AnalyticsDashboard />
      <TargetCustomers />
      <PricingSection />
      <ProjectExecutionFlow />
      <FinalCTA />
      <Footer />
    </div>
  );
}
