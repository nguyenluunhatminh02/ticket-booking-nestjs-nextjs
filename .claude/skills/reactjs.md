# ReactJS Mastery Skill

## Purpose
Guide developers in building production-ready React applications with modern best practices, performance optimization, and scalable architecture.

## When to Use
- Building React components (functional or class-based)
- Implementing state management (Context, Redux, Zustand, Jotai)
- Optimizing React performance (memoization, lazy loading, code splitting)
- Setting up React projects with Vite, Next.js, or Create React App
- Implementing React hooks (custom hooks, hook patterns)
- Working with React Router for navigation
- Integrating React with TypeScript
- Testing React components (Jest, React Testing Library, Cypress)
- Implementing React patterns (HOC, Render Props, Compound Components)
- Building accessible React applications

## Core Principles

### 1. Component Design
- **Single Responsibility**: Each component does one thing well
- **Composition over Inheritance**: Build complex UIs from simple components
- **Props Down, Events Up**: Unidirectional data flow
- **Lift State Up**: Share state by moving it to common ancestors
- **Colocate Things**: Keep related code together

### 2. Performance Optimization
```javascript
// ✅ Good: Memoize expensive calculations
const memoizedValue = useMemo(() => computeExpensiveValue(a, b), [a, b]);

// ✅ Good: Prevent unnecessary re-renders
const MemoizedComponent = React.memo(({ data }) => {
  return <div>{data.map(item => <Item key={item.id} {...item} />)}</div>;
});

// ✅ Good: Lazy load routes and components
const LazyComponent = React.lazy(() => import('./HeavyComponent'));

// ✅ Good: Use useCallback for stable function references
const handleClick = useCallback(() => {
  doSomething(dependency);
}, [dependency]);
```

### 3. State Management Patterns
```javascript
// Local state - use useState
const [count, setCount] = useState(0);

// Shared state - use Context
const ThemeContext = createContext();

// Complex state - use useReducer
const [state, dispatch] = useReducer(reducer, initialState);

// Global state - use Redux/Zustand/Jotai
import { create } from 'zustand';
const useStore = create((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}));
```

### 4. Custom Hooks
```javascript
// ✅ Good: Extract reusable logic
function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      return initialValue;
    }
  });

  const setValue = (value) => {
    try {
      setStoredValue(value);
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(error);
    }
  };

  return [storedValue, setValue];
}

// Usage
const [name, setName] = useLocalStorage('name', 'Guest');
```

### 5. Error Handling
```javascript
// ✅ Good: Error Boundaries
class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    logErrorToService(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <h1>Something went wrong.</h1>;
    }
    return this.props.children;
  }
}
```

### 6. Testing Patterns
```javascript
// ✅ Good: Test behavior, not implementation
import { render, screen, fireEvent } from '@testing-library/react';

test('increments counter when button is clicked', () => {
  render(<Counter />);
  
  const button = screen.getByRole('button', { name: /increment/i });
  fireEvent.click(button);
  
  expect(screen.getByText(/count: 1/i)).toBeInTheDocument();
});

// ✅ Good: Test async operations
test('loads data asynchronously', async () => {
  render(<DataComponent />);
  
  expect(await screen.findByText(/loaded/i)).toBeInTheDocument();
});
```

## Best Practices

### Component Structure
```
src/
  components/
    ui/              # Reusable UI components (Button, Input, Modal)
    features/        # Feature-specific components
    layouts/         # Layout components (Header, Footer, Sidebar)
  hooks/             # Custom hooks
  contexts/          # React contexts
  utils/             # Utility functions
  types/             # TypeScript types
```

### Naming Conventions
- Components: PascalCase (`UserProfile.tsx`)
- Hooks: camelCase with `use` prefix (`useAuth.ts`)
- Contexts: PascalCase with `Context` suffix (`ThemeContext.ts`)
- Files: Match component name (`UserProfile.tsx`)

### Performance Checklist
- [ ] Use `React.memo` for pure components
- [ ] Memoize expensive calculations with `useMemo`
- [ ] Stabilize callbacks with `useCallback`
- [ ] Lazy load routes with `React.lazy`
- [ ] Code split with dynamic imports
- [ ] Virtualize long lists (react-window, react-virtualized)
- [ ] Avoid inline object/array creation in render
- [ ] Use proper keys in lists (not index)

### Accessibility Checklist
- [ ] Use semantic HTML elements
- [ ] Provide alt text for images
- [ ] Ensure keyboard navigation works
- [ ] Use ARIA attributes when needed
- [ ] Test with screen readers
- [ ] Maintain color contrast ratios
- [ ] Provide focus indicators

## Common Pitfalls

### ❌ Bad: Mutating state directly
```javascript
// Wrong
state.items.push(newItem);
setState(state);

// Right
setState({ ...state, items: [...state.items, newItem] });
```

### ❌ Bad: Creating objects/arrays in render
```javascript
// Wrong - new object every render
<Button style={{ backgroundColor: 'blue' }} />

// Right - stable reference
const buttonStyle = useMemo(() => ({ backgroundColor: 'blue' }), []);
<Button style={buttonStyle} />
```

### ❌ Bad: Missing dependency in useEffect
```javascript
// Wrong - missing userId dependency
useEffect(() => {
  fetchUser(userId);
}, []); // Missing userId

// Right
useEffect(() => {
  fetchUser(userId);
}, [userId]);
```

## Advanced Patterns

### Compound Components
```javascript
function Select({ children, value, onChange }) {
  return (
    <SelectContext.Provider value={{ value, onChange }}>
      <div className="select">{children}</div>
    </SelectContext.Provider>
  );
}

function Option({ value, children }) {
  const context = useContext(SelectContext);
  return (
    <div
      onClick={() => context.onChange(value)}
      className={context.value === value ? 'selected' : ''}
    >
      {children}
    </div>
  );
}

Select.Option = Option;

// Usage
<Select value={selected} onChange={setSelected}>
  <Select.Option value="a">Option A</Select.Option>
  <Select.Option value="b">Option B</Select.Option>
</Select>
```

### Render Props
```javascript
function MouseTracker({ render }) {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMove = (e) => setPosition({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, []);

  return render(position);
}

// Usage
<MouseTracker render={({ x, y }) => (
  <div>Mouse position: {x}, {y}</div>
)} />
```

## Integration with TypeScript

```typescript
// Component with typed props
interface ButtonProps {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}

const Button: React.FC<ButtonProps> = ({ 
  label, 
  onClick, 
  variant = 'primary',
  disabled = false 
}) => {
  return (
    <button 
      className={`btn btn-${variant}`}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
};

// Hook with generics
function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : initialValue;
  });

  return [value, setValue] as const;
}
```

## Resources
- React Documentation: https://react.dev
- React TypeScript Cheatsheet: https://react-typescript-cheatsheet.netlify.app
- Patterns.dev: https://www.patterns.dev
- Kent C. Dodds Blog: https://kentcdodds.com/blog
- Epic React: https://epicreact.dev
