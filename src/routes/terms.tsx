import { createFileRoute, Link } from "@tanstack/react-router";
import { Sprout } from "lucide-react";

export const Route = createFileRoute("/terms")({ component: TermsPage });

function TermsPage() {
  return (
    <div className="min-h-screen bg-secondary px-4 py-10">
      <div className="mx-auto w-full max-w-3xl">
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground mb-4">
            <Sprout className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-display font-semibold">Terms of Service</h1>
          <p className="text-muted-foreground text-sm mt-1">Homestead Hub · Effective October 21, 2026</p>
        </div>

        <div className="rounded-xl border bg-card p-6 sm:p-8 space-y-6 text-sm leading-relaxed [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mb-2 [&_p]:text-muted-foreground [&_li]:text-muted-foreground [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
          <p>
            Homestead Hub is operated by Evergrace Homestead ("we," "us"). By creating an account or
            using Homestead Hub (the "Service"), you agree to these terms. If you do not agree, please
            do not use the Service. Questions:{" "}
            <a className="underline" href="mailto:evergracehomesteader@gmail.com">evergracehomesteader@gmail.com</a>
          </p>

          <section>
            <h2>1. What the Service is</h2>
            <p>
              Homestead Hub is a record-keeping and planning tool for homesteads and small farms:
              animal records, chores, feed and supply tracking, bills and income records, garden and
              production logs, and related features. The Service is a tool to help you organize your
              own information — it is not a substitute for professional advice (see Section 7).
            </p>
          </section>

          <section>
            <h2>2. Accounts</h2>
            <ul>
              <li>You must provide accurate information when you create an account and keep your sign-in credentials secure. You are responsible for activity under your account.</li>
              <li>New accounts may require approval before full access is granted.</li>
              <li>A homestead owner or admin controls who is invited to their homestead and what role each member has. Members should only access homesteads they have been invited to.</li>
              <li>You may close your account at any time by contacting us.</li>
            </ul>
          </section>

          <section>
            <h2>3. Acceptable use</h2>
            <p>You agree not to:</p>
            <ul>
              <li>Use the Service for anything unlawful, or to store or share unlawful content.</li>
              <li>Try to access another homestead's data or another user's account without permission.</li>
              <li>Attempt to break, probe, or overload the Service's security or infrastructure.</li>
              <li>Upload malicious code or content that infringes someone else's rights.</li>
              <li>Misrepresent your identity or affiliation.</li>
            </ul>
            <p className="mt-2">We may suspend or remove accounts that violate these terms.</p>
          </section>

          <section>
            <h2>4. Your content</h2>
            <ul>
              <li><strong className="text-foreground">You own your data.</strong> The records, photos, and other content you enter remain yours.</li>
              <li>You give us a limited license to store, process, display, and back up your content solely so we can operate the Service for you and your homestead members.</li>
              <li>You are responsible for the content you add and for having the right to add it.</li>
              <li>Shared homesteads: content you add to a homestead is visible to that homestead's members, as described in the Privacy Policy. The homestead owner or admin may manage membership and shared content.</li>
            </ul>
          </section>

          <section>
            <h2>5. Availability and changes</h2>
            <p>
              The Service is provided on an "as is" and "as available" basis. We work to keep it
              running — including offline features that let you keep working without a connection —
              but we do not guarantee it will always be available or error-free. We may add, change,
              or retire features, and we will try to give reasonable notice of changes that matter.
            </p>
            <p className="mt-2">
              Homestead Hub works offline and syncs when you reconnect. While we take reasonable care,
              sync conflicts or device loss can cause data loss — keeping your own important records
              backed up is a good practice.
            </p>
          </section>

          <section>
            <h2>6. Weather and third-party data</h2>
            <p>
              Weather information is provided by third-party sources (Open-Meteo) and may be
              inaccurate or delayed. Do not rely on the Service as your only source of weather or
              safety information, especially for protecting animals in severe weather.
            </p>
          </section>

          <section>
            <h2>7. Not professional advice</h2>
            <p>
              Homestead Hub is a record-keeping tool. Nothing in the Service is veterinary, medical,
              legal, tax, or financial advice. Animal health decisions, breeding decisions, and
              business decisions are yours — consult a qualified professional (for example, a
              veterinarian) when it matters.
            </p>
          </section>

          <section>
            <h2>8. Liability</h2>
            <p>
              To the fullest extent allowed by law, we are not liable for indirect, incidental, or
              consequential damages arising from use of the Service — including lost profits, lost
              records, or livestock or crop losses. Our total liability for any claim is limited to
              the greater of the amount you paid us for the Service in the prior 12 months or $50.
            </p>
          </section>

          <section>
            <h2>9. Termination</h2>
            <p>
              You may stop using the Service at any time. We may suspend or end your access if you
              violate these terms or if we discontinue the Service; if we discontinue it, we will
              give reasonable notice and a way to export your data where practical.
            </p>
          </section>

          <section>
            <h2>10. Paid plans</h2>
            <p>
              The Service is currently offered without paid plans. If paid plans are introduced,
              their price and terms will be presented before you subscribe, and these terms will be
              updated.
            </p>
          </section>

          <section>
            <h2>11. Governing law</h2>
            <p>
              These terms are governed by the laws of the State of Missouri, USA. Any dispute will be
              handled in the state or federal courts located in Missouri, unless applicable law
              requires otherwise.
            </p>
          </section>

          <section>
            <h2>12. Changes to these terms</h2>
            <p>
              We may update these terms. If a change is meaningful, we will update the effective date
              above and note the change in the app. Continuing to use the Service after a change
              means you accept the updated terms.
            </p>
          </section>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-6">
          <Link to="/login" className="underline">Back to sign in</Link>
          {" · "}
          <Link to="/privacy" className="underline">Privacy Policy</Link>
        </p>
      </div>
    </div>
  );
}
