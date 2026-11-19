export const meta = {
  name: 'workflowos-phase0-foundation',
  description: 'Bootstrap WorkflowOS foundation: monorepo, Docker, DB schema, auth, workspaces',
  phases: [
    { title: 'Bootstrap', detail: 'Monorepo structure, Docker, TypeScript config' },
    { title: 'Database', detail: 'Schema, migrations, seed data' },
    { title: 'Auth', detail: 'Register, login, JWT, refresh tokens' },
    { title: 'Workspaces', detail: 'CRUD, RBAC, tenant isolation' },
    { title: 'Verify', detail: 'Integration tests and health checks' },
  ],
}

// Stage 1: Bootstrap monorepo structure (must run first - creates all directories)
phase('Bootstrap')
const bootstrap = await agent(`
  Bootstrap WorkflowOS monorepo at /home/kronosss2002/Desktop/workflowos

  CREATE these files (use Write tool for each):

  1. /home/kronosss2002/Desktop/workflowos/package.json
  {
    "name": "workflowos",
    "private": true,
    "scripts": {
      "dev:api": "pnpm --filter @workflowos/api dev",
      "dev:web": "pnpm --filter @workflowos/web dev",
      "dev:worker": "pnpm --filter @workflowos/worker dev",
      "build": "pnpm -r build",
      "test": "pnpm -r test",
      "lint": "pnpm -r lint",
      "db:migrate": "pnpm --filter @workflowos/api db:migrate",
      "db:seed": "pnpm --filter @workflowos/api db:seed"
    },
    "engines": { "node": ">=20" }
  }

  2. /home/kronosss2002/Desktop/workflowos/pnpm-workspace.yaml
  packages:
    - 'apps/*'
    - 'packages/*'

  3. /home/kronosss2002/Desktop/workflowos/.npmrc
  shamefully-hoist=true
  strict-peer-dependencies=false

  4. /home/kronosss2002/Desktop/workflowos/tsconfig.base.json
  {
    "compilerOptions": {
      "target": "ES2022",
      "module": "Node16",
      "moduleResolution": "Node16",
      "lib": ["ES2022"],
      "strict": true,
      "esModuleInterop": true,
      "skipLibCheck": true,
      "forceConsistentCasingInFileNames": true,
      "resolveJsonModule": true,
      "declaration": true,
      "declarationMap": true,
      "sourceMap": true,
      "outDir": "./dist",
      "rootDir": "./src",
      "experimentalDecorators": true,
      "emitDecoratorMetadata": true
    }
  }

  5. /home/kronosss2002/Desktop/workflowos/.gitignore
  node_modules/
  dist/
  .env
  .env.local
  *.log
  .DS_Store
  coverage/
  .turbo/

  6. /home/kronosss2002/Desktop/workflowos/.env.example
  NODE_ENV=development
  DATABASE_URL=postgresql://workflowos:workflowos@localhost:5432/workflowos
  REDIS_URL=redis://localhost:6379
  JWT_SECRET=change-me-in-production-min-32-chars-long
  JWT_REFRESH_SECRET=change-me-in-production-min-32-chars-long-refresh
  WORKFLOWOS_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
  API_PORT=3001
  WEB_PORT=3000
  WORKER_CONCURRENCY=4

  7. /home/kronosss2002/Desktop/workflowos/docker-compose.yml
  version: '3.8'
  services:
    postgres:
      image: postgres:15-alpine
      container_name: workflowos-postgres
      environment:
        POSTGRES_USER: workflowos
        POSTGRES_PASSWORD: workflowos
        POSTGRES_DB: workflowos
      ports:
        - "5432:5432"
      volumes:
        - postgres_data:/var/lib/postgresql/data
      healthcheck:
        test: ["CMD-SHELL", "pg_isready -U workflowos"]
        interval: 5s
        timeout: 5s
        retries: 5

    redis:
      image: redis:7-alpine
      container_name: workflowos-redis
      ports:
        - "6379:6379"
      volumes:
        - redis_data:/data
      healthcheck:
        test: ["CMD", "redis-cli", "ping"]
        interval: 5s
        timeout: 5s
        retries: 5

  volumes:
    postgres_data:
    redis_data:

  8. Create directory structure (use Bash mkdir -p):
  mkdir -p /home/kronosss2002/Desktop/workflowos/apps/api/src
  mkdir -p /home/kronosss2002/Desktop/workflowos/apps/api/test
  mkdir -p /home/kronosss2002/Desktop/workflowos/apps/web/src
  mkdir -p /home/kronosss2002/Desktop/workflowos/apps/worker/src
  mkdir -p /home/kronosss2002/Desktop/workflowos/apps/worker/test
  mkdir -p /home/kronosss2002/Desktop/workflowos/packages/contracts/src
  mkdir -p /home/kronosss2002/Desktop/workflowos/packages/workflow-schema/src
  mkdir -p /home/kronosss2002/Desktop/workflowos/packages/observability/src
  mkdir -p /home/kronosss2002/Desktop/workflowos/docs/adr
  mkdir -p /home/kronosss2002/Desktop/workflowos/docs/lab-results
  mkdir -p /home/kronosss2002/Desktop/workflowos/infra/compose
  mkdir -p /home/kronosss2002/Desktop/workflowos/load-tests

  9. /home/kronosss2002/Desktop/workflowos/apps/api/package.json
  {
    "name": "@workflowos/api",
    "version": "0.1.0",
    "private": true,
    "scripts": {
      "dev": "nest start --watch",
      "build": "nest build",
      "start": "node dist/main",
      "start:prod": "node dist/main",
      "test": "vitest run",
      "test:watch": "vitest",
      "test:cov": "vitest run --coverage",
      "lint": "eslint src --ext .ts",
      "db:migrate": "ts-node src/database/migrate.ts",
      "db:seed": "ts-node src/database/seed.ts"
    },
    "dependencies": {
      "@nestjs/common": "^10.3.0",
      "@nestjs/core": "^10.3.0",
      "@nestjs/platform-express": "^10.3.0",
      "@nestjs/config": "^3.1.1",
      "@nestjs/jwt": "^10.2.0",
      "@nestjs/passport": "^10.0.3",
      "@nestjs/throttler": "^5.1.1",
      "typeorm": "^0.3.19",
      "pg": "^8.11.3",
      "passport": "^0.7.0",
      "passport-jwt": "^4.0.1",
      "passport-local": "^1.0.0",
      "bcrypt": "^5.1.1",
      "class-validator": "^0.14.1",
      "class-transformer": "^0.5.1",
      "reflect-metadata": "^0.2.1",
      "rxjs": "^7.8.1",
      "uuid": "^9.0.1",
      "bullmq": "^5.1.1",
      "ioredis": "^5.3.2"
    },
    "devDependencies": {
      "@nestjs/cli": "^10.3.0",
      "@nestjs/schematics": "^10.1.0",
      "@types/node": "^20.11.0",
      "@types/passport-jwt": "^4.0.1",
      "@types/bcrypt": "^5.0.2",
      "@types/uuid": "^9.0.7",
      "typescript": "^5.3.3",
      "vitest": "^1.2.0",
      "ts-node": "^10.9.2",
      "eslint": "^8.56.0",
      "@typescript-eslint/eslint-plugin": "^6.19.0",
      "@typescript-eslint/parser": "^6.19.0"
    }
  }

  10. /home/kronosss2002/Desktop/workflowos/apps/api/tsconfig.json
  {
    "extends": "../../tsconfig.base.json",
    "compilerOptions": {
      "outDir": "./dist",
      "rootDir": "./src",
      "baseUrl": "./",
      "paths": { "@/*": ["src/*"] }
    },
    "include": ["src/***/*.ts"],
    "exclude": ["node_modules", "dist", "test"]
  }

  11. /home/kronosss2002/Desktop/workflowos/apps/api/nest-cli.json
  {
    "$schema": "https://json.schemastore.org/nest-cli",
    "collection": "@nestjs/schematics",
    "sourceRoot": "src",
    "compilerOptions": {
      "deleteOutDir": true
    }
  }

  12. /home/kronosss2002/Desktop/workflowos/apps/api/vitest.config.ts
  import { defineConfig } from 'vitest/config';
  export default defineConfig({
    test: {
      globals: true,
      environment: 'node',
      include: ['test/***.test.ts', 'src/***.spec.ts'],
      coverage: { provider: 'v8', reporter: ['text', 'json', 'html'] },
    },
  });

  13. /home/kronosss2002/Desktop/workflowos/apps/worker/package.json
  {
    "name": "@workflowos/worker",
    "version": "0.1.0",
    "private": true,
    "scripts": {
      "dev": "nest start --watch",
      "build": "nest build",
      "start": "node dist/main",
      "test": "vitest run",
      "lint": "eslint src --ext .ts"
    },
    "dependencies": {
      "@nestjs/common": "^10.3.0",
      "@nestjs/core": "^10.3.0",
      "@nestjs/config": "^3.1.1",
      "typeorm": "^0.3.19",
      "pg": "^8.11.3",
      "bullmq": "^5.1.1",
      "ioredis": "^5.3.2",
      "reflect-metadata": "^0.2.1",
      "rxjs": "^7.8.1",
      "uuid": "^9.0.1"
    },
    "devDependencies": {
      "@nestjs/cli": "^10.3.0",
      "@types/node": "^20.11.0",
      "typescript": "^5.3.3",
      "vitest": "^1.2.0",
      "ts-node": "^10.9.2"
    }
  }

  14. /home/kronosss2002/Desktop/workflowos/apps/worker/tsconfig.json
  Same as api/tsconfig.json

  15. /home/kronosss2002/Desktop/workflowos/packages/contracts/package.json
  {
    "name": "@workflowos/contracts",
    "version": "0.1.0",
    "private": true,
    "main": "./dist/index.js",
    "types": "./dist/index.d.ts",
    "scripts": {
      "build": "tsc",
      "dev": "tsc --watch"
    },
    "devDependencies": {
      "typescript": "^5.3.3"
    }
  }

  16. /home/kronosss2002/Desktop/workflowos/packages/contracts/tsconfig.json
  {
    "extends": "../../tsconfig.base.json",
    "compilerOptions": { "outDir": "./dist", "rootDir": "./src" },
    "include": ["src/***.ts"]
  }

  17. /home/kronosss2002/Desktop/workflowos/README.md
  # WorkflowOS

  Nền tảng tự động hóa workflow bằng sơ đồ kéo thả.

  ## Quick Start

  \`\`\`bash
  # Install dependencies
  pnpm install

  # Start infrastructure
  docker-compose up -d

  # Copy environment
  cp .env.example .env

  # Run migrations
  pnpm db:migrate

  # Seed data
  pnpm db:seed

  # Start API
  pnpm dev:api

  # Start Worker (separate terminal)
  pnpm dev:worker

  # Start Web (separate terminal)
  pnpm dev:web
  \`\`\`

  ## Architecture

  - apps/api: NestJS modular monolith (REST API)
  - apps/worker: NestJS worker process (BullMQ consumers)
  - apps/web: Next.js 14 + React Flow (frontend)
  - packages/contracts: Shared TypeScript types
  - packages/workflow-schema: Workflow validation
  - packages/observability: Logging, metrics, tracing

  ## Tech Stack

  - Backend: NestJS, TypeORM, PostgreSQL 15, Redis 7, BullMQ
  - Frontend: Next.js 14, React Flow, Tailwind CSS
  - Testing: Vitest, k6
  - Observability: OpenTelemetry, Prometheus, Grafana

  AFTER creating all files, run:
  cd /home/kronosss2002/Desktop/workflowos && pnpm install

  Return: list of files created and pnpm install output.
`, { label: 'monorepo-bootstrap', phase: 'Bootstrap' })

