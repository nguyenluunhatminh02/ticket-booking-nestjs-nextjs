# TypeScript Mastery Skill

## Purpose
Guide developers in writing type-safe, maintainable TypeScript code with advanced type system features, best practices, and common patterns.

## When to Use
- Setting up TypeScript projects (Node.js, React, Next.js, NestJS)
- Writing type-safe functions and classes
- Using advanced TypeScript features (generics, utility types, conditional types)
- Configuring TypeScript compiler options
- Migrating JavaScript to TypeScript
- Implementing type-safe APIs and libraries
- Working with TypeScript decorators
- Using TypeScript with frameworks (React, Vue, Angular, NestJS)
- Creating custom type definitions
- Optimizing TypeScript performance

## Core Principles

### 1. Basic Types
```typescript
// Primitive types
let name: string = 'John';
let age: number = 30;
let isActive: boolean = true;
let data: null = null;
let value: undefined = undefined;

// Arrays
let numbers: number[] = [1, 2, 3];
let names: Array<string> = ['Alice', 'Bob'];

// Objects
let user: { name: string; age: number } = {
  name: 'John',
  age: 30,
};

// Tuples
let pair: [string, number] = ['age', 30];

// Enums
enum Color {
  Red,
  Green,
  Blue,
}
let c: Color = Color.Green;

// Any (avoid when possible)
let value: any = 'anything';

// Unknown (safer than any)
let unknownValue: unknown = 'something';
if (typeof unknownValue === 'string') {
  console.log(unknownValue.toUpperCase());
}

// Void (no return value)
function log(message: string): void {
  console.log(message);
}

// Never (never returns)
function throwError(message: string): never {
  throw new Error(message);
}
```

### 2. Interfaces
```typescript
// Basic interface
interface User {
  id: number;
  name: string;
  email: string;
  age?: number; // Optional property
}

// Extending interfaces
interface Admin extends User {
  role: string;
  permissions: string[];
}

// Function interface
interface Calculator {
  (a: number, b: number): number;
}

const add: Calculator = (a, b) => a + b;

// Index signature
interface Dictionary {
  [key: string]: string;
}

const dict: Dictionary = {
  hello: 'world',
  foo: 'bar',
};

// Readonly properties
interface Config {
  readonly apiKey: string;
  readonly endpoint: string;
}

const config: Config = {
  apiKey: '123',
  endpoint: 'https://api.example.com',
};
// config.apiKey = '456'; // Error: Cannot assign to 'apiKey'
```

### 3. Type Aliases
```typescript
// Basic type alias
type ID = string | number;

// Union types
type Status = 'pending' | 'approved' | 'rejected';

// Intersection types
type Timestamped = { createdAt: Date; updatedAt: Date };
type User = { id: number; name: string } & Timestamped;

// Literal types
type Direction = 'up' | 'down' | 'left' | 'right';

// Template literal types
type EventName = `on${Capitalize<string>}`;

// Type aliases vs interfaces
// Use interfaces for object shapes (extendable)
// Use type aliases for unions, intersections, utilities
```

### 4. Functions
```typescript
// Basic function
function greet(name: string): string {
  return `Hello, ${name}!`;
}

// Arrow function
const add = (a: number, b: number): number => a + b;

// Optional parameters
function createUser(name: string, age?: number): User {
  return { id: 1, name, age };
}

// Default parameters
function greetUser(name: string = 'Guest'): string {
  return `Hello, ${name}!`;
}

// Rest parameters
function sum(...numbers: number[]): number {
  return numbers.reduce((a, b) => a + b, 0);
}

// Function overloads
function parseValue(value: string): number;
function parseValue(value: number): number;
function parseValue(value: string | number): number {
  if (typeof value === 'string') {
    return parseInt(value, 10);
  }
  return value;
}

// Callback functions
function fetchData(callback: (data: string) => void): void {
  setTimeout(() => callback('data'), 1000);
}

// Async functions
async function fetchUser(id: number): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  return response.json();
}
```

