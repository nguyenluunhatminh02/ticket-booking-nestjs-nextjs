# Next.js Mastery Skill

## Purpose
Guide developers in building production-ready Next.js applications with App Router, Server Components, SSR, SSG, ISR, and modern best practices.

## When to Use
- Building Next.js applications with App Router or Pages Router
- Implementing Server Components and Server Actions
- Setting up static generation (SSG), server-side rendering (SSR), or incremental static regeneration (ISR)
- Creating API routes and Route Handlers
- Implementing authentication and middleware
- Optimizing images, fonts, and metadata
- Deploying Next.js applications (Vercel, self-hosted)
- Working with Next.js internationalization (i18n)
- Implementing data fetching patterns
- Building full-stack applications with Next.js

## Core Principles

### 1. Rendering Strategies
```javascript
// Static Generation (SSG) - Build time
export default async function Page() {
  const data = await fetch('https://api.example.com/data');
  return <div>{data.title}</div>;
}

// Server-Side Rendering (SSR) - Request time
export const dynamic = 'force-dynamic';
export default async function Page() {
  const data = await fetch('https://api.example.com/data', { 
    cache: 'no-store' 
  });
  return <div>{data.title}</div>;
}

// Incremental Static Regeneration (ISR) - Background regeneration
export const revalidate = 60; // Revalidate every 60 seconds
export default async function Page() {
  const data = await fetch('https://api.example.com/data');
  return <div>{data.title}</div>;
}
```

### 2. Server Components vs Client Components
```javascript
// Server Component (default in App Router)
// ✅ Can fetch data directly
// ✅ Access backend resources
// ✅ Keep sensitive code on server
// ✅ Reduce client-side JavaScript
export default async function ServerComponent() {
  const data = await fetch('https://api.example.com/data');
  return <div>{data.title}</div>;
}

// Client Component - add 'use client' directive
'use client';
import { useState } from 'react';

export default function ClientComponent() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

### 3. Data Fetching Patterns
```javascript
// ✅ Good: Fetch in Server Components
export default async function Page() {
  const data = await fetch('https://api.example.com/posts', {
    next: { revalidate: 3600 }, // ISR
  });
  const posts = await data.json();
  
  return (
    <ul>
      {posts.map(post => <li key={post.id}>{post.title}</li>)}
    </ul>
  );
}

// ✅ Good: Parallel data fetching
export default async function Page() {
  const [posts, comments] = await Promise.all([
    fetch('https://api.example.com/posts').then(res => res.json()),
    fetch('https://api.example.com/comments').then(res => res.json()),
  ]);
  
  return <div>...</div>;
}

// ✅ Good: Sequential data fetching (when dependent)
export default async function Page({ params }) {
  const post = await fetch(`https://api.example.com/posts/${params.id}`)
    .then(res => res.json());
  
  const comments = await fetch(`https://api.example.com/posts/${params.id}/comments`)
    .then(res => res.json());
  
  return <div>...</div>;
}
```

### 4. Server Actions
```javascript
// app/actions.js
'use server';

import { revalidatePath } from 'next/cache';

export async function createPost(formData) {
  const title = formData.get('title');
  const content = formData.get('content');
  
  await db.post.create({ data: { title, content } });
  revalidatePath('/posts');
}

// app/posts/new/page.jsx
import { createPost } from '@/app/actions';

export default function NewPostPage() {
  return (
    <form action={createPost}>
      <input name="title" required />
      <textarea name="content" required />
      <button type="submit">Create Post</button>
    </form>
  );
}
```

### 5. Route Handlers (API Routes)
```javascript
// app/api/posts/route.js
import { NextResponse } from 'next/server';

export async function GET() {
  const posts = await db.post.findMany();
  return NextResponse.json(posts);
}

export async function POST(request) {
  const data = await request.json();
  const post = await db.post.create({ data });
  return NextResponse.json(post, { status: 201 });
}

// Dynamic routes
// app/api/posts/[id]/route.js
export async function GET(request, { params }) {
  const post = await db.post.findUnique({ 
    where: { id: params.id } 
  });
  return NextResponse.json(post);
}
```

### 6. Middleware
```javascript
// middleware.js
import { NextResponse } from 'next/server';

