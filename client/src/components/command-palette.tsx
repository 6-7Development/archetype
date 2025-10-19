import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  Sparkles,
  FolderTree,
  Settings,
  CreditCard,
  Users,
  HelpCircle,
  BookOpen,
  Terminal,
  History,
  Key,
  LogOut
} from "lucide-react";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  const pages = [
    {
      group: "Pages",
      items: [
        { label: "Dashboard", icon: LayoutDashboard, action: () => setLocation("/dashboard") },
        { label: "Builder", icon: Sparkles, action: () => setLocation("/builder") },
        { label: "Marketplace", icon: BookOpen, action: () => setLocation("/marketplace") },
        { label: "Analytics", icon: Terminal, action: () => setLocation("/analytics") },
        { label: "Version History", icon: History, action: () => setLocation("/version-history") },
        { label: "Team", icon: Users, action: () => setLocation("/team") },
      ]
    },
    {
      group: "Settings",
      items: [
        { label: "Account Settings", icon: Settings, action: () => setLocation("/account") },
        { label: "API Keys", icon: Key, action: () => setLocation("/api-keys") },
        { label: "Billing & Plans", icon: CreditCard, action: () => setLocation("/pricing") },
      ]
    },
    {
      group: "Support",
      items: [
        { label: "Support Tickets", icon: HelpCircle, action: () => setLocation("/support") },
        { label: "Documentation", icon: BookOpen, action: () => window.open("https://docs.archetype.dev", "_blank") },
      ]
    },
    {
      group: "Actions",
      items: [
        { label: "Sign Out", icon: LogOut, action: () => window.location.href = "/api/logout" },
      ]
    }
  ];

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." data-testid="input-command-palette" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {pages.map((section) => (
          <CommandGroup key={section.group} heading={section.group}>
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <CommandItem
                  key={item.label}
                  onSelect={() => runCommand(item.action)}
                  data-testid={`command-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  <span>{item.label}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
