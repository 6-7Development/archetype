import { AppLayout } from "@/components/app-layout";
import { Card } from "@/components/ui/card";

export default function Privacy() {
  return (
    <AppLayout>
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="space-y-2 mb-8">
            <h1 className="text-4xl font-bold">Privacy Policy</h1>
            <p className="text-muted-foreground">
              Last Updated: November 2025
            </p>
          </div>

          <Card className="p-6 space-y-6">
            <section className="space-y-3">
              <h2 className="text-2xl font-semibold">1. Introduction</h2>
              <p className="text-muted-foreground">
                LomuAI ("we", "us", "our" or "Company") operates the LomuAI platform. 
                This page informs you of our policies regarding the collection, use, and 
                disclosure of personal data when you use our Service and the choices you have 
                associated with that data.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-semibold">2. Information Collection and Use</h2>
              <p className="text-muted-foreground">
                We collect several different types of information for various purposes to provide 
                and improve our Service to you.
              </p>
              <div className="space-y-2 ml-4">
                <h3 className="font-semibold">Types of Data Collected:</h3>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Personal Information (name, email, profile information)</li>
                  <li>Usage Data (pages visited, time spent, interactions)</li>
                  <li>Project Data (code, configurations, deployments)</li>
                  <li>Device Information (IP address, browser type, OS)</li>
                </ul>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-semibold">3. Use of Data</h2>
              <p className="text-muted-foreground">
                LomuAI uses the collected data for various purposes:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                <li>Providing and maintaining the Service</li>
                <li>Notifying you about changes to the Service</li>
                <li>Allowing you to participate in interactive features</li>
                <li>Providing customer support</li>
                <li>Monitoring and analyzing usage of the Service</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-semibold">4. Security of Data</h2>
              <p className="text-muted-foreground">
                The security of your data is important to us but remember that no method of 
                transmission over the Internet or method of electronic storage is 100% secure. 
                While we strive to use commercially acceptable means to protect your Personal Data, 
                we cannot guarantee its absolute security.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-semibold">5. Contact Us</h2>
              <p className="text-muted-foreground">
                If you have any questions about this Privacy Policy, please contact us at{" "}
                <a href="mailto:privacy@getdc360.com" className="text-primary hover:underline">
                  privacy@getdc360.com
                </a>
              </p>
            </section>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
