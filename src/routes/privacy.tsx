import { createFileRoute, Link } from "@tanstack/react-router";
import { Sprout } from "lucide-react";

export const Route = createFileRoute("/privacy")({ component: PrivacyPage });

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-secondary px-4 py-10">
      <div className="mx-auto w-full max-w-3xl">
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground mb-4">
            <Sprout className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-display font-semibold">Privacy Policy</h1>
          <p className="text-muted-foreground text-sm mt-1">Homestead Hub · Effective October 21, 2026</p>
        </div>

        <div className="rounded-xl border bg-card p-6 sm:p-8 space-y-6 text-sm leading-relaxed [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mb-2 [&_p]:text-muted-foreground [&_li]:text-muted-foreground [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
          <p>
            Homestead Hub is operated by Evergrace Homestead ("we," "us"). This policy explains what
            information Homestead Hub collects, how it is used, and the choices you have. We wrote it
            in plain language on purpose. Questions:{" "}
            <a className="underline" href="mailto:evergracehomesteader@gmail.com">evergracehomesteader@gmail.com</a>
          </p>

          <section>
            <h2>What we collect</h2>
            <p>
              <strong className="text-foreground">Account information.</strong> When you create an account, we collect your
              email address and a display name. Your password is handled by our authentication provider
              and stored only in encrypted (hashed) form — we never see or store your plain-text password.
            </p>
            <p className="mt-2">
              <strong className="text-foreground">Your homestead data.</strong> Everything you enter into the app is stored so the
              app can work: animal records, breeding and health records, chores and tasks, feed purchases
              and inventory, bills and income entries, garden and production logs, barter records,
              contacts, and similar farm-management information.
            </p>
            <p className="mt-2">
              <strong className="text-foreground">Photos you upload.</strong> Photos you attach to records — for example animal
              photos, barter item photos, and receipt photos for purchases — are stored in private
              storage and are only accessible to members of your homestead.
            </p>
            <p className="mt-2">
              <strong className="text-foreground">Weather lookups.</strong> If you use weather features, the latitude and longitude
              saved for your homestead are sent to Open-Meteo (a weather data provider) to retrieve your
              forecast. We do not track your device's GPS location.
            </p>
            <p className="mt-2">
              <strong className="text-foreground">On your device.</strong> Homestead Hub works offline. A copy of your data is
              stored locally on your own device so the app keeps working without a connection, and
              syncs back when you reconnect.
            </p>
          </section>

          <section>
            <h2>What we do NOT collect</h2>
            <ul>
              <li>We do not run advertising.</li>
              <li>We do not use third-party analytics or tracking tools.</li>
              <li>We do not track your device's location.</li>
              <li>
                We do not collect payment card information. Paid plans are not offered yet; if that
                changes, payments will be handled by a payment processor and this policy will be
                updated first.
              </li>
            </ul>
          </section>

          <section>
            <h2>How we use your information</h2>
            <p>
              We use your information only to operate the app: to sign you in, store and display your
              homestead records, sync them across your devices, show weather for your homestead, and
              provide support when you contact us.
            </p>
          </section>

          <section>
            <h2>Who can see your data</h2>
            <ul>
              <li>
                <strong className="text-foreground">Your homestead members.</strong> Homestead Hub is a shared household tool.
                Records and photos in a homestead are visible to the members of that homestead,
                according to their role. People outside your homestead cannot see your data.
              </li>
              <li>
                <strong className="text-foreground">Service providers.</strong> The app runs on hosted infrastructure provided by
                Lovable and Supabase (database, sign-in, and file storage), and weather data comes from
                Open-Meteo. These providers process data only to deliver the service.
              </li>
              <li>
                <strong className="text-foreground">Legal requirements.</strong> We may disclose information if required by law, or
                to protect the safety of users or the service.
              </li>
            </ul>
            <p className="mt-2">We do <strong className="text-foreground">not</strong> sell your personal information. We do not share it for marketing.</p>
          </section>

          <section>
            <h2>Data retention and deletion</h2>
            <p>
              Your data is kept while your account is active. You may ask us at any time to delete your
              account and its data by emailing evergracehomesteader@gmail.com. Deleting your account
              removes your homestead records and photos from our systems, except where we must keep
              limited records to comply with the law. Backups are rotated and overwritten in the
              ordinary course of operations.
            </p>
          </section>

          <section>
            <h2>Your rights</h2>
            <p>
              You can ask us to show you the personal information we hold about you, correct it, export
              it, or delete it. Email evergracehomesteader@gmail.com and we will respond within a
              reasonable time. You can also correct most information directly in the app at any time.
            </p>
          </section>

          <section>
            <h2>Security</h2>
            <p>
              Accounts are protected by password sign-in and role-based permissions, and data is
              transmitted over encrypted connections. No system is perfectly secure, but we take
              reasonable steps to protect your information and limit access to it.
            </p>
          </section>

          <section>
            <h2>Children</h2>
            <p>
              Homestead Hub is a farm-management tool intended for adults. It is not directed at
              children under 13, and we do not knowingly collect personal information from children
              under 13. If you believe a child has provided us personal information, contact us and we
              will delete it.
            </p>
          </section>

          <section>
            <h2>Changes to this policy</h2>
            <p>
              If we change this policy in a meaningful way, we will update the effective date above and
              note the change in the app. Continuing to use the app after a change means you accept the
              updated policy.
            </p>
          </section>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-6">
          <Link to="/login" className="underline">Back to sign in</Link>
          {" · "}
          <Link to="/terms" className="underline">Terms of Service</Link>
        </p>
      </div>
    </div>
  );
}