### 5. Generics
```typescript
// Generic function
function identity<T>(arg: T): T {
  return arg;
}

const num = identity<number>(42);
const str = identity<string>('hello');

// Generic interface
interface Box<T> {
  content: T;
}

const numberBox: Box<number> = { content: 42 };
const stringBox: Box<string> = { content: 'hello' };

// Generic class
class Stack<T> {
  private items: T[] = [];

  push(item: T): void {
    this.items.push(item);
  }

  pop(): T | undefined {
    return this.items.pop();
  }

  peek(): T | undefined {
    return this.items[this.items.length - 1];
  }
}

const numberStack = new Stack<number>();
numberStack.push(1);
numberStack.push(2);

// Generic constraints
interface HasLength {
  length: number;
}

function logLength<T extends HasLength>(arg: T): T {
  console.log(arg.length);
  return arg;
}

logLength('hello'); // OK
logLength([1, 2, 3]); // OK
// logLength(42); // Error: number doesn't have length

// Multiple type parameters
function pair<A, B>(a: A, b: B): [A, B] {
  return [a, b];
}

const p = pair<string, number>('age', 30);
```

### 6. Utility Types
```typescript
// Partial<T> - Make all properties optional
interface User {
  name: string;
  age: number;
  email: string;
}

type PartialUser = Partial<User>;
// { name?: string; age?: number; email?: string }

// Required<T> - Make all properties required
type RequiredUser = Required<PartialUser>;
// { name: string; age: number; email: string }

// Readonly<T> - Make all properties readonly
type ReadonlyUser = Readonly<User>;

// Pick<T, K> - Pick specific properties
type UserPreview = Pick<User, 'name' | 'email'>;
// { name: string; email: string }

// Omit<T, K> - Omit specific properties
type UserWithoutEmail = Omit<User, 'email'>;
// { name: string; age: number }

// Record<K, T> - Create type with keys K and values T
type UserRoles = Record<'admin' | 'user' | 'guest', number>;
// { admin: number; user: number; guest: number }

// Exclude<T, U> - Exclude types from T that are assignable to U
type T1 = Exclude<'a' | 'b' | 'c', 'a' | 'c'>;
// 'b'

// Extract<T, U> - Extract types from T that are assignable to U
type T2 = Extract<'a' | 'b' | 'c', 'a' | 'f'>;
// 'a'

// NonNullable<T> - Exclude null and undefined from T
type T3 = NonNullable<string | number | undefined>;
// string | number

// ReturnType<T> - Get return type of function
type Fn = (a: number, b: string) => boolean;
type ReturnTypeOfFn = ReturnType<Fn>;
// boolean

// Parameters<T> - Get parameters of function as tuple
type ParametersOfFn = Parameters<Fn>;
// [a: number, b: string]
```

### 7. Conditional Types
```typescript
// Basic conditional type
type IsString<T> = T extends string ? true : false;

type T1 = IsString<string>; // true
type T2 = IsString<number>; // false

// Conditional types with infer
type ReturnType2<T> = T extends (...args: any[]) => infer R ? R : any;

type Fn1 = () => string;
type Return1 = ReturnType2<Fn1>; // string

// Distributive conditional types
type ToArray<T> = T extends any ? T[] : never;

type StrArray = ToArray<string | number>;
// string[] | number[]

// Non-distributive (wrap in tuple)
type ToArrayNonDist<T> = [T] extends [any] ? T[] : never;

type StrArrayNonDist = ToArrayNonDist<string | number>;
// (string | number)[]
```

### 8. Mapped Types
```typescript
// Basic mapped type
type Readonly2<T> = {
  readonly [P in keyof T]: T[P];
};

// Modifying keys
type Getters<T> = {
  [P in keyof T as `get${Capitalize<string & P>}`]: () => T[P];
};

interface User {
  name: string;
  age: number;
}

type UserGetters = Getters<User>;
// { getName: () => string; getAge: () => number }

// Filter properties
type RemoveNulls<T> = {
  [P in keyof T as T[P] extends null | undefined ? never : P]: T[P];
};

interface Data {
  a: string;
  b: number | null;
  c: boolean | undefined;
  d: string;
}

type CleanData = RemoveNulls<Data>;
// { a: string; d: string }
```

