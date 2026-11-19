# NestJS Mastery Skill

## Purpose
Guide developers in building scalable, maintainable server-side applications with NestJS using TypeScript, dependency injection, and modular architecture.

## When to Use
- Building RESTful APIs with NestJS
- Creating GraphQL APIs
- Implementing microservices architecture
- Setting up authentication and authorization
- Working with databases (TypeORM, Prisma, Mongoose)
- Implementing real-time features with WebSockets
- Building modular, testable applications
- Integrating third-party services
- Implementing background jobs and queues
- Setting up CI/CD for NestJS applications

## Core Principles

### 1. Module Organization
```typescript
// feature/feature.module.ts
import { Module } from '@nestjs/common';
import { FeatureController } from './feature.controller';
import { FeatureService } from './feature.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Feature } from './entities/feature.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Feature])],
  controllers: [FeatureController],
  providers: [FeatureService],
  exports: [FeatureService], // Export if used by other modules
})
export class FeatureModule {}
```

### 2. Controllers
```typescript
// feature/feature.controller.ts
import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  Delete, 
  Put,
  HttpCode,
  HttpStatus,
  UseGuards,
  Query,
} from '@nestjs/common';
import { FeatureService } from './feature.service';
import { CreateFeatureDto } from './dto/create-feature.dto';
import { UpdateFeatureDto } from './dto/update-feature.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('features')
@UseGuards(JwtAuthGuard)
export class FeatureController {
  constructor(private readonly featureService: FeatureService) {}

  @Post()
  create(@Body() createFeatureDto: CreateFeatureDto) {
    return this.featureService.create(createFeatureDto);
  }

  @Get()
  findAll(@Query('limit') limit: number = 10) {
    return this.featureService.findAll(limit);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.featureService.findOne(id);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() updateFeatureDto: UpdateFeatureDto,
  ) {
    return this.featureService.update(id, updateFeatureDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.featureService.remove(id);
  }
}
```

### 3. Services
```typescript
// feature/feature.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Feature } from './entities/feature.entity';
import { CreateFeatureDto } from './dto/create-feature.dto';
import { UpdateFeatureDto } from './dto/update-feature.dto';

@Injectable()
export class FeatureService {
  constructor(
    @InjectRepository(Feature)
    private readonly featureRepository: Repository<Feature>,
  ) {}

  async create(createFeatureDto: CreateFeatureDto): Promise<Feature> {
    const feature = this.featureRepository.create(createFeatureDto);
    return this.featureRepository.save(feature);
  }

  async findAll(limit: number = 10): Promise<Feature[]> {
    return this.featureRepository.find({
      take: limit,
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Feature> {
    const feature = await this.featureRepository.findOne({ where: { id } });
    if (!feature) {
      throw new NotFoundException(`Feature #${id} not found`);
    }
    return feature;
  }

  async update(id: string, updateFeatureDto: UpdateFeatureDto): Promise<Feature> {
    const feature = await this.findOne(id);
    Object.assign(feature, updateFeatureDto);
    return this.featureRepository.save(feature);
  }

  async remove(id: string): Promise<void> {
    const result = await this.featureRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Feature #${id} not found`);
    }
  }
}
```

### 4. DTOs (Data Transfer Objects)
```typescript
// feature/dto/create-feature.dto.ts
import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class CreateFeatureDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsOptional()
  description?: string;
}

// feature/dto/update-feature.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateFeatureDto } from './create-feature.dto';

export class UpdateFeatureDto extends PartialType(CreateFeatureDto) {}
```

### 5. Entities (TypeORM)
```typescript
// feature/entities/feature.entity.ts
import { 
  Entity, 
  Column, 
  PrimaryGeneratedColumn, 
  CreateDateColumn, 
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity()
export class Feature {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @ManyToOne(() => User, (user) => user.features)
  owner: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

### 6. Authentication (JWT)
```typescript
// auth/auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '7d' },
    }),
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}

// auth/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (user && await bcrypt.compare(password, user.password)) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload = { email: user.email, sub: user.id };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}

// auth/guards/jwt-auth.guard.ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

### 7. Middleware
```typescript
// common/middleware/logger.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    console.log(`${req.method} ${req.originalUrl}`);
    next();
  }
}

// app.module.ts
import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { LoggerMiddleware } from './common/middleware/logger.middleware';

@Module({
  imports: [/* ... */],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware)
      .forRoutes('*');
  }
}
```

### 8. Exception Filters
```typescript
// common/filters/http-exception.filter.ts
import { 
  ExceptionFilter, 
  Catch, 
  ArgumentsHost, 
  HttpException 
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();

    response
      .status(status)
      .json({
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.url,
        message: exception.message,
      });
  }
}

