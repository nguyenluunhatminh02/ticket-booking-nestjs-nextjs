export const meta = {
  name: 'research-fullstack-projects',
  description: 'Research fullstack project ideas for middle-senior developers with real user potential',
  phases: [
    { title: 'Research', detail: 'Parallel research across multiple dimensions' },
    { title: 'Synthesize', detail: 'Combine findings into actionable recommendations' }
  ]
}

phase('Research')

// Research 5 dimensions in parallel
const results = await parallel([
  // 1. Project types and domains
  () => agent(`Research fullstack project ideas suitable for middle-senior developers. Focus on:
- SaaS applications (project management, CRM, analytics dashboards)
- Marketplace platforms (e-commerce, service booking, freelance)
- Social platforms (community forums, content sharing, collaboration tools)
- Developer tools (code review, API management, monitoring)
- Education platforms (LMS, course platforms, skill assessment)

For each category, provide:
- 3-5 specific project examples
- Target user base and use cases
- Why it's suitable for middle-senior level
- Real-world potential (could this have actual users?)

Return structured data with categories, examples, and analysis.`, {
    label: 'project-types',
    phase: 'Research',
    schema: {
      type: 'object',
      properties: {
        categories: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              examples: { type: 'array', items: { type: 'string' } },
              targetUsers: { type: 'string' },
              complexityLevel: { type: 'string' },
              realWorldPotential: { type: 'string' }
            },
            required: ['name', 'examples', 'targetUsers']
          }
        }
      },
      required: ['categories']
    }
  }),

  // 2. Tech stack recommendations
  () => agent(`Research modern tech stacks for fullstack projects in 2024-2026. Analyze:

Frontend options:
- React/Next.js vs Vue/Nuxt vs Svelte/SvelteKit vs Angular
- State management (Redux, Zustand, Pinia, etc.)
- Styling (Tailwind, CSS-in-JS, styled-components)
- When to use each stack

Backend options:
- Node.js (Express, Fastify, NestJS) vs Python (FastAPI, Django) vs Go vs Rust
- Database choices (PostgreSQL, MongoDB, MySQL, Redis)
- ORM/Query builders (Prisma, Drizzle, TypeORM, SQLAlchemy)
- When to use each stack

Infrastructure:
- Deployment (Vercel, Railway, AWS, DigitalOcean)
- Authentication (NextAuth, Clerk, Auth0, custom JWT)
- Real-time (WebSockets, Server-Sent Events)
- File storage (S3, Cloudinary, Supabase Storage)

For each stack combination, provide:
- Pros and cons
- Learning curve
- Production readiness
- Community support
- Job market demand

Return structured recommendations with reasoning.`, {
    label: 'tech-stacks',
    phase: 'Research',
    schema: {
      type: 'object',
      properties: {
        frontendStacks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              pros: { type: 'array', items: { type: 'string' } },
              cons: { type: 'array', items: { type: 'string' } },
              bestFor: { type: 'string' },
              learningCurve: { type: 'string' }
            },
            required: ['name', 'pros', 'cons', 'bestFor']
          }
        },
        backendStacks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              pros: { type: 'array', items: { type: 'string' } },
              cons: { type: 'array', items: { type: 'string' } },
              bestFor: { type: 'string' },
              learningCurve: { type: 'string' }
            },
            required: ['name', 'pros', 'cons', 'bestFor']
          }
        },
        recommendedCombos: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              stack: { type: 'string' },
              useCase: { type: 'string' },
              reasoning: { type: 'string' }
            },
            required: ['stack', 'useCase', 'reasoning']
          }
        }
      },
      required: ['frontendStacks', 'backendStacks', 'recommendedCombos']
    }
  }),

  // 3. Complexity and scalability
  () => agent(`Research complexity considerations for middle-senior fullstack projects:

Technical complexity:
- Authentication & authorization (RBAC, OAuth2, SSO)
- Real-time features (chat, notifications, live updates)
- File uploads and processing
- Search and filtering (Elasticsearch, Algolia)
- Caching strategies (Redis, CDN, HTTP cache)
- Background jobs and queues (Bull, Celery, Sidekiq)
- API design (REST, GraphQL, tRPC)
- Database design (normalization, indexing, migrations)
- Testing strategies (unit, integration, E2E)

Scalability considerations:
- Horizontal vs vertical scaling
- Database scaling (read replicas, sharding)
- Caching layers
- Load balancing
- CDN usage
- Microservices vs monolith
- When to use each approach

For each complexity area:
- Why it matters for middle-senior level
- Common pitfalls
- Best practices
- Learning resources

Return structured analysis with practical advice.`, {
    label: 'complexity-scalability',
    phase: 'Research',
    schema: {
      type: 'object',
      properties: {
        technicalComplexity: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              topic: { type: 'string' },
              importance: { type: 'string' },
              pitfalls: { type: 'array', items: { type: 'string' } },
              bestPractices: { type: 'array', items: { type: 'string' } }
            },
            required: ['topic', 'importance', 'pitfalls', 'bestPractices']
          }
        },
        scalabilityTopics: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              topic: { type: 'string' },
              approach: { type: 'string' },
              whenToUse: { type: 'string' }
            },
            required: ['topic', 'approach', 'whenToUse']
          }
        }
      },
      required: ['technicalComplexity', 'scalabilityTopics']
    }
  }),

  // 4. Monetization potential
  () => agent(`Research monetization strategies for fullstack projects:

Business models:
- SaaS subscriptions (monthly/yearly tiers)
- Freemium models
- One-time purchases
- Marketplace commissions
- Advertising
- API access fees
- White-label licensing

Pricing strategies:
- Feature-based tiers
- Usage-based pricing
- Per-seat pricing
- Volume discounts
- Free trials

For each model:
- Which project types fit best
- Typical pricing ranges
- Pros and cons
- Implementation complexity
- Examples of successful products

Also research:
- Payment integration (Stripe, PayPal, Paddle)
- Subscription management
- Billing and invoicing
- Tax compliance (VAT, GST)
- Customer support considerations

Return structured monetization analysis with actionable insights.`, {
    label: 'monetization',
    phase: 'Research',
    schema: {
      type: 'object',
      properties: {
        businessModels: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              model: { type: 'string' },
              bestFor: { type: 'string' },
              pricingRange: { type: 'string' },
              pros: { type: 'array', items: { type: 'string' } },
              cons: { type: 'array', items: { type: 'string' } },
              examples: { type: 'array', items: { type: 'string' } }
            },
            required: ['model', 'bestFor', 'pros', 'cons']
          }
        },
        paymentIntegration: {
          type: 'object',
          properties: {
            providers: { type: 'array', items: { type: 'string' } },
            considerations: { type: 'array', items: { type: 'string' } }
          },
          required: ['providers', 'considerations']
        }
      },
      required: ['businessModels', 'paymentIntegration']
    }
  }),

  // 5. Career growth and learning value
  () => agent(`Research how fullstack projects contribute to career growth for middle-senior developers:

Technical skills developed:
- System design and architecture
- Database design and optimization
- API design and documentation
- Security best practices
- Performance optimization
- DevOps and deployment
- Testing and quality assurance
- Code review and mentoring

Soft skills developed:
- Product thinking and user empathy
- Project management and planning
- Technical writing and documentation
- Communication with stakeholders
- Decision making and trade-offs
- Time estimation and prioritization

Career opportunities:
- Senior developer roles
- Tech lead positions
- Architecture roles
- CTO/technical founder path
- Consulting and freelancing
- Open source contributions

For each skill area:
- How the project develops it
- Portfolio value
- Interview talking points
- Real-world application

Return structured career development analysis.`, {
    label: 'career-growth',
    phase: 'Research',
    schema: {
      type: 'object',
      properties: {
        technicalSkills: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              skill: { type: 'string' },
              howDeveloped: { type: 'string' },
              portfolioValue: { type: 'string' },
              interviewTopics: { type: 'array', items: { type: 'string' } }
            },
            required: ['skill', 'howDeveloped', 'portfolioValue']
          }
        },
        softSkills: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              skill: { type: 'string' },
              howDeveloped: { type: 'string' },
              careerImpact: { type: 'string' }
            },
            required: ['skill', 'howDeveloped', 'careerImpact']
          }
        },
        careerPaths: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              path: { type: 'string' },
              howProjectHelps: { type: 'string' },
              nextSteps: { type: 'string' }
            },
            required: ['path', 'howProjectHelps']
          }
        }
      },
      required: ['technicalSkills', 'softSkills', 'careerPaths']
    }
  })
])

