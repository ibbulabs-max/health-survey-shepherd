import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";

export function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background selection:bg-primary/20">
      <PublicHeader />
      <main className="flex-1 flex flex-col w-full relative">
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}