// Stage 2: Database schema (depends on bootstrap creating api directory)
phase('Database')
const database = await agent(`
  Create PostgreSQL schema for WorkflowOS using TypeORM entities and migrations.

  Working directory: /home/kronosss2002/Desktop/workflowos/apps/api

  CREATE these files:

  1. src/database/data-source.ts
  TypeORM DataSource configuration:
  - Read DATABASE_URL from environment
  - Entities from src/modules/***.entity.ts
  - Migrations from src/database/migrations/*.ts
  - synchronize: false (use migrations only)

  2. src/database/migrate.ts
  Migration runner script:
  - Load data-source
  - Run pending migrations
  - Log results

  3. src/database/seed.ts
  Seed script:
  - Create default workspace
  - Create admin user (email: admin@workflowos.local, password: Admin123!)
  - Log results

  4. src/modules/users/user.entity.ts
  @Entity('users')
  export class User {
    @PrimaryGeneratedColumn('uuid') id: string
    @Column({ unique: true }) email: string
    @Column() passwordHash: string
    @CreateDateColumn() createdAt: Date
    @UpdateDateColumn() updatedAt: Date
  }

  5. src/modules/workspaces/workspace.entity.ts
  @Entity('workspaces')
  export class Workspace {
    @PrimaryGeneratedColumn('uuid') id: string
    @Column({ unique: true }) slug: string
    @Column() name: string
    @Column('uuid') ownerId: string
    @ManyToOne(() => User) @JoinColumn({ name: 'ownerId' }) owner: User
    @Column({ type: 'jsonb', default: {} }) settings: Record<string, any>
    @CreateDateColumn() createdAt: Date
    @UpdateDateColumn() updatedAt: Date
  }

  6. src/modules/workspaces/workspace-member.entity.ts
  @Entity('workspace_members')
  @Unique(['workspaceId', 'userId'])
  export class WorkspaceMember {
    @PrimaryGeneratedColumn('uuid') id: string
    @Column('uuid') workspaceId: string
    @ManyToOne(() => Workspace) @JoinColumn({ name: 'workspaceId' }) workspace: Workspace
    @Column('uuid') userId: string
    @ManyToOne(() => User) @JoinColumn({ name: 'userId' }) user: User
    @Column({ type: 'enum', enum: ['owner', 'admin', 'editor', 'operator', 'viewer'] }) role: string
    @CreateDateColumn() joinedAt: Date
  }

  7. src/modules/workflows/workflow.entity.ts
  @Entity('workflows')
  export class Workflow {
    @PrimaryGeneratedColumn('uuid') id: string
    @Column('uuid') workspaceId: string
    @ManyToOne(() => Workspace) @JoinColumn({ name: 'workspaceId' }) workspace: Workspace
    @Column() name: string
    @Column({ nullable: true }) description: string
    @Column({ type: 'enum', enum: ['draft', 'published', 'archived'], default: 'draft' }) status: string
    @Column({ type: 'jsonb', nullable: true }) draftDefinition: any
    @Column('uuid', { nullable: true }) currentVersionId: string
    @CreateDateColumn() createdAt: Date
    @UpdateDateColumn() updatedAt: Date
    @VersionColumn() version: number  // for optimistic locking
  }

  8. src/modules/workflows/workflow-version.entity.ts
  @Entity('workflow_versions')
  @Unique(['workflowId', 'versionNo'])
  export class WorkflowVersion {
    @PrimaryGeneratedColumn('uuid') id: string
    @Column('uuid') workflowId: string
    @ManyToOne(() => Workflow) @JoinColumn({ name: 'workflowId' }) workflow: Workflow
    @Column() versionNo: number
    @Column({ type: 'jsonb' }) definitionJson: any
    @Column() checksum: string
    @CreateDateColumn() publishedAt: Date
  }

  9. src/modules/executions/execution.entity.ts
  @Entity('executions')
  @Index(['workspaceId', 'createdAt'])
  @Index(['workspaceId', 'state', 'createdAt'])
  export class Execution {
    @PrimaryGeneratedColumn('uuid') id: string
    @Column('uuid') workspaceId: string
    @ManyToOne(() => Workspace) @JoinColumn({ name: 'workspaceId' }) workspace: Workspace
    @Column('uuid') workflowVersionId: string
    @ManyToOne(() => WorkflowVersion) @JoinColumn({ name: 'workflowVersionId' }) workflowVersion: WorkflowVersion
    @Column('uuid', { nullable: true }) triggerId: string
    @Column({ type: 'enum', enum: ['queued', 'running', 'succeeded', 'failed', 'canceled', 'timed_out'], default: 'queued' }) state: string
    @Column({ nullable: true }) idempotencyKey: string
    @Column({ nullable: true }) payloadHash: string
    @Column({ type: 'jsonb', nullable: true }) input: any
    @CreateDateColumn() createdAt: Date
    @Column({ type: 'timestamp', nullable: true }) startedAt: Date
    @Column({ type: 'timestamp', nullable: true }) endedAt: Date
  }

  10. src/modules/executions/node-run.entity.ts
  @Entity('node_runs')
  @Unique(['executionId', 'nodeId'])
  export class NodeRun {
    @PrimaryGeneratedColumn('uuid') id: string
    @Column('uuid') executionId: string
    @ManyToOne(() => Execution) @JoinColumn({ name: 'executionId' }) execution: Execution
    @Column() nodeId: string
    @Column({ type: 'enum', enum: ['pending', 'ready', 'running', 'succeeded', 'failed', 'skipped', 'canceled', 'waiting'], default: 'pending' }) state: string
    @Column({ default: 0 }) attemptNo: number
    @Column({ type: 'timestamp', nullable: true }) leaseUntil: Date
    @Column({ type: 'timestamp', nullable: true }) nextRunAt: Date
    @Column({ nullable: true }) outputRef: string
    @Column({ type: 'jsonb', nullable: true }) output: any
    @CreateDateColumn() createdAt: Date
    @UpdateDateColumn() updatedAt: Date
  }

  11. src/modules/executions/node-attempt.entity.ts
  @Entity('node_attempts')
  @Unique(['nodeRunId', 'attemptNo'])
  export class NodeAttempt {
    @PrimaryGeneratedColumn('uuid') id: string
    @Column('uuid') nodeRunId: string
    @ManyToOne(() => NodeRun) @JoinColumn({ name: 'nodeRunId' }) nodeRun: NodeRun
    @Column() attemptNo: number
    @Column() workerId: string
    @Column({ type: 'enum', enum: ['started', 'succeeded', 'failed', 'timed_out'] }) state: string
    @CreateDateColumn() startedAt: Date
    @Column({ type: 'timestamp', nullable: true }) finishedAt: Date
    @Column({ type: 'jsonb', nullable: true }) error: any
  }

  12. src/modules/triggers/trigger.entity.ts
  @Entity('triggers')
  export class Trigger {
    @PrimaryGeneratedColumn('uuid') id: string
    @Column('uuid') workspaceId: string
    @ManyToOne(() => Workspace) @JoinColumn({ name: 'workspaceId' }) workspace: Workspace
    @Column('uuid') workflowId: string
    @ManyToOne(() => Workflow) @JoinColumn({ name: 'workflowId' }) workflow: Workflow
    @Column() name: string
    @Column({ type: 'enum', enum: ['manual', 'webhook', 'cron'] }) type: string
    @Column({ unique: true, nullable: true }) webhookPath: string
    @Column({ type: 'jsonb', default: {} }) config: any
    @Column({ default: true }) enabled: boolean
    @Column({ nullable: true }) secretRef: string
    @CreateDateColumn() createdAt: Date
  }

  13. src/modules/credentials/credential.entity.ts
  @Entity('credentials')
  export class Credential {
    @PrimaryGeneratedColumn('uuid') id: string
    @Column('uuid') workspaceId: string
    @ManyToOne(() => Workspace) @JoinColumn({ name: 'workspaceId' }) workspace: Workspace
    @Column() name: string
    @Column({ type: 'enum', enum: ['api_key', 'oauth', 'basic_auth'] }) type: string
    @Column({ type: 'bytea' }) encryptedBlob: Buffer
    @Column({ default: 1 }) keyVersion: number
    @CreateDateColumn() createdAt: Date
  }

  14. src/modules/audit/audit-log.entity.ts
  @Entity('audit_logs')
  @Index(['workspaceId', 'createdAt'])
  export class AuditLog {
    @PrimaryGeneratedColumn('uuid') id: string
    @Column('uuid') workspaceId: string
    @Column('uuid') actorId: string
    @Column() action: string
    @Column({ type: 'jsonb' }) target: any
    @CreateDateColumn() createdAt: Date
  }

  15. src/modules/outbox/outbox-event.entity.ts
  @Entity('outbox_events')
  @Index(['publishedAt'])
  export class OutboxEvent {
    @PrimaryGeneratedColumn('uuid') id: string
    @Column() aggregateId: string
    @Column() eventType: string
    @Column({ type: 'jsonb' }) payload: any
    @Column({ type: 'timestamp', nullable: true }) publishedAt: Date
    @Column({ default: 0 }) attempts: number
    @CreateDateColumn() createdAt: Date
  }

  16. Generate initial migration:
  Run: cd /home/kronosss2002/Desktop/workflowos/apps/api && pnpm typeorm migration:generate -- -n InitialSchema -d src/database/data-source.ts

  If typeorm CLI not available, create migration file manually at src/database/migrations/1700000000000-InitialSchema.ts with CREATE TABLE statements for all entities above.

  Include all indexes:
  - users(email) UNIQUE
  - workspace_members(workspace_id, user_id) UNIQUE
  - workflow_versions(workflow_id, version_no) UNIQUE
  - executions(workspace_id, created_at DESC, id DESC)
  - executions(workspace_id, state, created_at DESC)
  - node_runs(execution_id, node_id) UNIQUE
  - node_attempts(node_run_id, attempt_no) UNIQUE
  - outbox_events(published_at, id) WHERE published_at IS NULL
  - triggers(workspace_id, webhook_path) UNIQUE WHERE webhook_path IS NOT NULL

  Return: list of entity files created and migration status.
`, { label: 'database-schema', phase: 'Database' })

