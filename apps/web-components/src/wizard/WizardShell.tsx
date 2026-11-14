import React from "react";
import { Lang, I18N } from "@db/shared-schemas";

export interface WizardShellProps {
  apiUrl?: string;
  partnerId?: string;
  lang?: Lang;
  theme?: "terracotta" | "high-contrast";
  mode?: "standalone" | "lti" | "partner-assisted";
  ltiToken?: string;
  sessionId?: string;
  onDispatch?: (eventName: string, detail: unknown) => void;
}

export const WizardShell: React.FC<WizardShellProps> = ({ lang = "en" }) => {
  return (
    <section aria-labelledby="db-wizard-heading" className="p-6 rounded-lg border-2 border-terracotta bg-parchment text-ink">
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only" />
      <p className="text-sm mb-3">{I18N[lang]["banner.intro"]}</p>
      <h2 id="db-wizard-heading" tabIndex={-1} className="text-xl font-bold mb-4">
        {I18N[lang]["step0.title"]}
      </h2>
    </section>
  );
};
