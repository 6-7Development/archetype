import { Router, Request, Response } from 'express';

const router = Router();

/**
 * OpenAPI 3.0 Specification for BeeHiveAI Platform
 * Comprehensive API documentation for all enterprise endpoints
 */
const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'BeeHiveAI Platform API',
    version: '1.0.0',
    description: 'Enterprise-grade AI-powered development platform with multi-tenant workspace isolation, billing analytics, compliance framework, and autonomous healing capabilities.',
    contact: {
      name: 'BeeHiveAI Support',
      email: 'support@lomu.ai'
    },
    license: {
      name: 'Proprietary',
      url: 'https://lomu.ai/license'
    }
  },
  servers: [
    {
      url: '/api',
      description: 'API Base URL'
    }
  ],
  tags: [
    { name: 'Health', description: 'Health check endpoints' },
    { name: 'Authentication', description: 'User authentication and session management' },
    { name: 'Workspaces', description: 'Team workspace management' },
    { name: 'Projects', description: 'Project CRUD operations' },
    { name: 'BeeHiveAI', description: 'AI agent operations and job management' },
    { name: 'Architect', description: 'I AM Architect consultation services' },
    { name: 'SWARM', description: 'SWARM mode parallel execution' },
    { name: 'Billing', description: 'Credits, subscriptions, and billing analytics' },
    { name: 'Compliance', description: 'SOC2/HIPAA/GDPR compliance endpoints' },
    { name: 'Organizations', description: 'Multi-organization hierarchy management' },
    { name: 'GDPR', description: 'GDPR data export and privacy' },
    { name: 'Webhooks', description: 'Webhook management and delivery' },
    { name: 'Admin', description: 'Administrative operations' }
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check endpoint',
        description: 'Returns platform health status including database connectivity',
        operationId: 'getHealth',
        security: [],
        responses: {
          '200': {
            description: 'Platform is healthy',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthResponse' }
              }
            }
          },
          '503': {
            description: 'Platform is unhealthy',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthResponse' }
              }
            }
          }
        }
      }
    },
    '/auth/user': {
      get: {
        tags: ['Authentication'],
        summary: 'Get current user',
        description: 'Returns the currently authenticated user',
        operationId: 'getCurrentUser',
        security: [{ sessionAuth: [] }],
        responses: {
          '200': {
            description: 'User information',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/User' }
              }
            }
          },
          '401': { description: 'Not authenticated' }
        }
      }
    },
    '/workspaces': {
      get: {
        tags: ['Workspaces'],
        summary: 'List workspaces',
        description: 'Returns all workspaces the user has access to',
        operationId: 'listWorkspaces',
        security: [{ sessionAuth: [] }],
        responses: {
          '200': {
            description: 'List of workspaces',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Workspace' }
                }
              }
            }
          }
        }
      },
      post: {
        tags: ['Workspaces'],
        summary: 'Create workspace',
        description: 'Creates a new team workspace',
        operationId: 'createWorkspace',
        security: [{ sessionAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateWorkspaceRequest' }
            }
          }
        },
        responses: {
          '201': {
            description: 'Workspace created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Workspace' }
              }
            }
          }
        }
      }
    },
    '/beehive-ai/jobs': {
      get: {
        tags: ['BeeHiveAI'],
        summary: 'List AI jobs',
        description: 'Returns AI job history for the current workspace',
        operationId: 'listBeeHiveAIJobs',
        security: [{ sessionAuth: [] }],
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } }
        ],
        responses: {
          '200': {
            description: 'List of AI jobs',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/BeeHiveAIJob' }
                }
              }
            }
          }
        }
      },
      post: {
        tags: ['BeeHiveAI'],
        summary: 'Start AI job',
        description: 'Starts a new AI coding task',
        operationId: 'startBeeHiveAIJob',
        security: [{ sessionAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/StartJobRequest' }
            }
          }
        },
        responses: {
          '202': {
            description: 'Job started',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/BeeHiveAIJob' }
              }
            }
          }
        }
      }
    },
    '/swarm/execute': {
      post: {
        tags: ['SWARM'],
        summary: 'Execute SWARM task',
        description: 'Executes a parallel multi-agent task using SWARM mode',
        operationId: 'executeSwarmTask',
        security: [{ sessionAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SwarmExecuteRequest' }
            }
          }
        },
        responses: {
          '200': {
            description: 'SWARM execution result',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SwarmExecuteResponse' }
              }
            }
          }
        }
      }
    },
    '/credits/balance': {
      get: {
        tags: ['Billing'],
        summary: 'Get credit balance',
        description: 'Returns current credit balance for the user/workspace',
        operationId: 'getCreditBalance',
        security: [{ sessionAuth: [] }],
        responses: {
          '200': {
            description: 'Credit balance',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreditBalance' }
              }
            }
          }
        }
      }
    },
    '/billing/analytics/daily': {
      get: {
        tags: ['Billing'],
        summary: 'Get daily billing analytics',
        description: 'Returns daily billing data for the workspace',
        operationId: 'getDailyBillingAnalytics',
        security: [{ sessionAuth: [] }],
        parameters: [
          { name: 'startDate', in: 'query', required: true, schema: { type: 'string', format: 'date' } },
          { name: 'endDate', in: 'query', required: true, schema: { type: 'string', format: 'date' } }
        ],
        responses: {
          '200': {
            description: 'Daily billing data',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/BillingAnalytic' }
                }
              }
            }
          }
        }
      }
    },
    '/billing/analytics/forecast': {
      get: {
        tags: ['Billing'],
        summary: 'Get billing forecast',
        description: 'Returns 3-month billing forecast based on historical usage',
        operationId: 'getBillingForecast',
        security: [{ sessionAuth: [] }],
        responses: {
          '200': {
            description: 'Billing forecast',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/BillingForecast' }
              }
            }
          }
        }
      }
    },
    '/compliance/check': {
      post: {
        tags: ['Compliance'],
        summary: 'Run compliance check',
        description: 'Runs SOC2/HIPAA/GDPR compliance validation',
        operationId: 'runComplianceCheck',
        security: [{ sessionAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ComplianceCheckRequest' }
            }
          }
        },
        responses: {
          '200': {
            description: 'Compliance check results',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ComplianceCheckResponse' }
              }
            }
          }
        }
      }
    },
    '/gdpr/export': {
      get: {
        tags: ['GDPR'],
        summary: 'Export user data',
        description: 'Exports all user data for GDPR Article 15 & 20 compliance',
        operationId: 'exportGdprData',
        security: [{ sessionAuth: [] }],
        parameters: [
          { name: 'format', in: 'query', schema: { type: 'string', enum: ['json', 'csv'], default: 'json' } }
        ],
        responses: {
          '200': {
            description: 'Exported user data',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/GdprExportResponse' }
              },
              'text/csv': {
                schema: { type: 'string' }
              }
            }
          }
        }
      }
    },
    '/organizations': {
      get: {
        tags: ['Organizations'],
        summary: 'List organizations',
        description: 'Returns all organizations the user belongs to',
        operationId: 'listOrganizations',
        security: [{ sessionAuth: [] }],
        responses: {
          '200': {
            description: 'List of organizations',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Organization' }
                }
              }
            }
          }
        }
      },
      post: {
        tags: ['Organizations'],
        summary: 'Create organization',
        description: 'Creates a new organization',
        operationId: 'createOrganization',
        security: [{ sessionAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateOrganizationRequest' }
            }
          }
        },
        responses: {
          '201': {
            description: 'Organization created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Organization' }
              }
            }
          }
        }
      }
    }
  },
  components: {
    securitySchemes: {
      sessionAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'connect.sid',
        description: 'Session-based authentication via cookie'
      }
    },
    schemas: {
      HealthResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['ok', 'error'] },
          timestamp: { type: 'string', format: 'date-time' },
          uptime: { type: 'number' },
          database: { type: 'string', enum: ['connected', 'disconnected'] },
          responseTimeMs: { type: 'number' }
        }
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          role: { type: 'string', enum: ['user', 'admin', 'owner'] },
          billingStatus: { type: 'string', enum: ['trial', 'active', 'suspended'] }
        }
      },
      Workspace: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          slug: { type: 'string' },
          ownerId: { type: 'string', format: 'uuid' },
          createdAt: { type: 'string', format: 'date-time' }
        }
      },
      CreateWorkspaceRequest: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 255 },
          description: { type: 'string' }
        }
      },
      BeeHiveAIJob: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          status: { type: 'string', enum: ['pending', 'running', 'completed', 'failed'] },
          phase: { type: 'string' },
          prompt: { type: 'string' },
          tokensUsed: { type: 'integer' },
          createdAt: { type: 'string', format: 'date-time' },
          completedAt: { type: 'string', format: 'date-time' }
        }
      },
      StartJobRequest: {
        type: 'object',
        required: ['prompt'],
        properties: {
          prompt: { type: 'string', minLength: 1 },
          projectId: { type: 'string', format: 'uuid' },
          files: { type: 'array', items: { type: 'string' } }
        }
      },
      SwarmExecuteRequest: {
        type: 'object',
        required: ['task'],
        properties: {
          task: { type: 'string' },
          parallelism: { type: 'integer', default: 4 },
          timeout: { type: 'integer', default: 300000 }
        }
      },
      SwarmExecuteResponse: {
        type: 'object',
        properties: {
          taskId: { type: 'string' },
          status: { type: 'string' },
          results: { type: 'array', items: { type: 'object' } },
          duration: { type: 'number' }
        }
      },
      CreditBalance: {
        type: 'object',
        properties: {
          available: { type: 'number' },
          used: { type: 'number' },
          limit: { type: 'number' }
        }
      },
      BillingAnalytic: {
        type: 'object',
        properties: {
          date: { type: 'string', format: 'date' },
          creditsUsed: { type: 'number' },
          estimatedCost: { type: 'number' },
          activeUsers: { type: 'integer' },
          aiRequests: { type: 'integer' }
        }
      },
      BillingForecast: {
        type: 'object',
        properties: {
          months: { type: 'array', items: { type: 'object' } },
          projectedCost: { type: 'number' },
          confidenceLevel: { type: 'number' }
        }
      },
      ComplianceCheckRequest: {
        type: 'object',
        required: ['frameworks'],
        properties: {
          frameworks: {
            type: 'array',
            items: { type: 'string', enum: ['SOC2', 'HIPAA', 'GDPR'] }
          }
        }
      },
      ComplianceCheckResponse: {
        type: 'object',
        properties: {
          passed: { type: 'boolean' },
          score: { type: 'number' },
          findings: { type: 'array', items: { type: 'object' } }
        }
      },
      GdprExportResponse: {
        type: 'object',
        properties: {
          exportId: { type: 'string' },
          userId: { type: 'string' },
          exportedAt: { type: 'string', format: 'date-time' },
          data: { type: 'object' }
        }
      },
      Organization: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          slug: { type: 'string' },
          planType: { type: 'string', enum: ['free', 'pro', 'enterprise'] },
          ownerId: { type: 'string', format: 'uuid' }
        }
      },
      CreateOrganizationRequest: {
        type: 'object',
        required: ['name', 'slug'],
        properties: {
          name: { type: 'string', minLength: 1 },
          slug: { type: 'string', pattern: '^[a-z0-9-]+$' },
          description: { type: 'string' }
        }
      }
    }
  }
};

/**
 * GET /api/docs - Returns OpenAPI specification
 */
router.get('/docs', (req: Request, res: Response) => {
  res.json(openApiSpec);
});

/**
 * GET /api/docs/swagger - Returns Swagger UI HTML
 */
router.get('/docs/swagger', (req: Request, res: Response) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BeeHiveAI API Documentation</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '/api/docs',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: "StandaloneLayout"
      });
    };
  </script>
</body>
</html>
  `;
  res.type('html').send(html);
});

console.log('[API-DOCS] OpenAPI documentation routes registered');

export default router;