### 9. Type Guards
```typescript
// typeof type guard
function isString(value: unknown): value is string {
  return typeof value === 'string';
}

// instanceof type guard
function isDate(value: unknown): value is Date {
  return value instanceof Date;
}

// in operator type guard
interface Fish {
  swim(): void;
}
interface Bird {
  fly(): void;
}

function move(animal: Fish | Bird) {
  if ('swim' in animal) {
    animal.swim();
  } else {
    animal.fly();
  }
}

// Custom type guards
interface Cat {
  meow(): void;
}

function isCat(pet: any): pet is Cat {
  return typeof pet.meow === 'function';
}

// Discriminated unions
interface Square {
  kind: 'square';
  size: number;
}

interface Circle {
  kind: 'circle';
  radius: number;
}

type Shape = Square | Circle;

function area(shape: Shape): number {
  switch (shape.kind) {
    case 'square':
      return shape.size * shape.size;
    case 'circle':
      return Math.PI * shape.radius ** 2;
  }
}
```

### 10. Decorators
```typescript
// Class decorator
function sealed(constructor: Function) {
  Object.seal(constructor);
  Object.seal(constructor.prototype);
}

@sealed
class User {
  constructor(public name: string) {}
}

// Method decorator
function log(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
) {
  const originalMethod = descriptor.value;
  
  descriptor.value = function (...args: any[]) {
    console.log(`Calling ${propertyKey} with`, args);
    return originalMethod.apply(this, args);
  };
}

class Calculator {
  @log
  add(a: number, b: number): number {
    return a + b;
  }
}

// Property decorator
function readonly(target: any, propertyKey: string) {
  Object.defineProperty(target, propertyKey, {
    writable: false,
  });
}

class Config {
  @readonly
  apiKey: string = '123';
}

// Parameter decorator
function validate(
  target: any,
  propertyKey: string,
  parameterIndex: number
) {
  console.log(`Validating parameter ${parameterIndex} of ${propertyKey}`);
}

class UserService {
  createUser(@validate name: string) {
    // ...
  }
}
```

## Best Practices

### Type Safety
- [ ] Avoid `any` type (use `unknown` instead)
- [ ] Use strict mode in tsconfig.json
- [ ] Enable `noImplicitAny`, `strictNullChecks`
- [ ] Use type guards for runtime type checking
- [ ] Prefer interfaces for object shapes
- [ ] Use enums for finite sets of values
- [ ] Use union types for alternatives

### Code Organization
- [ ] Group related types in namespaces or modules
- [ ] Use type aliases for complex types
- [ ] Extract reusable types to separate files
- [ ] Document complex types with JSDoc
- [ ] Use declaration files (.d.ts) for libraries

### Performance
- [ ] Avoid deeply nested generic types
- [ ] Use type assertions sparingly
- [ ] Prefer type inference when possible
- [ ] Use `const` assertions for literal types
- [ ] Avoid circular type references

### Testing
```typescript
// Type testing
type Expect<T extends true> = T;
type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends <
  T
>() => T extends Y ? 1 : 2
  ? true
  : false;

type T1 = Expect<Equal<string, string>>;
type T2 = Expect<Equal<number, number>>;
```

## Common Patterns

### Builder Pattern
```typescript
class QueryBuilder<T> {
  private conditions: string[] = [];

  where(condition: string): this {
    this.conditions.push(condition);
    return this;
  }

  andWhere(condition: string): this {
    this.conditions.push(`AND ${condition}`);
    return this;
  }

  build(): string {
    return `SELECT * FROM table WHERE ${this.conditions.join(' ')}`;
  }
}

const query = new QueryBuilder()
  .where('age > 18')
  .andWhere('status = "active"')
  .build();
```

### Result Pattern
```typescript
type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

function divide(a: number, b: number): Result<number, string> {
  if (b === 0) {
    return { success: false, error: 'Division by zero' };
  }
  return { success: true, data: a / b };
}

const result = divide(10, 2);
if (result.success) {
  console.log(result.data);
} else {
  console.error(result.error);
}
```

### Branded Types
```typescript
type Brand<T, B> = T & { __brand: B };

type UserId = Brand<number, 'UserId'>;
type OrderId = Brand<number, 'OrderId'>;

function getUserId(id: UserId): number {
  return id;
}

const userId = 42 as UserId;
const orderId = 42 as OrderId;

getUserId(userId); // OK
// getUserId(orderId); // Error
```

## Configuration

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## Resources
- TypeScript Documentation: https://www.typescriptlang.org/docs
- TypeScript Handbook: https://www.typescriptlang.org/docs/handbook
- Type Challenges: https://github.com/type-challenges/type-challenges
- TypeScript Deep Dive: https://basarat.gitbook.io/typescript
- Total TypeScript: https://www.totaltypescript.com