// Stage 3: Auth module (depends on bootstrap + database)
phase('Auth')
const auth = await agent(`
  Implement authentication module for WorkflowOS API.

  Working directory: /home/kronosss2002/Desktop/workflowos/apps/api

  CREATE these files:

  1. src/modules/auth/auth.module.ts
  NestJS module importing:
  - TypeOrmModule.forFeature([User, RefreshToken])
  - JwtModule (async config from JWT_SECRET)
  - PassportModule
  - ThrottlerModule (for rate limiting)
  Providers: AuthService, UsersService, JwtStrategy, RefreshTokenStrategy, LocalStrategy, PasswordService

  2. src/modules/auth/auth.controller.ts
  Endpoints:
  - POST /auth/register: RegisterDto (email, password) -> User
  - POST /auth/login: LoginDto (email, password) -> {accessToken, refreshToken}
  - POST /auth/refresh: RefreshDto (refreshToken) -> {accessToken}
  - POST /auth/logout: RefreshDto (refreshToken) -> {success: true}
  - POST /auth/forgot-password: ForgotPasswordDto (email) -> {success: true} (stub)
  - POST /auth/reset-password: ResetPasswordDto (token, newPassword) -> {success: true} (stub)

  Use @UseGuards(LocalGuard) for login, @UseGuards(JwtGuard) for others.
  Apply @Throttle({ default: { limit: 5, ttl: 900000 } }) on login (5 attempts / 15min).

  3. src/modules/auth/auth.service.ts
  Methods:
  - register(dto): hash password, create user, return user
  - validateUser(email, password): find user, compare password, return user or null
  - login(user): generate access + refresh tokens, store refresh in DB
  - refresh(token): validate refresh token, rotate (delete old, create new), return new access
  - logout(token): mark refresh token as revoked

  4. src/modules/auth/strategies/jwt.strategy.ts
  PassportStrategy(Strategy) extracting from Bearer header
  validate(payload): return {userId: payload.sub, email: payload.email}

  5. src/modules/auth/strategies/refresh-token.strategy.ts
  PassportStrategy(Strategy, 'jwt-refresh')
  validate(payload): return {userId: payload.sub}

  6. src/modules/auth/strategies/local.strategy.ts
  PassportStrategy(Strategy)
  validate(email, password): call authService.validateUser, throw UnauthorizedException if null

  7. src/modules/auth/guards/jwt.guard.ts
  AuthGuard('jwt')

  8. src/modules/auth/guards/local.guard.ts
  AuthGuard('local')

  9. src/modules/auth/guards/refresh-token.guard.ts
  AuthGuard('jwt-refresh')

  10. src/modules/auth/dto/register.dto.ts
  class RegisterDto {
    @IsEmail() email: string
    @IsString() @MinLength(8) @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)/) password: string
  }

  11. src/modules/auth/dto/login.dto.ts
  class LoginDto {
    @IsEmail() email: string
    @IsString() password: string
  }

  12. src/modules/auth/dto/refresh.dto.ts
  class RefreshDto {
    @IsString() refreshToken: string
  }

  13. src/modules/auth/entities/refresh-token.entity.ts
  @Entity('refresh_tokens')
  export class RefreshToken {
    @PrimaryGeneratedColumn('uuid') id: string
    @Column('uuid') userId: string
    @ManyToOne(() => User) @JoinColumn({ name: 'userId' }) user: User
    @Column() tokenHash: string
    @Column({ type: 'timestamp' }) expiresAt: Date
    @Column({ type: 'timestamp', nullable: true }) revokedAt: Date
    @CreateDateColumn() createdAt: Date
  }

  14. src/modules/auth/services/password.service.ts
  Methods:
  - hash(password): bcrypt.hash(password, 12)
  - compare(password, hash): bcrypt.compare(password, hash)
  - validateStrength(password): check min 8 chars, uppercase, lowercase, number

  15. src/modules/users/users.service.ts
  Methods:
  - create(dto): create user with hashed password
  - findByEmail(email): find user by email
  - findById(id): find user by id

  16. test/auth.service.spec.ts
  Unit tests:
  - register creates user with hashed password
  - validateUser returns user for correct password
  - validateUser returns null for wrong password
  - login generates tokens
  - refresh rotates token (old invalidated)
  - logout revokes token

  17. test/auth.e2e.spec.ts
  Integration tests:
  - POST /auth/register -> 201 with user
  - POST /auth/login -> 200 with tokens
  - POST /auth/refresh -> 200 with new access token
  - POST /auth/login with wrong password -> 401
  - POST /auth/login 6 times -> 429 (rate limit)

  Return: list of files created and test results.
`, { label: 'auth-module', phase: 'Auth' })

