import React from "react";
import { Lang, I18N } from "@db/shared-schemas";

export interface CareerGatewayProps {
  apiUrl?: string;
  partnerId?: string;
  lang?: Lang;
  theme?: "terracotta" | "high-contrast";
  onDispatch?: (eventName: string, detail: unknown) => void;
}

export const CareerGateway: React.FC<CareerGatewayProps> = ({ lang = "en" }) => {
  return (
    <section aria-labelledby="db-career-heading" className="p-6 rounded-lg border-2 border-terracotta bg-parchment text-ink mt-4">
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only" />
      <h2 id="db-career-heading" tabIndex={-1} className="text-xl font-bold mb-2">
        {I18N[lang]["career.title"]}
      </h2>
    </section>
  );
};
