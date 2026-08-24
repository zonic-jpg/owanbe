import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

export default function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <AppShell>
      <div className="container py-12">
        <Card className="p-12 text-center max-w-xl mx-auto">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-gold flex items-center justify-center mb-4 shadow-gold">
            <Sparkles className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="font-display text-3xl font-bold">{title}</h1>
          <p className="text-muted-foreground mt-3">{description}</p>
        </Card>
      </div>
    </AppShell>
  );
}
