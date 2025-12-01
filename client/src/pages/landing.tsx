/**
 * Landing Page - Fully Dynamic & Configurable
 * ============================================
 * All content is pulled from site-config.ts
 * Edit that file to customize everything on this page.
 */

import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BeeHiveLogo } from "@/components/beehive-logo";
import { ArrowRight, Menu, DollarSign, LogIn, Rocket } from "lucide-react";
import { useState } from "react";

import {
  BRAND,
  THEME,
  LAYOUT,
  HERO,
  PLATFORM_SECTION,
  FEATURES_SECTION,
  CTA_SECTION,
  FOOTER,
  NAVIGATION,
  COMPONENTS,
  getGradientClasses,
  getIconContainerClasses,
  getTextColorClass,
} from "@/config/site-config";

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Honeycomb Pattern Background */}
      <HoneycombBackground />

      {/* Navigation */}
      <Navigation menuOpen={menuOpen} setMenuOpen={setMenuOpen} />

      {/* Hero Section */}
      <HeroSection />

      {/* Platform Screenshots */}
      <PlatformSection />

      {/* Core Features */}
      <FeaturesSection />

      {/* CTA Section */}
      <CTASection />

      {/* Footer */}
      <FooterSection />
    </div>
  );
}

// ============================================================================
// BACKGROUND COMPONENT
// ============================================================================
function HoneycombBackground() {
  return (
    <div className="absolute inset-0 opacity-5">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0l25.98 15v30L30 60 4.02 45V15z' fill='none' stroke='%23${THEME.colors.honey.value.slice(1)}' stroke-width='1'/%3E%3C/svg%3E")`,
          backgroundSize: "60px 60px",
        }}
      />
    </div>
  );
}

// ============================================================================
// NAVIGATION COMPONENT
// ============================================================================
interface NavigationProps {
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
}

function Navigation({ menuOpen, setMenuOpen }: NavigationProps) {
  return (
    <nav className={`fixed top-0 w-full z-50 border-b border-honey/10 bg-background/90 ${LAYOUT.nav.blur}`}>
      <div className={`container mx-auto px-3 sm:px-6 py-2 sm:py-3 md:py-4 ${LAYOUT.nav.height.mobile} ${LAYOUT.nav.height.tablet} ${LAYOUT.nav.height.desktop}`}>
        <div className="flex flex-wrap items-center justify-between gap-4 md:gap-6">
          {/* Logo */}
          <Link
            href="/"
            data-testid="link-home"
            className="inline-flex items-center hover-elevate flex-shrink-0"
          >
            <BeeHiveLogo
              size="lg"
              className="hidden lg:block"
              variant="dark"
              showText={BRAND.logo.showText}
            />
            <BeeHiveLogo
              size="md"
              className="lg:hidden"
              variant="dark"
              showText={BRAND.logo.showText}
            />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-3 flex-shrink-0">
            {NAVIGATION.desktop.map((item) => (
              <Button
                key={item.href}
                variant="ghost"
                className="text-foreground/80 hover:text-foreground"
                data-testid={item.testId}
                asChild
              >
                <Link href={item.href}>{item.label}</Link>
              </Button>
            ))}
            <Button
              className={COMPONENTS.button.primary}
              data-testid={NAVIGATION.cta.testId}
              asChild
            >
              <Link href={NAVIGATION.cta.href}>{NAVIGATION.cta.label}</Link>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="min-h-[44px] min-w-[44px]"
              onClick={() => setMenuOpen(!menuOpen)}
              data-testid="button-mobile-menu"
              aria-label="Toggle menu"
            >
              <Menu className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {menuOpen && (
          <div className="md:hidden mt-4 pb-2 space-y-2">
            {NAVIGATION.mobile.map((item) => {
              const Icon = item.icon === "DollarSign" ? DollarSign : item.icon === "LogIn" ? LogIn : Rocket;
              return (
                <Button
                  key={item.href}
                  variant={item.primary ? "default" : item.icon === "LogIn" ? "outline" : "ghost"}
                  className={`w-full min-h-[44px] ${item.primary ? COMPONENTS.button.primary : ""}`}
                  asChild
                  data-testid={item.testId}
                >
                  <Link href={item.href} onClick={() => setMenuOpen(false)}>
                    <span className="flex items-center gap-2 w-full">
                      <Icon className="w-4 h-4" />
                      {item.label}
                    </span>
                  </Link>
                </Button>
              );
            })}
          </div>
        )}
      </div>
    </nav>
  );
}