export function middleware(request) {
  const token = request.cookies.get('token');
  
  if (!token && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/protected/:path*'],
};
```

### 7. Image Optimization
```javascript
import Image from 'next/image';

// ✅ Good: Automatic optimization
<Image
  src="/hero.jpg"
  alt="Hero image"
  width={1200}
  height={600}
  priority // LCP element
  placeholder="blur" // Blur placeholder
  sizes="(max-width: 768px) 100vw, 1200px"
/>

// ✅ Good: Remote images (configure in next.config.js)
<Image
  src="https://example.com/image.jpg"
  alt="Remote image"
  width={800}
  height={400}
/>
```

### 8. Metadata & SEO
```javascript
// app/layout.js or app/page.js
export const metadata = {
  title: 'Page Title',
  description: 'Page description',
  openGraph: {
    title: 'OG Title',
    description: 'OG Description',
    images: ['/og-image.png'],
  },
};

// Dynamic metadata
export async function generateMetadata({ params }) {
  const post = await getPost(params.id);
  return {
    title: post.title,
    description: post.excerpt,
  };
}
```

## Project Structure

```
app/
  layout.js          # Root layout
  page.js            # Home page
  loading.js         # Loading UI
  error.js           # Error UI
  not-found.js       # 404 UI
  
  (auth)/            # Route group (doesn't affect URL)
    login/page.js
    register/page.js
  
  (dashboard)/
    layout.js        # Dashboard layout
    page.js
    settings/page.js
  
  api/
    posts/
      route.js       # GET /api/posts, POST /api/posts
      [id]/
        route.js     # GET /api/posts/:id

public/              # Static assets
lib/                 # Shared utilities
components/          # React components
```

## Best Practices

### Performance
- [ ] Use Server Components by default
- [ ] Minimize Client Components
- [ ] Implement proper caching strategies
- [ ] Optimize images with next/image
- [ ] Use font optimization with next/font
- [ ] Implement code splitting
- [ ] Use dynamic imports for heavy components
- [ ] Enable static generation where possible

### Data Fetching
- [ ] Fetch data in Server Components
- [ ] Use proper cache strategies (force-cache, no-store, revalidate)
- [ ] Implement parallel data fetching
- [ ] Handle loading and error states
- [ ] Use React Query/SWR for client-side fetching

### Security
- [ ] Validate input on server
- [ ] Use Server Actions for mutations
- [ ] Implement proper authentication
- [ ] Protect API routes with middleware
- [ ] Sanitize user-generated content
- [ ] Use environment variables for secrets

### SEO
- [ ] Add proper metadata to all pages
- [ ] Implement Open Graph tags
- [ ] Use semantic HTML
- [ ] Generate sitemaps
- [ ] Add robots.txt
- [ ] Implement canonical URLs

## Common Patterns

### Authentication with NextAuth
```javascript
// app/api/auth/[...nextauth]/route.js
import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      async authorize(credentials) {
        const user = await login(credentials);
        return user;
      },
    }),
  ],
});

export { handler as GET, handler as POST };

// middleware.js
export { default } from 'next-auth/middleware';
export const config = { matcher: ['/dashboard/:path*'] };
```

### Internationalization (i18n)
```javascript
// next.config.js
module.exports = {
  i18n: {
    locales: ['en', 'vi', 'ja'],
    defaultLocale: 'en',
  },
};

// app/[locale]/layout.js
export default async function LocaleLayout({ children, params }) {
  const messages = await import(`@/messages/${params.locale}.json`);
  
  return (
    <html lang={params.locale}>
      <body>{children}</body>
    </html>
  );
}
```

### Error Handling
```javascript
// app/error.js
'use client';

export default function Error({ error, reset }) {
  return (
    <div>
      <h2>Something went wrong</h2>
      <button onClick={() => reset()}>Try again</button>
    </div>
  );
}

// app/global-error.js
'use client';

export default function GlobalError({ error, reset }) {
  return (
    <html>
      <body>
        <h2>Critical error</h2>
        <button onClick={() => reset()}>Try again</button>
      </body>
    </html>
  );
}
```

## Deployment

### Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Production deploy
vercel --prod
```

### Self-Hosted
```bash
# Build
npm run build

# Start
npm start

# Or use Docker
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## Resources
- Next.js Documentation: https://nextjs.org/docs
- Next.js Learn: https://nextjs.org/learn
- Vercel Templates: https://vercel.com/templates
- Next.js GitHub: https://github.com/vercel/next.js
