import { useState } from "react";
import { Link } from "wouter";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

interface NavLink {
  href: string;
  label: string;
  testId?: string;
}

interface MobileNavProps {
  links: NavLink[];
  logo?: React.ReactNode;
}

export function MobileNav({ links, logo }: MobileNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open navigation menu"
            data-testid="button-mobile-menu"
            className="text-white hover:text-white"
          >
            <Menu className="w-5 h-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[280px] sm:w-[320px]">
          <div className="flex flex-col gap-6 pt-6">
            {logo && <div className="pb-4 border-b" data-testid="mobile-nav-logo">{logo}</div>}
            <nav className="flex flex-col gap-3">
              {links.map((link, i) => (
                <Button
                  key={i}
                  variant="ghost"
                  className="w-full justify-start text-base"
                  onClick={() => setOpen(false)}
                  data-testid={link.testId || `button-nav-mobile-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
                  asChild
                >
                  <Link href={link.href}>{link.label}</Link>
                </Button>
              ))}
            </nav>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