// Stage 4: Workspaces + RBAC (depends on bootstrap + database + auth)
phase('Workspaces')
const workspaces = await agent(`
  Implement workspace management and RBAC for WorkflowOS API.

  Working directory: /home/kronosss2002/Desktop/workflowos/apps/api

  CREATE these files:

  1. src/modules/workspaces/workspaces.module.ts
  NestJS module importing:
  - TypeOrmModule.forFeature([Workspace, WorkspaceMember, AuditLog])
  - AuthModule (for JwtGuard)
  Providers: WorkspacesService, WorkspaceMembersService, RolesGuard

  2. src/modules/workspaces/workspaces.controller.ts
  Endpoints (all protected with @UseGuards(JwtGuard, RolesGuard)):

  - POST /workspaces: CreateWorkspaceDto (name, slug) -> Workspace
    Set current user as owner

  - GET /workspaces: list user's workspaces with role
    Return: [{id, name, slug, role, memberCount}]

  - GET /workspaces/:id: detail with member count
    Require: any role in workspace

  - PATCH /workspaces/:id: UpdateWorkspaceDto (name?, settings?)
    Require: owner or admin

  - DELETE /workspaces/:id: soft delete (set status='archived')
    Require: owner only

  3. src/modules/workspaces/workspace-members.controller.ts
  Endpoints:

  - GET /workspaces/:id/members: list members with user details
    Require: any role

  - POST /workspaces/:id/invitations: InviteMemberDto (email, role)
    Require: owner or admin
    Create invitation record (stub: just log, no email sent)

  - POST /invitations/:token/accept: accept invitation
    Add user as member with specified role

  - PATCH /workspaces/:id/members/:userId: ChangeRoleDto (role)
    Require: owner or admin
    Prevent: viewer can't become owner, can't change owner's role

  - DELETE /workspaces/:id/members/:userId: remove member
    Require: owner or admin
    Prevent: can't remove owner

  4. src/modules/workspaces/workspaces.service.ts
  Methods:
  - create(userId, dto): create workspace + add owner as member
  - findAllByUser(userId): query workspaces where user is member
  - findById(id): find workspace with member count
  - update(id, dto): update workspace (check permission first)
  - archive(id): soft delete

  5. src/modules/workspaces/workspace-members.service.ts
  Methods:
  - findByWorkspace(workspaceId): list members with user details
  - invite(workspaceId, dto): create invitation (stub)
  - acceptInvitation(token, userId): add member
  - changeRole(workspaceId, userId, role): update role (check permission)
  - remove(workspaceId, userId): remove member (check permission)

  6. src/modules/workspaces/guards/roles.guard.ts
  CanActivate guard:
  - Extract user from request
  - Extract workspaceId from params
  - Query WorkspaceMember for (workspaceId, userId)
  - If not found: throw ForbiddenException
  - Attach member.role to request
  - Check @RequireRole() metadata (if any)
  - Return true if role matches

  7. src/modules/workspaces/decorators/require-role.decorator.ts
  SetMetadata('roles', roles)

  8. src/modules/workspaces/dto/create-workspace.dto.ts
  class CreateWorkspaceDto {
    @IsString() @Length(3, 50) name: string
    @IsString() @Matches(/^[a-z0-9-]+$/) slug: string
  }

  9. src/modules/workspaces/dto/update-workspace.dto.ts
  class UpdateWorkspaceDto {
    @IsOptional() @IsString() name?: string
    @IsOptional() @IsObject() settings?: Record<string, any>
  }

  10. src/modules/workspaces/dto/invite-member.dto.ts
  class InviteMemberDto {
    @IsEmail() email: string
    @IsEnum(['admin', 'editor', 'operator', 'viewer']) role: string
  }

  11. src/modules/workspaces/dto/change-role.dto.ts
  class ChangeRoleDto {
    @IsEnum(['admin', 'editor', 'operator', 'viewer']) role: string
  }

  12. src/modules/audit/audit.service.ts
  Methods:
  - log(workspaceId, actorId, action, target): insert AuditLog

  Use in workspace mutations: log role changes, workspace updates, member additions/removals.

  13. test/workspaces.e2e.spec.ts
  Integration tests:
  - POST /workspaces -> 201 (user becomes owner)
  - GET /workspaces -> list with role
  - GET /workspaces/:id -> 200 for member, 403 for non-member
  - PATCH /workspaces/:id -> 200 for owner, 403 for viewer
  - POST /workspaces/:id/invitations -> 201 for admin, 403 for viewer
  - DELETE /workspaces/:id/members/:userId -> 200 for owner, can't remove owner

  14. test/tenant-isolation.spec.ts
  Test:
  - User A creates workspace W1
  - User B creates workspace W2
  - User A tries GET /workspaces/W2 -> 403
  - User B tries GET /workspaces/W1 -> 403

  Return: list of files created and test results.
`, { label: 'workspaces-rbac', phase: 'Workspaces' })

