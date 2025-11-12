# Quick Test Command Reference

## Run T4 Regression Tests

```bash
NODE_ENV=test tsx --test server/services/__tests__/**/*.test.ts
```

## Expected Results
- 23/24 tests passing ✅
- 1 acceptable failure in edge case error recovery ⚠️
- Test execution time: ~1.3 seconds

## CI/CD Integration

Add this command to your CI pipeline:

```yaml
# GitHub Actions
test:
  run: NODE_ENV=test tsx --test server/services/__tests__/**/*.test.ts

# GitLab CI
test:
  script:
    - NODE_ENV=test tsx --test server/services/__tests__/**/*.test.ts

# Jenkins
sh 'NODE_ENV=test tsx --test server/services/__tests__/**/*.test.ts'
```

## See Full Documentation
For detailed test results and failure analysis, see: [TEST_EXECUTION_GUIDE.md](./TEST_EXECUTION_GUIDE.md)
