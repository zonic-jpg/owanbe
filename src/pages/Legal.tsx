import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const CONTENT: Record<string, { title: string; body: string[] }> = {
  privacy: {
    title: "Privacy Policy",
    body: [
      "Owanbe Planner collects the information you provide to plan your event: your account details, event details, guest lists, and vendor interactions.",
      "Guest contact details you add are used solely to help you manage invitations and aso-ebi distribution. They are never sold or shared with third parties.",
      "Payments are processed by our payment partners (Paystack, Flutterwave, Stripe); we do not store card details on our servers.",
      "Your data is protected by row-level security so you can only access records belonging to you. You may request export or deletion at any time.",
    ],
  },
  terms: {
    title: "Terms of Service",
    body: [
      "By using Owanbe Planner you agree to use the platform to plan legitimate events and to treat vendors and guests respectfully.",
      "Paid services are charged according to the pricing shown at the point of purchase. Where a service gate is active, access requires payment as displayed.",
      "Vendor listings, quotes, and aso-ebi provider details are provided to assist your planning; final agreements are between you and the vendor.",
      "We may update these terms; continued use after an update constitutes acceptance.",
    ],
  },
  contact: {
    title: "Contact Us",
    body: [
      "We'd love to hear from you — for support, vendor partnerships, or feedback.",
      "Email: hello@owanbeplanner.com",
      "For vendor onboarding and enterprise event management, reach out and our team will respond within one business day.",
    ],
  },
};

export default function Legal({ page }: { page: "privacy" | "terms" | "contact" }) {
  const c = CONTENT[page];
  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <Link to="/" className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4" /> Back home
      </Link>
      <h1 className="text-3xl font-bold tracking-tight mb-6">{c.title}</h1>
      <div className="space-y-4">
        {c.body.map((p, i) => <p key={i} className="text-muted-foreground leading-relaxed">{p}</p>)}
      </div>
    </div>
  );
}
