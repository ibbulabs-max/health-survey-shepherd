import { Link } from "@tanstack/react-router";
import { MessageCircle, Headset, Phone, HelpCircle } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";
import { appConfig } from "@/config/app";

export function PublicFooter() {
  const { globalSettings } = useSettings();
  const appName = globalSettings?.app_name || appConfig.name;
  const whatsappNumber = globalSettings?.contact_whatsapp?.replace(/[^0-9]/g, '');

  return (
    <footer className="w-full pb-10 relative z-10 px-4 sm:px-6 lg:px-8 mt-12">
      
      {/* Desktop: One big pill container. Mobile: Transparent container, separate cards */}
      <div className="max-w-[1920px] mx-auto lg:max-w-7xl lg:bg-white lg:dark:bg-slate-900 lg:rounded-[3rem] lg:shadow-[0_8px_30px_rgb(0,0,0,0.04)] lg:border lg:border-slate-100 lg:dark:border-slate-800 lg:p-6 xl:p-8">
        
        {/* Support Grid Section */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-2 mb-8 lg:mb-0">
          
          <a href={whatsappNumber ? `https://wa.me/${whatsappNumber}` : '#'} target="_blank" rel="noopener noreferrer" className="flex flex-col lg:flex-row items-center lg:items-center text-center lg:text-left gap-3 lg:gap-4 p-5 lg:p-4 rounded-[2rem] lg:rounded-2xl bg-white dark:bg-slate-900 lg:bg-transparent lg:dark:bg-transparent shadow-sm lg:shadow-none border border-slate-100 lg:border-transparent lg:hover:bg-slate-50 lg:dark:hover:bg-slate-800 transition-colors group">
            <div className="size-12 lg:size-11 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:scale-105 transition-transform shrink-0">
              <MessageCircle className="size-6 lg:size-5" />
            </div>
            <div>
              <h4 className="font-bold text-[14px] lg:text-[15px] text-slate-900 dark:text-slate-100 leading-tight">WhatsApp</h4>
              <p className="text-[11px] lg:text-[13px] text-slate-500 mt-0.5">Chat with us</p>
            </div>
          </a>
          
          <Link to="/help-support" className="flex flex-col lg:flex-row items-center lg:items-center text-center lg:text-left gap-3 lg:gap-4 p-5 lg:p-4 rounded-[2rem] lg:rounded-2xl bg-white dark:bg-slate-900 lg:bg-transparent lg:dark:bg-transparent shadow-sm lg:shadow-none border border-slate-100 lg:border-transparent lg:hover:bg-slate-50 lg:dark:hover:bg-slate-800 transition-colors group">
            <div className="size-12 lg:size-11 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover:scale-105 transition-transform shrink-0">
              <Headset className="size-6 lg:size-5" />
            </div>
            <div>
              <h4 className="font-bold text-[14px] lg:text-[15px] text-slate-900 dark:text-slate-100 leading-tight">Help & Support</h4>
              <p className="text-[11px] lg:text-[13px] text-slate-500 mt-0.5">Get assistance</p>
            </div>
          </Link>

          <Link to="/contact" className="flex flex-col lg:flex-row items-center lg:items-center text-center lg:text-left gap-3 lg:gap-4 p-5 lg:p-4 rounded-[2rem] lg:rounded-2xl bg-white dark:bg-slate-900 lg:bg-transparent lg:dark:bg-transparent shadow-sm lg:shadow-none border border-slate-100 lg:border-transparent lg:hover:bg-slate-50 lg:dark:hover:bg-slate-800 transition-colors group">
            <div className="size-12 lg:size-11 rounded-full bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center text-purple-600 group-hover:scale-105 transition-transform shrink-0">
              <Phone className="size-6 lg:size-5" />
            </div>
            <div>
              <h4 className="font-bold text-[14px] lg:text-[15px] text-slate-900 dark:text-slate-100 leading-tight">Contact</h4>
              <p className="text-[11px] lg:text-[13px] text-slate-500 mt-0.5">Reach our team</p>
            </div>
          </Link>

          <Link to="/faq" className="flex flex-col lg:flex-row items-center lg:items-center text-center lg:text-left gap-3 lg:gap-4 p-5 lg:p-4 rounded-[2rem] lg:rounded-2xl bg-white dark:bg-slate-900 lg:bg-transparent lg:dark:bg-transparent shadow-sm lg:shadow-none border border-slate-100 lg:border-transparent lg:hover:bg-slate-50 lg:dark:hover:bg-slate-800 transition-colors group">
            <div className="size-12 lg:size-11 rounded-full bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center text-amber-500 group-hover:scale-105 transition-transform shrink-0">
              <HelpCircle className="size-6 lg:size-5" />
            </div>
            <div>
              <h4 className="font-bold text-[14px] lg:text-[15px] text-slate-900 dark:text-slate-100 leading-tight">FAQ</h4>
              <p className="text-[11px] lg:text-[13px] text-slate-500 mt-0.5">Common questions</p>
            </div>
          </Link>

        </div>

        <div className="hidden lg:block w-full h-px bg-slate-100 dark:bg-slate-800 my-4"></div>

        {/* Links and Copyright */}
        <div className="flex flex-col lg:flex-row justify-between items-center gap-6 lg:gap-8 lg:px-4">
          
          <div className="flex flex-wrap justify-center items-center gap-4 sm:gap-6 text-[11px] lg:text-[13px] font-semibold text-slate-500">
            <Link to="/privacy" className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors">Privacy Policy</Link>
            <span className="text-slate-300">|</span>
            <Link to="/terms" className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors">Terms of Service</Link>
            <span className="text-slate-300">|</span>
            <Link to="/about" className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors">About</Link>
          </div>

          <div className="flex items-center gap-3 bg-white dark:bg-slate-900 lg:bg-transparent lg:dark:bg-transparent px-6 py-3 lg:p-0 rounded-full shadow-sm lg:shadow-none border border-slate-100 lg:border-transparent lg:dark:border-transparent">
            {globalSettings?.app_logo ? (
              <img src={globalSettings.app_logo} alt="Logo" className="size-8 rounded-full bg-blue-600 object-cover" />
            ) : (
              <div className="size-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shadow-md">
                {appName[0]}
              </div>
            )}
            <div className="text-[11px] font-medium text-slate-500">
              Powered by <span className="font-bold text-slate-900 dark:text-slate-100 tracking-tight">Ibrahim Labs</span> <span className="ml-1 opacity-60">›</span>
            </div>
            <div className="text-[10px] text-slate-400 font-medium ml-2">
              v3.0
            </div>
          </div>

        </div>

      </div>
    </footer>
  );
}
