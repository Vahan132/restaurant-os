import { setRequestLocale } from "next-intl/server";
import { Hero } from "@/components/home/Hero";
import { Pillars } from "@/components/home/Pillars";
import { HowItWorks } from "@/components/home/HowItWorks";
import { Testimonials } from "@/components/home/Testimonials";
import { ClosingCTA } from "@/components/home/ClosingCTA";
import { ScrollToSection } from "@/components/site/ScrollToSection";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <ScrollToSection />
      <Hero />
      <Pillars />
      <HowItWorks />
      <Testimonials />
      <ClosingCTA />
    </>
  );
}