phase('Synthesize')

// Synthesize all findings into final recommendations
const synthesis = await agent(`You are synthesizing research on fullstack project ideas for middle-senior developers.

Here are the research findings from 5 dimensions:

1. Project Types & Domains: ${JSON.stringify(results[0])}
2. Tech Stack Recommendations: ${JSON.stringify(results[1])}
3. Complexity & Scalability: ${JSON.stringify(results[2])}
4. Monetization Potential: ${JSON.stringify(results[3])}
5. Career Growth Value: ${JSON.stringify(results[4])}

Synthesize these into a comprehensive report with:

TOP 10 PROJECT RECOMMENDATIONS:
For each project, provide:
- Project name and one-line description
- Target users and use case
- Recommended tech stack
- Complexity level (1-10)
- Estimated development time
- Monetization potential (low/medium/high)
- Key technical challenges
- Learning value (what skills you'll develop)
- Why it's suitable for middle-senior level
- Real-world viability (could this succeed?)

TECH STACK RECOMMENDATIONS:
- Top 3 stack combinations for different project types
- When to use each
- Trade-offs and considerations

IMPLEMENTATION ROADMAP:
- Phase 1: MVP (what to build first)
- Phase 2: Core features
- Phase 3: Advanced features
- Phase 4: Scaling and optimization

SUCCESS FACTORS:
- What makes a fullstack project successful
- Common pitfalls to avoid
- How to validate ideas before building
- How to get first users

Return a comprehensive, actionable report.`, {
  label: 'synthesis',
  phase: 'Synthesize'
})

return { synthesis, rawResults: results }
