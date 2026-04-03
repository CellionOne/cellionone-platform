import { ContactSection } from "@/pages/landing";
import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";
import { usePageMeta } from "@/hooks/use-page-meta";

export default function ContactPage() {
  usePageMeta({
    title: "Contact Us — Cellion One",
    description: "Get in touch with the Cellion One team. Have a question about company incorporation, KYC verification, API integration, or any of our services? Fill out the form and we'll get back to you.",
    canonicalPath: "/contact",
  });

  return (
    <div className="min-h-screen bg-background">
      <PublicNav />
      <main className="pt-24">
        <ContactSection />
      </main>
      <PublicFooter />
    </div>
  );
}
