module.exports = {
  ci: {
    collect: {
      // URLs to audit
      url: [
        'http://localhost:3000/health',
        'http://localhost:3000/status',
      ],
      // Number of runs per URL
      numberOfRuns: 3,
      // Start server before audit
      startServerCommand: 'bash scripts/sync-service/start-webhook-receiver.sh',
      startServerReadyPattern: 'Webhook receiver started',
      startServerReadyTimeout: 30000,
      // Settings
      settings: {
        preset: 'desktop',
        // Custom Lighthouse config
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      },
    },
    assert: {
      preset: 'lighthouse:recommended',
      assertions: {
        // Performance budgets
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['warn', { minScore: 0.8 }],

        // Security - No exposed secrets
        'vulnerabilities': ['error', { maxLength: 0 }],
        'csp-xss': ['error', { minScore: 1 }],

        // Performance metrics
        'first-contentful-paint': ['warn', { maxNumericValue: 2000 }],
        'largest-contentful-paint': ['warn', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['warn', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['warn', { maxNumericValue: 300 }],
        'speed-index': ['warn', { maxNumericValue: 3000 }],

        // Resource budgets
        'resource-summary:script:size': ['warn', { maxNumericValue: 200000 }],
        'resource-summary:stylesheet:size': ['warn', { maxNumericValue: 50000 }],
        'resource-summary:document:size': ['warn', { maxNumericValue: 50000 }],
        'resource-summary:image:size': ['warn', { maxNumericValue: 500000 }],
        'resource-summary:total:size': ['error', { maxNumericValue: 1000000 }],

        // Network
        'total-byte-weight': ['warn', { maxNumericValue: 1000000 }],
        'uses-http2': ['error', { minScore: 1 }],
        'uses-long-cache-ttl': ['warn', { minScore: 0.75 }],

        // Best practices
        'uses-https': ['error', { minScore: 1 }],
        'no-vulnerable-libraries': ['error', { minScore: 1 }],
        'errors-in-console': ['warn', { maxLength: 0 }],
        'is-on-https': ['error', { minScore: 1 }],

        // Custom assertions for secret exposure
        'content-width': 'off', // Not applicable for API endpoints
        'meta-description': 'off', // Not applicable for API endpoints
      },
    },
    upload: {
      target: 'temporary-public-storage',
      // Or use GitHub Actions artifacts
      // target: 'filesystem',
      // outputDir: '.lighthouse/reports',
    },
    server: {
      // LHCI server configuration (optional)
      // For persistent storage and historical tracking
    },
  },
};
