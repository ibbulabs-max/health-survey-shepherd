import { Link } from "@tanstack/react-router";
import { Menu, Headset, X, Globe, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useSettings } from "@/hooks/useSettings";
import { appConfig } from "@/config/app";
import { cn } from "@/lib/utils";

export function PublicHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { globalSettings } = useSettings();
  
  const appName = globalSettings?.app_name || appConfig.name;
  const orgName = globalSettings?.organization_name || "Enterprise NGO Healthcare Suite";

  const navLinks = [
    { label: "Home", to: "/" },
    { label: "About", to: "/about" },
    { label: "Features", to: "/features" },
    { label: "FAQ", to: "/faq" },
    { label: "Privacy Policy", to: "/privacy" },
    { label: "Contact", to: "/contact" },
  ];

  return (
    <header className="absolute top-0 left-0 right-0 z-50">
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20 lg:h-24">
          
          {/* Logo Section */}
          <div className="flex items-center gap-3">
            {globalSettings?.app_logo ? (
              <img src={globalSettings.app_logo} alt="Logo" className="size-11 rounded-full object-cover shadow-sm" />
            ) : (
              <img src="/logo.jpg" alt="Logo" className="size-11 rounded-full object-cover shadow-sm" onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }} />
            )}
            <div className="hidden size-11 items-center justify-center rounded-full bg-blue-600 text-lg font-bold text-white shadow-md">
              {appName[0]}
            </div>
            <div className="hidden sm:block ml-1">
              <h1 className="font-display text-[15px] font-bold tracking-tight leading-none text-foreground">{appName}</h1>
              <p className="text-[11px] text-muted-foreground font-medium mt-0.5">{orgName}</p>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden xl:flex items-center gap-8">
            {navLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className="text-[13px] font-semibold text-slate-500 hover:text-foreground transition-colors [&.active]:text-blue-600 [&.active]:border-b-2 [&.active]:border-blue-600 pb-1"
                activeProps={{ className: "active" }}
                activeOptions={{ exact: link.to === "/" }}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Desktop Right Actions */}
          <div className="hidden lg:flex items-center gap-4">
            <button className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-600 hover:text-foreground transition-colors">
              <Globe className="size-4" />
              EN <span className="text-xs ml-0.5 text-slate-400">▼</span>
            </button>
            <Link to="/help-support">
              <Button variant="outline" size="sm" className="rounded-full px-5 h-10 font-semibold text-[13px] border-slate-200 text-slate-700 bg-white/50 hover:bg-white shadow-sm">
                <Headset className="size-4 mr-2" />
                Help & Support
              </Button>
            </Link>
            <Link to="/contact">
              <Button size="sm" className="rounded-full px-5 h-10 font-bold text-[13px] bg-blue-600 hover:bg-blue-700 text-white shadow-md">
                <Mail className="size-4 mr-2" />
                Contact Us
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Toggle */}
          <div className="flex items-center gap-2 lg:hidden">
            <Link to="/help-support" className="hidden sm:flex">
              <Button variant="outline" size="sm" className="rounded-full h-9 px-3 font-semibold text-xs border-slate-200 bg-white/50">
                <Headset className="size-4 mr-1.5" />
                Support
              </Button>
            </Link>
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-full border-slate-200 bg-white/50"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      <div 
        className={cn(
          "lg:hidden overflow-hidden transition-all duration-300 bg-white/95 backdrop-blur-xl border-b border-slate-100 shadow-xl",
          mobileMenuOpen ? "max-h-screen opacity-100" : "max-h-0 opacity-0 border-transparent"
        )}
      >
        <div className="px-4 py-4 space-y-1">
          {navLinks.map(link => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setMobileMenuOpen(false)}
              className="block px-4 py-3 text-base font-semibold text-slate-700 hover:bg-slate-50 rounded-xl"
              activeProps={{ className: "bg-blue-50 text-blue-700" }}
              activeOptions={{ exact: link.to === "/" }}
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-4 mt-2 border-t border-slate-100 flex flex-col gap-3 px-4 pb-4">
            <Link to="/help-support" className="w-full" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="outline" className="w-full justify-start h-12 rounded-xl text-sm font-semibold border-slate-200">
                <Headset className="size-5 mr-3 text-slate-500" /> Help & Support
              </Button>
            </Link>
            <Link to="/contact" className="w-full" onClick={() => setMobileMenuOpen(false)}>
              <Button className="w-full h-12 rounded-xl text-sm font-bold shadow-md bg-blue-600 hover:bg-blue-700">
                <Mail className="size-5 mr-3" /> Contact Us
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
