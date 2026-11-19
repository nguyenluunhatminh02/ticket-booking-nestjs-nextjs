# Testing JavaScript Applications Mastery Skill

## Purpose
Guide developers in writing comprehensive, maintainable tests for JavaScript/TypeScript applications using modern testing frameworks and best practices.

## When to Use
- Writing unit tests for functions and classes
- Creating integration tests for APIs and services
- Implementing end-to-end (E2E) tests
- Testing React components
- Testing Node.js applications
- Setting up test coverage reporting
- Implementing test-driven development (TDD)
- Mocking dependencies and external services
- Testing async code and promises
- Setting up CI/CD test pipelines

## Core Principles

### 1. Test Structure (AAA Pattern)
```javascript
// ✅ Good: Arrange-Act-Assert
test('should calculate total price correctly', () => {
  // Arrange
  const cart = new Cart();
  cart.addItem({ id: 1, price: 10, quantity: 2 });
  cart.addItem({ id: 2, price: 20, quantity: 1 });

  // Act
  const total = cart.getTotal();

  // Assert
  expect(total).toBe(40);
});
```

### 2. Test Naming Convention
```javascript
// ✅ Good: Descriptive test names
describe('UserService', () => {
  describe('createUser', () => {
    it('should create a user with valid data', () => {});
    it('should throw error when email is invalid', () => {});
    it('should hash password before saving', () => {});
  });
});

// ❌ Bad: Vague test names
test('works', () => {});
test('test1', () => {});
```

### 3. Unit Testing with Jest
```javascript
// math.js
function add(a, b) {
  return a + b;
}

function multiply(a, b) {
  return a * b;
}

module.exports = { add, multiply };

// math.test.js
const { add, multiply } = require('./math');

describe('Math functions', () => {
  describe('add', () => {
    it('should add two positive numbers', () => {
      expect(add(2, 3)).toBe(5);
    });

    it('should handle negative numbers', () => {
      expect(add(-1, 1)).toBe(0);
    });

    it('should handle zero', () => {
      expect(add(0, 5)).toBe(5);
    });
  });

  describe('multiply', () => {
    it('should multiply two numbers', () => {
      expect(multiply(2, 3)).toBe(6);
    });

    it('should handle zero', () => {
      expect(multiply(5, 0)).toBe(0);
    });
  });
});
```

### 4. Testing Async Code
```javascript
// ✅ Good: Using async/await
test('should fetch user data', async () => {
  const userData = await fetchUser(1);
  expect(userData).toHaveProperty('name');
  expect(userData).toHaveProperty('email');
});

// ✅ Good: Testing promises
test('should resolve with user data', () => {
  return fetchUser(1).then(data => {
    expect(data).toBeDefined();
  });
});

// ✅ Good: Testing async errors
test('should throw error for invalid user', async () => {
  await expect(fetchUser(999)).rejects.toThrow('User not found');
});

// ✅ Good: Using done callback (legacy)
test('should fetch data', (done) => {
  fetchData(data => {
    expect(data).toBeDefined();
    done();
  });
});
```

### 5. Mocking Functions
```javascript
// ✅ Good: Mock functions
const mockCallback = jest.fn((x) => 42 + x);

[1, 2, 3].forEach(mockCallback);

expect(mockCallback).toHaveBeenCalledTimes(3);
expect(mockCallback).toHaveBeenCalledWith(1);
expect(mockCallback.mock.calls).toEqual([[1], [2], [3]]);

// ✅ Good: Mock return values
const mockFn = jest.fn();
mockFn.mockReturnValue('default');
mockFn.mockReturnValueOnce('first call');
mockFn.mockReturnValueOnce('second call');

// ✅ Good: Mock implementations
const mockFn = jest.fn(url => {
  return Promise.resolve({ data: 'mocked' });
});
```

### 6. Mocking Modules
```javascript
// ✅ Good: Mock entire module
jest.mock('./api');
const api = require('./api');

api.fetchData.mockResolvedValue({ id: 1, name: 'Test' });

test('should use mocked API', async () => {
  const result = await processData();
  expect(api.fetchData).toHaveBeenCalled();
  expect(result).toEqual({ id: 1, name: 'Test' });
});

// ✅ Good: Partial mock
jest.mock('./api', () => ({
  ...jest.requireActual('./api'),
  fetchData: jest.fn(),
}));

// ✅ Good: Mock with factory
jest.mock('./config', () => ({
  getApiKey: () => 'mock-api-key',
  getTimeout: () => 5000,
}));
```

