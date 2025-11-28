import { AppLayout } from "@/components/app-layout";
import { Card } from "@/components/ui/card";

export default function Terms() {
  return (
    <AppLayout>
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="space-y-2 mb-8">
            <h1 className="text-4xl font-bold">Terms of Service</h1>
            <p className="text-muted-foreground">
              Last Updated: November 2025
            </p>
          </div>

          <Card className="p-6 space-y-6">
            <section className="space-y-3">
              <h2 className="text-2xl font-semibold">1. Agreement to Terms</h2>
              <p className="text-muted-foreground">
                By accessing and using the Hexad platform, you accept and agree to be bound by 
                and comply with these Terms and Conditions and our Privacy Policy.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-semibold">2. Use License</h2>
              <p className="text-muted-foreground">
                Permission is granted to temporarily download one copy of the materials (information 
                or software) on Hexad for personal, non-commercial transitory viewing only. This is 
                the grant of a license, not a transfer of title, and under this license you may not:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                <li>Modify or copy the materials</li>
                <li>Use the materials for any commercial purpose or for any public display</li>
                <li>Attempt to reverse engineer, decompile, or disassemble any software</li>
                <li>Transfer the materials to another person or "mirror" the materials</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-semibold">3. Disclaimer</h2>
              <p className="text-muted-foreground">
                The materials on Hexad are provided "as is". Hexad makes no warranties, expressed 
                or implied, and hereby disclaims and negates all other warranties including, without 
                limitation, implied warranties or conditions of merchantability, fitness for a 
                particular purpose, or non-infringement of intellectual property or other violation of rights.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-semibold">4. Limitations</h2>
              <p className="text-muted-foreground">
                In no event shall Hexad or its suppliers be liable for any damages (including, 
                without limitation, damages for loss of data or profit, or due to business interruption) 
                arising out of the use or inability to use the materials on Hexad.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-semibold">5. Accuracy of Materials</h2>
              <p className="text-muted-foreground">
                The materials appearing on Hexad could include technical, typographical, or 
                photographic errors. Hexad does not warrant that any of the materials on Hexad 
                are accurate, complete, or current.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-semibold">6. Modifications</h2>
              <p className="text-muted-foreground">
                Hexad may revise these Terms of Service for the platform at any time without notice. 
                By using this platform, you are agreeing to be bound by the then current version of 
                these Terms of Service.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-semibold">7. Governing Law</h2>
              <p className="text-muted-foreground">
                These Terms and Conditions and Privacy Policy are governed by and construed in 
                accordance with the laws of the United States, and you irrevocably submit to the 
                exclusive jurisdiction of the courts in that State or location.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-semibold">8. Contact Information</h2>
              <p className="text-muted-foreground">
                If you have any questions about these Terms of Service, please contact us at{" "}
                <a href="mailto:legal@getdc360.com" className="text-primary hover:underline">
                  legal@getdc360.com
                </a>
              </p>
            </section>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