// main.ts
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(3000);
}
bootstrap();
```

### 9. Pipes (Validation)
```typescript
// main.ts
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, // Strip non-decorated properties
    forbidNonWhitelisted: true, // Throw error if non-whitelisted
    transform: true, // Auto-transform payloads to DTO instances
  }));
  await app.listen(3000);
}
bootstrap();
```

### 10. Interceptors
```typescript
// common/interceptors/transform.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  data: T;
  timestamp: string;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    return next.handle().pipe(
      map(data => ({
        data,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}

// main.ts
app.useGlobalInterceptors(new TransformInterceptor());
```

## Project Structure

```
src/
  app.module.ts           # Root module
  main.ts                 # Application entry point
  
  auth/                   # Authentication module
    auth.module.ts
    auth.service.ts
    auth.controller.ts
    strategies/
      jwt.strategy.ts
    guards/
      jwt-auth.guard.ts
  
  users/                  # Users module
    users.module.ts
    users.service.ts
    users.controller.ts
    entities/
      user.entity.ts
    dto/
      create-user.dto.ts
  
  features/               # Feature module
    features.module.ts
    features.service.ts
    features.controller.ts
    entities/
      feature.entity.ts
    dto/
      create-feature.dto.ts
  
  common/                 # Shared code
    decorators/
    filters/
    guards/
    interceptors/
    middleware/
    pipes/
  
  config/                 # Configuration
    config.module.ts
    config.service.ts
```

## Best Practices

### Architecture
- [ ] Use modular architecture (feature-based modules)
- [ ] Apply dependency injection consistently
- [ ] Separate concerns (controllers, services, repositories)
- [ ] Use DTOs for data validation
- [ ] Implement proper error handling
- [ ] Use guards for authentication/authorization
- [ ] Apply interceptors for cross-cutting concerns

### Security
- [ ] Validate all input with class-validator
- [ ] Use JWT for authentication
- [ ] Implement role-based access control (RBAC)
- [ ] Hash passwords with bcrypt
- [ ] Use environment variables for secrets
- [ ] Enable CORS properly
- [ ] Implement rate limiting
- [ ] Use HTTPS in production

### Performance
- [ ] Use database indexing
- [ ] Implement caching (Redis)
- [ ] Use pagination for large datasets
- [ ] Optimize database queries
- [ ] Use connection pooling
- [ ] Implement background jobs for heavy tasks

### Testing
```typescript
// feature/feature.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { FeatureService } from './feature.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Feature } from './entities/feature.entity';

describe('FeatureService', () => {
  let service: FeatureService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureService,
        {
          provide: getRepositoryToken(Feature),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<FeatureService>(FeatureService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return an array of features', async () => {
      const result = [/* mock data */];
      jest.spyOn(service, 'findAll').mockResolvedValue(result);

      expect(await service.findAll()).toBe(result);
    });
  });
});
```

## GraphQL Integration

```typescript
// feature/feature.resolver.ts
import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { FeatureService } from './feature.service';
import { Feature } from './entities/feature.entity';
import { CreateFeatureInput } from './dto/create-feature.input';

@Resolver(() => Feature)
export class FeatureResolver {
  constructor(private readonly featureService: FeatureService) {}

  @Mutation(() => Feature)
  createFeature(@Args('createFeatureInput') createFeatureInput: CreateFeatureInput) {
    return this.featureService.create(createFeatureInput);
  }

  @Query(() => [Feature], { name: 'features' })
  findAll() {
    return this.featureService.findAll();
  }

  @Query(() => Feature, { name: 'feature' })
  findOne(@Args('id', { type: () => ID }) id: string) {
    return this.featureService.findOne(id);
  }
}
```

## Microservices

```typescript
// main.ts (microservice)
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.TCP,
      options: {
        host: '0.0.0.0',
        port: 3001,
      },
    },
  );
  await app.listen();
}
bootstrap();

// feature/feature.controller.ts (message pattern)
import { Controller, Get } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';

@Controller()
export class FeatureController {
  @MessagePattern({ cmd: 'getFeatures' })
  getFeatures() {
    return this.featureService.findAll();
  }
}
```

## Resources
- NestJS Documentation: https://docs.nestjs.com
- NestJS GitHub: https://github.com/nestjs/nest
- NestJS Awesome: https://github.com/nestjs/awesome-nestjs
- TypeORM Documentation: https://typeorm.io
- Prisma Documentation: https://www.prisma.io/docs