### 7. Testing Classes
```javascript
// cart.js
class Cart {
  constructor() {
    this.items = [];
  }

  addItem(item) {
    this.items.push(item);
  }

  getTotal() {
    return this.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }

  getItemCount() {
    return this.items.length;
  }
}

module.exports = Cart;

// cart.test.js
const Cart = require('./cart');

describe('Cart', () => {
  let cart;

  beforeEach(() => {
    cart = new Cart();
  });

  it('should start with empty items', () => {
    expect(cart.getItemCount()).toBe(0);
  });

  it('should add items', () => {
    cart.addItem({ id: 1, price: 10, quantity: 1 });
    expect(cart.getItemCount()).toBe(1);
  });

  it('should calculate total correctly', () => {
    cart.addItem({ id: 1, price: 10, quantity: 2 });
    cart.addItem({ id: 2, price: 20, quantity: 1 });
    expect(cart.getTotal()).toBe(40);
  });
});
```

### 8. Testing React Components
```javascript
// Button.jsx
import React from 'react';

export default function Button({ onClick, children, disabled = false }) {
  return (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

// Button.test.jsx
import { render, screen, fireEvent } from '@testing-library/react';
import Button from './Button';

describe('Button', () => {
  it('should render with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('should call onClick when clicked', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    
    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should be disabled when disabled prop is true', () => {
    render(<Button disabled>Click me</Button>);
    expect(screen.getByText('Click me')).toBeDisabled();
  });

  it('should not call onClick when disabled', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick} disabled>Click me</Button>);
    
    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).not.toHaveBeenCalled();
  });
});
```

### 9. Testing Hooks
```javascript
// useCounter.js
import { useState, useCallback } from 'react';

export function useCounter(initialValue = 0) {
  const [count, setCount] = useState(initialValue);
  
  const increment = useCallback(() => setCount(c => c + 1), []);
  const decrement = useCallback(() => setCount(c => c - 1), []);
  const reset = useCallback(() => setCount(initialValue), [initialValue]);
  
  return { count, increment, decrement, reset };
}

// useCounter.test.js
import { renderHook, act } from '@testing-library/react';
import { useCounter } from './useCounter';

describe('useCounter', () => {
  it('should initialize with default value', () => {
    const { result } = renderHook(() => useCounter());
    expect(result.current.count).toBe(0);
  });

  it('should initialize with custom value', () => {
    const { result } = renderHook(() => useCounter(10));
    expect(result.current.count).toBe(10);
  });

  it('should increment count', () => {
    const { result } = renderHook(() => useCounter());
    
    act(() => {
      result.current.increment();
    });
    
    expect(result.current.count).toBe(1);
  });

  it('should decrement count', () => {
    const { result } = renderHook(() => useCounter(5));
    
    act(() => {
      result.current.decrement();
    });
    
    expect(result.current.count).toBe(4);
  });

  it('should reset count', () => {
    const { result } = renderHook(() => useCounter(10));
    
    act(() => {
      result.current.increment();
      result.current.increment();
    });
    
    act(() => {
      result.current.reset();
    });
    
    expect(result.current.count).toBe(10);
  });
});
```

### 10. API Testing (Supertest)
```javascript
// app.js
const express = require('express');
const app = express();

app.use(express.json());

app.get('/api/users', (req, res) => {
  res.json([{ id: 1, name: 'John' }]);
});

app.post('/api/users', (req, res) => {
  const { name } = req.body;
  res.status(201).json({ id: 2, name });
});

module.exports = app;

// app.test.js
const request = require('supertest');
const app = require('./app');

describe('API Endpoints', () => {
  describe('GET /api/users', () => {
    it('should return users', async () => {
      const response = await request(app).get('/api/users');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toHaveProperty('name');
    });
  });

  describe('POST /api/users', () => {
    it('should create a user', async () => {
      const response = await request(app)
        .post('/api/users')
        .send({ name: 'Jane' });
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Jane');
    });

    it('should validate request body', async () => {
      const response = await request(app)
        .post('/api/users')
        .send({});
      
      expect(response.status).toBe(400);
    });
  });
});
```

