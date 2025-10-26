import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export default function Setup() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function createRootAccount() {
    setStatus('loading');
    setMessage('');

    try {
      const response = await fetch('/api/emergency/create-root', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setStatus('success');
        setMessage(data.message || 'Root account created successfully!');
      } else {
        setStatus('error');
        setMessage(data.error || data.details || 'Failed to create root account');
      }
    } catch (error: any) {
      setStatus('error');
      setMessage(error.message || 'Network error');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Platform Setup</CardTitle>
          <CardDescription>
            Create the root administrator account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              This will create the root admin account with the following credentials:
            </p>
            <div className="bg-muted p-3 rounded-md space-y-1 text-sm font-mono">
              <div>Email: <span className="text-primary">root@getdc360.com</span></div>
              <div>Password: <span className="text-primary">admin123@*</span></div>
            </div>
          </div>

          <Button
            onClick={createRootAccount}
            disabled={status === 'loading' || status === 'success'}
            className="w-full"
            size="lg"
            data-testid="button-create-root"
          >
            {status === 'loading' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {status === 'success' && <CheckCircle2 className="mr-2 h-4 w-4" />}
            {status === 'loading' ? 'Creating Account...' : status === 'success' ? 'Account Created!' : 'Create Root Account'}
          </Button>

          {status === 'success' && (
            <div className="flex items-start gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-md">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-500">Success!</p>
                <p className="text-sm text-muted-foreground mt-1">{message}</p>
                <a
                  href="/auth"
                  className="text-sm text-primary hover:underline mt-2 inline-block"
                  data-testid="link-login"
                >
                  Go to login →
                </a>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-md">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-500">Error</p>
                <p className="text-sm text-muted-foreground mt-1">{message}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