// Stage 5: Verify everything works
phase('Verify')
const verify = await agent(`
  Verify WorkflowOS Phase 0 foundation is working.

  Working directory: /home/kronosss2002/Desktop/workflowos

  RUN these checks:

  1. Check all files exist:
  ls -la apps/api/src/modules/users/user.entity.ts
  ls -la apps/api/src/modules/workspaces/workspace.entity.ts
  ls -la apps/api/src/modules/auth/auth.module.ts
  ls -la apps/api/src/database/data-source.ts
  ls -la docker-compose.yml
  ls -la package.json

  2. Start infrastructure:
  docker-compose up -d
  Wait 10s for postgres/redis to be ready

  3. Run migrations:
  cd apps/api && pnpm db:migrate
  Check: all tables created

  4. Run seed:
  cd apps/api && pnpm db:seed
  Check: admin user created, default workspace created

  5. Start API:
  cd apps/api && pnpm dev &
  Wait 5s for startup

  6. Test health endpoint:
  curl http://localhost:3001/health
  Expect: {status: 'ok'}

  7. Test register:
  curl -X POST http://localhost:3001/auth/register \\
    -H "Content-Type: application/json" \\
    -d '{"email":"test@example.com","password":"Test123!"}'
  Expect: 201 with user object

  8. Test login:
  curl -X POST http://localhost:3001/auth/login \\
    -H "Content-Type: application/json" \\
    -d '{"email":"test@example.com","password":"Test123!"}'
  Expect: 200 with {accessToken, refreshToken}

  9. Test workspace creation:
  TOKEN=<from login>
  curl -X POST http://localhost:3001/workspaces \\
    -H "Authorization: Bearer $TOKEN" \\
    -H "Content-Type: application/json" \\
    -d '{"name":"Test Workspace","slug":"test-workspace"}'
  Expect: 201 with workspace object

  10. Test tenant isolation:
  Create second user, try to access first user's workspace -> 403

  11. Run unit tests:
  cd apps/api && pnpm test
  Expect: all tests pass

  12. Stop API:
  kill %1

  13. Stop infrastructure:
  docker-compose down

  Return: detailed results of each check (pass/fail with output).
`, { label: 'verify-foundation', phase: 'Verify' })

log('Phase 0 Foundation complete')
return { bootstrap, database, auth, workspaces, verify }