### 11. E2E Testing (Playwright/Cypress)
```javascript
// e2e/login.spec.js (Playwright)
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should login successfully', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('[name="email"]', 'user@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('h1')).toContainText('Welcome');
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('[name="email"]', 'invalid@example.com');
    await page.fill('[name="password"]', 'wrong');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('.error-message')).toBeVisible();
  });
});

// cypress/e2e/login.cy.js (Cypress)
describe('Authentication', () => {
  it('should login successfully', () => {
    cy.visit('/login');
    
    cy.get('[name="email"]').type('user@example.com');
    cy.get('[name="password"]').type('password123');
    cy.get('button[type="submit"]').click();
    
    cy.url().should('include', '/dashboard');
    cy.get('h1').should('contain', 'Welcome');
  });
});
```

## Test Coverage

```javascript
// jest.config.js
module.exports = {
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{js,jsx,ts,tsx}',
    '!src/index.js',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};

// Run with coverage
// npm test -- --coverage
```

## Best Practices

### Test Organization
- [ ] Group related tests in describe blocks
- [ ] Use clear, descriptive test names
- [ ] Follow AAA pattern (Arrange-Act-Assert)
- [ ] Keep tests independent (no shared state)
- [ ] Use beforeEach/afterEach for setup/teardown
- [ ] Test one thing per test

### What to Test
- [ ] Happy path (expected behavior)
- [ ] Edge cases (boundaries, empty values)
- [ ] Error cases (invalid input, exceptions)
- [ ] Async behavior (promises, callbacks)
- [ ] User interactions (clicks, form submissions)
- [ ] API responses (success, failure, timeouts)

### Mocking Strategy
- [ ] Mock external dependencies (APIs, databases)
- [ ] Mock timers for async code
- [ ] Use spies to verify function calls
- [ ] Reset mocks between tests
- [ ] Mock only what's necessary

### Performance
- [ ] Run tests in parallel when possible
- [ ] Use test snapshots sparingly
- [ ] Avoid testing implementation details
- [ ] Keep tests fast (< 100ms per unit test)
- [ ] Use watch mode during development

## Common Patterns

### Testing Database Operations
```javascript
// ✅ Good: Use test database
describe('UserService', () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  it('should create user', async () => {
    const user = await userService.create({ email: 'test@example.com' });
    expect(user).toHaveProperty('id');
  });
});
```

### Testing File Uploads
```javascript
test('should upload file', async () => {
  const file = fs.readFileSync('test-image.jpg');
  
  const response = await request(app)
    .post('/api/upload')
    .attach('file', file);
  
  expect(response.status).toBe(200);
  expect(response.body).toHaveProperty('url');
});
```

### Testing Environment Variables
```javascript
describe('Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should use default values', () => {
    delete process.env.API_KEY;
    const config = require('./config');
    expect(config.apiKey).toBe('default-key');
  });

  it('should use environment variables', () => {
    process.env.API_KEY = 'test-key';
    const config = require('./config');
    expect(config.apiKey).toBe('test-key');
  });
});
```

## Debugging Tests

```javascript
// ✅ Good: Use console.log for debugging
test('debug test', () => {
  const result = someFunction();
  console.log('Result:', result);
  expect(result).toBeDefined();
});

// ✅ Good: Use .only to run specific tests
describe.only('Focus on this suite', () => {
  it('run this test', () => {});
});

it.only('run only this test', () => {});

// ✅ Good: Use .skip to skip tests
describe.skip('Skip this suite', () => {
  it('skip this test', () => {});
});

it.skip('skip this test', () => {});
```

## Resources
- Jest Documentation: https://jestjs.io/docs
- React Testing Library: https://testing-library.com/docs/react-testing-library/intro/
- Playwright Documentation: https://playwright.dev/docs
- Cypress Documentation: https://docs.cypress.io
- Testing JavaScript (Kent C. Dodds): https://testingjavascript.com
- Testing Playground: https://testing-playground.com
