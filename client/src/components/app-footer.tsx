import { Link } from "wouter";
import { HexadIcon } from '@/components/beehive-logos';
import { Github, Twitter, Linkedin, Mail } from "lucide-react";

export function AppFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-card">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Column */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <HexadIcon size={60} className="flex-shrink-0" />
            </div>
            <p className="text-sm text-muted-foreground max-w-xs">
              Where AI agents swarm together to build your code. Enterprise-grade platform for rapid development.
            </p>
            <div className="flex gap-3">
              <a
                href="https://github.com/6-7Development/archetype"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="GitHub"
              >
                <Github className="w-5 h-5" />
              </a>
              <a
                href="https://twitter.com/lomuai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Twitter"
              >
                <Twitter className="w-5 h-5" />
              </a>
              <a
                href="https://linkedin.com/company/lomu"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="LinkedIn"
              >
                <Linkedin className="w-5 h-5" />
              </a>
              <a
                href="mailto:support@getdc360.com"
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Email"
              >
                <Mail className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Product Column */}
          <div>
            <h3 className="font-semibold mb-4">Product</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/dashboard" className="hover:text-foreground transition-colors">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link href="/builder" className="hover:text-foreground transition-colors">
                  Builder
                </Link>
              </li>
              <li>
                <Link href="/marketplace" className="hover:text-foreground transition-colors">
                  Marketplace
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-foreground transition-colors">
                  Pricing
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources Column */}
          <div>
            <h3 className="font-semibold mb-4">Resources</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/docs" className="hover:text-foreground transition-colors">
                  Documentation
                </Link>
              </li>
              <li>
                <Link href="/api-reference" className="hover:text-foreground transition-colors">
                  API Reference
                </Link>
              </li>
              <li>
                <Link href="/support" className="hover:text-foreground transition-colors">
                  Support
                </Link>
              </li>
              <li>
                <Link href="/blog" className="hover:text-foreground transition-colors">
                  Blog
                </Link>
              </li>
            </ul>
          </div>

          {/* Company Column */}
          <div>
            <h3 className="font-semibold mb-4">Company</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <a href="https://getdc360.com" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
                  About Drill Consulting 360
                </a>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-foreground transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-foreground transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <a href="mailto:support@getdc360.com" className="hover:text-foreground transition-colors">
                  Contact Us
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 pt-8 border-t">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground text-center md:text-left">
              © {currentYear} <span className="font-semibold text-foreground">Drill Consulting 360 LLC</span>. All rights reserved.
            </p>
            <p className="text-xs text-muted-foreground text-center md:text-right">
              Built for Fortune 500 production readiness
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