// ============================================================================
// HERO SECTION COMPONENT
// ============================================================================
function HeroSection() {
  const HeroBadgeIcon = HERO.badge.icon;
  const PrimaryCtaIcon = HERO.cta.primary.icon;

  return (
    <section className="pt-32 sm:pt-36 md:pt-44 pb-12 sm:pb-20 md:pb-24 px-3 sm:px-6 relative z-10">
      <div className={`container mx-auto ${LAYOUT.container.lg} text-center`}>
        {/* Badge */}
        <div
          className={`mb-6 sm:mb-8 inline-flex items-center gap-2 px-4 py-2 sm:gap-3 sm:px-6 sm:py-3 rounded-full bg-gradient-to-r ${THEME.gradients.hero} border border-honey/20 backdrop-blur-sm shadow-sm hover-elevate transition-all ${ANIMATIONS.duration.normal}`}
          data-testid={HERO.badge.testId}
        >
          <HeroBadgeIcon className="w-3 h-3 sm:w-4 sm:h-4 text-honey flex-shrink-0 animate-pulse" />
          <span className={`text-xs sm:text-sm bg-gradient-to-r ${THEME.gradients.primary} bg-clip-text text-transparent font-semibold`}>
            {HERO.badge.text}
          </span>
        </div>

        {/* Main Headline */}
        <h1
          className="font-bold mb-4 sm:mb-6 leading-[1.1] tracking-tight"
          style={{ fontSize: "clamp(2.25rem, 7vw, 5rem)" }}
          data-testid={HERO.headline.testId}
        >
          <span className={`bg-gradient-to-r ${THEME.gradients.primary} bg-clip-text text-transparent text-balance inline-block`}>
            {HERO.headline.text}
          </span>
        </h1>

        {/* Subheadline */}
        <p
          className="text-base sm:text-xl md:text-2xl text-muted-foreground mb-8 sm:mb-12 max-w-3xl mx-auto leading-relaxed font-light"
          data-testid={HERO.subheadline.testId}
        >
          {HERO.subheadline.text}
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-stretch sm:items-center mb-12 sm:mb-20 md:mb-24 max-w-xs sm:max-w-none mx-auto">
          <Button
            size="lg"
            className={`w-full sm:w-auto min-h-[52px] ${COMPONENTS.button.primary} text-base sm:text-lg px-8 sm:px-10 ${THEME.shadows.honey} transition-all ${ANIMATIONS.duration.normal}`}
            data-testid={HERO.cta.primary.testId}
            asChild
          >
            <Link href={HERO.cta.primary.href}>
              <span className="flex items-center gap-2">
                <PrimaryCtaIcon className="w-5 h-5" />
                {HERO.cta.primary.text}
              </span>
            </Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className={`w-full sm:w-auto min-h-[52px] ${COMPONENTS.button.outline} text-base sm:text-lg px-8 sm:px-10 transition-all ${ANIMATIONS.duration.normal}`}
            data-testid={HERO.cta.secondary.testId}
            asChild
          >
            <Link href={HERO.cta.secondary.href}>
              <span className="flex items-center gap-2">
                {HERO.cta.secondary.text}
                <ArrowRight className="w-5 h-5" />
              </span>
            </Link>
          </Button>
        </div>

        {/* Stats Grid */}
        <div className={`grid ${LAYOUT.grid.stats} ${LAYOUT.gap.sm} max-w-5xl mx-auto`}>
          {HERO.stats.map((stat, i) => (
            <StatCard key={i} stat={stat} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// STAT CARD COMPONENT
// ============================================================================
interface StatCardProps {
  stat: typeof HERO.stats[number];
}

function StatCard({ stat }: StatCardProps) {
  const Icon = stat.icon;
  return (
    <div
      data-testid={stat.testId}
      className={`group text-center p-4 sm:p-6 rounded-xl ${COMPONENTS.card.default}`}
    >
      <Icon className={`w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-3 text-honey ${ANIMATIONS.hover.scale} transition-transform ${ANIMATIONS.duration.normal}`} />
      <div className={`text-xl sm:text-2xl font-bold bg-gradient-to-r from-honey to-nectar bg-clip-text text-transparent mb-1`}>
        {stat.value}
      </div>
      <div className="text-xs sm:text-sm text-muted-foreground font-medium">
        {stat.label}
      </div>
    </div>
  );
}

// ============================================================================
// PLATFORM SECTION COMPONENT
// ============================================================================
function PlatformSection() {
  return (
    <section className={`pt-20 sm:pt-24 md:pt-32 ${LAYOUT.section.padding.md} relative`}>
      <div className={`container mx-auto ${LAYOUT.container.lg}`}>
        <div className="text-center mb-12 sm:mb-16">
          <h2
            className="text-3xl sm:text-4xl md:text-5xl font-bold text-center mb-4 text-foreground break-words"
            data-testid={PLATFORM_SECTION.testId}
          >
            {PLATFORM_SECTION.title}
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
            {PLATFORM_SECTION.subtitle}
          </p>
        </div>

        <div className={`grid ${LAYOUT.grid.screenshots} ${LAYOUT.gap.lg}`}>
          {PLATFORM_SECTION.screenshots.map((screenshot, i) => (
            <ScreenshotCard key={i} screenshot={screenshot} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// SCREENSHOT CARD COMPONENT
// ============================================================================
interface ScreenshotCardProps {
  screenshot: typeof PLATFORM_SECTION.screenshots[number];
}

function ScreenshotCard({ screenshot }: ScreenshotCardProps) {
  const Icon = screenshot.icon;
  const gradientClasses = getGradientClasses(screenshot.gradient as "honey" | "mint");
  const iconContainerClasses = getIconContainerClasses(screenshot.gradient as "honey" | "mint");
  const textColorClass = getTextColorClass(screenshot.gradient as "honey" | "mint");

  return (
    <Card
      data-testid={screenshot.testId}
      className={`group p-6 sm:p-8 ${COMPONENTS.card.screenshot}`}
    >
      <div className={`aspect-video bg-gradient-to-br ${gradientClasses} rounded-xl border border-border flex items-center justify-center mb-5 relative`}>
        <div className="text-center z-10">
          <div className={`inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full ${iconContainerClasses} border mb-3 ${ANIMATIONS.hover.scale} transition-transform ${ANIMATIONS.duration.normal}`}>
            <Icon className={`w-8 sm:w-10 h-8 sm:h-10 ${textColorClass}`} />
          </div>
          <p className="text-sm sm:text-base text-foreground/90 font-semibold">
            {screenshot.iconLabel}
          </p>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {screenshot.iconSubLabel}
          </p>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-background/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>
      <h3 className="text-lg sm:text-xl font-bold text-foreground mb-3 break-words">
        {screenshot.title}
      </h3>
      <p className="text-sm sm:text-base text-muted-foreground break-words leading-relaxed">
        {screenshot.description}
      </p>
    </Card>
  );
}

// ============================================================================
// FEATURES SECTION COMPONENT
// ============================================================================
function FeaturesSection() {
  return (
    <section className={`${LAYOUT.section.padding.lg} relative bg-gradient-to-b from-transparent via-honey/5 to-transparent`}>
      <div className={`container mx-auto ${LAYOUT.container.lg}`}>
        <div className="text-center mb-16 sm:mb-20">
          <h2
            className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 sm:mb-6 break-words"
            data-testid={FEATURES_SECTION.testId}
          >
            <span className={`bg-gradient-to-r ${THEME.gradients.primary} bg-clip-text text-transparent`}>
              {FEATURES_SECTION.title}
            </span>
          </h2>
          <p className="text-base sm:text-xl text-muted-foreground break-words max-w-2xl mx-auto">
            {FEATURES_SECTION.subtitle}
          </p>
        </div>

        <div className={`grid ${LAYOUT.grid.features} ${LAYOUT.gap.lg}`}>
          {FEATURES_SECTION.features.map((feature, i) => (
            <FeatureCard
              key={i}
              feature={feature}
              isLast={i === FEATURES_SECTION.features.length - 1}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// FEATURE CARD COMPONENT
// ============================================================================
interface FeatureCardProps {
  feature: typeof FEATURES_SECTION.features[number];
  isLast: boolean;
}

function FeatureCard({ feature, isLast }: FeatureCardProps) {
  const Icon = feature.icon;
  const iconContainerClasses = getIconContainerClasses(feature.color as "honey" | "mint");
  const textColorClass = getTextColorClass(feature.color as "honey" | "mint");

  return (
    <Card
      className={`group p-8 sm:p-10 ${COMPONENTS.card.feature} ${isLast ? "sm:col-span-2 lg:col-span-1" : ""}`}
      data-testid={feature.testId}
    >
      <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl ${iconContainerClasses} flex items-center justify-center ${textColorClass} mb-6 ${ANIMATIONS.hover.scale} transition-transform ${ANIMATIONS.duration.normal} border`}>
        <Icon className="w-8 sm:w-10 h-8 sm:h-10" />
      </div>
      <h3 className="text-xl sm:text-2xl font-bold mb-4 text-foreground break-words">
        {feature.title}
      </h3>
      <p className="text-sm sm:text-base text-muted-foreground leading-relaxed break-words">
        {feature.description}
      </p>
    </Card>
  );
}

// ============================================================================
// CTA SECTION COMPONENT
// ============================================================================
function CTASection() {
  const BadgeIcon = CTA_SECTION.badge.icon;
  const PrimaryIcon = CTA_SECTION.cta.primary.icon;

  return (
    <section className={`${LAYOUT.section.padding.lg} relative overflow-hidden`}>
      <div className={`container mx-auto ${LAYOUT.container.md} text-center relative z-10`}>
        <div className={`relative p-10 sm:p-12 md:p-16 rounded-3xl bg-gradient-to-br ${THEME.gradients.cta} border border-honey/20 backdrop-blur-sm ${THEME.shadows.cta} overflow-hidden`}>
          {/* Decorative gradient orbs */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-honey/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-mint/20 rounded-full blur-3xl" />

          <div className="relative z-10">
            {/* Badge */}
            <div
              data-testid={CTA_SECTION.badge.testId}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${COMPONENTS.badge.default} border mb-6`}
            >
              <BadgeIcon className="w-4 h-4 text-honey animate-pulse" />
              <span className="text-sm font-semibold text-honey">
                {CTA_SECTION.badge.text}
              </span>
            </div>

            {/* Headline */}
            <h2
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-5 sm:mb-6 break-words"
              data-testid={CTA_SECTION.headline.testId}
            >
              <span className={`bg-gradient-to-r ${THEME.gradients.primary} bg-clip-text text-transparent`}>
                {CTA_SECTION.headline.text}
              </span>
            </h2>

            {/* Subheadline */}
            <p
              className="text-base sm:text-xl md:text-2xl text-muted-foreground mb-10 sm:mb-12 max-w-2xl mx-auto leading-relaxed"
              data-testid={CTA_SECTION.subheadline.testId}
            >
              {CTA_SECTION.subheadline.text}
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-xs sm:max-w-none mx-auto">
              <Button
                size="lg"
                className={`w-full sm:w-auto min-h-[56px] ${COMPONENTS.button.primary} font-bold text-lg px-10 shadow-lg shadow-honey/30 transition-all ${ANIMATIONS.duration.normal}`}
                data-testid={CTA_SECTION.cta.primary.testId}
                asChild
              >
                <Link href={CTA_SECTION.cta.primary.href}>
                  <span className="flex items-center gap-2">
                    <PrimaryIcon className="w-5 h-5" />
                    {CTA_SECTION.cta.primary.text}
                  </span>
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className={`w-full sm:w-auto min-h-[56px] ${COMPONENTS.button.outline} text-lg px-10 transition-all ${ANIMATIONS.duration.normal}`}
                data-testid={CTA_SECTION.cta.secondary.testId}
                asChild
              >
                <Link href={CTA_SECTION.cta.secondary.href}>
                  {CTA_SECTION.cta.secondary.text}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// FOOTER SECTION COMPONENT
// ============================================================================
function FooterSection() {
  return (
    <footer className="border-t border-border bg-gradient-to-b from-transparent to-honey/5 py-12 sm:py-16 px-4 sm:px-6">
      <div className={`container mx-auto ${LAYOUT.container.lg}`}>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-8 text-center sm:text-left mb-8">
          <div className="flex flex-col items-center sm:items-start gap-3">
            <BeeHiveLogo size="lg" className="flex-shrink-0" data-testid="icon-footer-logo" />
            <p className="text-muted-foreground text-sm font-medium">
              {FOOTER.tagline}
            </p>
          </div>
          <div className="flex gap-6 flex-wrap justify-center">
            {FOOTER.links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-foreground hover:text-honey text-base font-medium min-h-[44px] flex items-center transition-colors duration-200"
                data-testid={link.testId}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="text-center text-muted-foreground text-sm pt-4 border-t border-border">
          <span data-testid={FOOTER.testId}>{FOOTER.copyright}</span>
        </div>
      </div>
    </footer>
  );
}

// Animation constant for use in components
const ANIMATIONS = {
  duration: {
    fast: "duration-150",
    normal: "duration-300",
    slow: "duration-500",
  },
  hover: {
    scale: "group-hover:scale-110",
    lift: "hover-elevate",
    glow: "hover:shadow-lg",
  },
};
