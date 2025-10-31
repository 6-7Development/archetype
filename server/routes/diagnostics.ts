import { Router } from 'express';
import { runPlatformDiagnostics } from '../diagnostics';

const router = Router();

router.get('/api/diagnostics/health', async (req, res) => {
  try {
    const results = await runPlatformDiagnostics();
    const hasErrors = results.some(r => r.status === 'error');
    const hasWarnings = results.some(r => r.status === 'warning');
    
    res.status(hasErrors ? 503 : 200).json({
      status: hasErrors ? 'error' : hasWarnings ? 'warning' : 'healthy',
      timestamp: new Date().toISOString(),
      results
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to run diagnostics',
      error: (error as Error).message
    });
  }
});

export { router as diagnosticsRouter };