---
name: authentic-web-design
description: Guidelines for creating authentic, human-centered web designs that avoid AI-generated aesthetics. Focuses on brand personality, custom visuals, unique typography, and memorable interactions. Use when designing new websites or redesigning existing ones.
metadata:
  type: reference
  tags: [web-design, authenticity, brand, human-centered]
---

# Authentic Web Design Skill

## Core Philosophy

Create websites that feel human-made, reflect authentic brand personality, and create memorable experiences that users can't get from template-based designs.

## Design Principles

### 1. Brand Personality First

**Define Brand Traits:**
Choose 3-5 personality traits that define your brand:
- Playful vs Professional
- Modern vs Classic
- Bold vs Subtle
- Technical vs Approachable
- Luxurious vs Accessible

**Translate to Visual Decisions:**
- Playful → Bright colors, rounded shapes, casual copy
- Professional → Muted palette, sharp edges, formal tone
- Modern → Minimal layout, sans-serif fonts, ample whitespace
- Bold → High contrast, large typography, strong colors

### 2. Typography as Foundation

**Font Selection Strategy:**
1. Avoid top 3 Google Fonts (Inter, Poppins, Roboto)
2. Explore Font Squirrel, Adobe Fonts for unique options
3. Test 5-10 fonts before choosing
4. Consider variable fonts for flexibility

**Font Pairing Rules:**
- Display + Body + Mono (3-font system)
- Contrast weights: Display (bold) + Body (regular)
- Match personality: Serif (classic) vs Sans (modern)
- Test at all sizes (12px - 72px)

**Typography Hierarchy:**
```css
/* Example type scale */
h1 { font-size: clamp(2.5rem, 5vw, 4rem); font-weight: 800; }
h2 { font-size: clamp(2rem, 4vw, 3rem); font-weight: 700; }
h3 { font-size: clamp(1.5rem, 3vw, 2rem); font-weight: 600; }
body { font-size: 1rem; line-height: 1.6; }
small { font-size: 0.875rem; }
```

**Custom Details:**
- Letter-spacing for display text (-0.02em to -0.05em)
- Line-height adjustments (1.2 for headings, 1.6 for body)
- Font-feature-settings for ligatures and alternates

### 3. Custom Visual Elements

**Illustrations:**
- Commission custom illustrations that reflect brand
- Use consistent style throughout (line art, flat, 3D)
- Avoid generic stock illustrations
- Consider AI-generated art with custom style prompts

**Photography:**
- Use authentic photos (real team, product, customers)
- Apply consistent filters/treatments
- Avoid stock photos of "business people"
- Invest in professional photography for key sections

**Icons:**
- Create custom icon set or heavily customize existing ones
- Match illustration style
- Consistent stroke width and style
- Avoid default icon library looks

**Patterns & Textures:**
- Create custom SVG patterns
- Use subtle textures for depth
- Ensure patterns are brand-specific
- Test at different scales

### 4. Intentional Layout

**Break the Grid:**
- Use asymmetric layouts
- Vary section heights (not all 100vh)
- Create unexpected visual combinations
- Overlap elements intentionally

**Whitespace Strategy:**
- Generous padding between sections (48px-96px)
- Breathing room around text (24px+)
- Margins that create rhythm
- Whitespace as design element, not empty space

**Visual Hierarchy:**
- Clear primary, secondary, tertiary elements
- Size contrast for importance
- Color contrast for emphasis
- Position for flow (Z-pattern, F-pattern)

**Section Variety:**
- Mix full-width and contained sections
- Alternate background colors/patterns
- Vary content density
- Create visual rhythm

### 5. Memorable Interactions

**Micro-Animations:**
- Hover effects on all interactive elements
- Button press feedback
- Link underline animations
- Card lift/shadow on hover

**Scroll Animations:**
- Reveal elements on scroll
- Parallax effects (subtle)
- Progress indicators
- Section transitions

**Custom Cursors:**
- Custom cursor for brand personality
- Cursor changes on interactive elements
- Magnetic cursor effects
- Cursor trails for playful brands

**Loading States:**
- Custom loading animations
- Skeleton screens with brand colors
- Progress indicators
- Entertaining wait experiences

**Transitions:**
- Smooth page transitions
- Element enter/exit animations
- State change animations
- Consistent timing functions

### 6. Authentic Content

**Copy Guidelines:**
- Be specific, not vague
- Use concrete numbers and examples
- Avoid buzzwords ("innovative", "cutting-edge", "synergy")
- Write like you speak (brand voice)

**Microcopy:**
- Button text: Action-oriented, specific
- Error messages: Helpful, human
- Empty states: Engaging, on-brand
- Success messages: Celebratory, clear

**Storytelling:**
- Include origin stories
- Share real customer stories
- Show behind-the-scenes
- Highlight team members

**Tone Consistency:**
- Define brand voice (friendly, professional, witty)
- Apply consistently across all text
- Match visual personality
- Test with target audience

## Technical Implementation

### Modern CSS Features

**CSS Grid for Unique Layouts:**
```css
.unique-layout {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  grid-template-rows: auto;
  gap: 2rem;
}

.unique-layout > .feature-1 {
  grid-column: 1 / 5;
  grid-row: 1 / 3;
}

.unique-layout > .feature-2 {
  grid-column: 5 / 13;
}
```

**Custom Properties for Design System:**
```css
:root {
  /* Brand colors */
  --color-primary: #6366f3;
  --color-secondary: #8b5cf6;
  --color-accent: #ec4899;
  
  /* Typography */
  --font-display: 'Custom Display', sans-serif;
  --font-body: 'Custom Body', sans-serif;
  --font-mono: 'Custom Mono', monospace;
  
  /* Spacing */
  --space-xs: 0.5rem;
  --space-sm: 1rem;
  --space-md: 2rem;
  --space-lg: 4rem;
  --space-xl: 8rem;
  
  /* Animations */
  --transition-fast: 150ms;
  --transition-base: 300ms;
  --transition-slow: 500ms;
  --easing-smooth: cubic-bezier(0.4, 0, 0.2, 1);
}
```

**Fluid Typography:**
```css
h1 {
  font-size: clamp(2rem, 5vw + 1rem, 4rem);
  line-height: 1.1;
}
```

**Scroll-Driven Animations:**
```css
@keyframes reveal {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.reveal {
  animation: reveal linear;
  animation-timeline: view();
  animation-range: entry 0% cover 40%;
}
```

### Animation Libraries

**Framer Motion (React):**
```jsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  whileInView={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.6 }}
>
  Content
</motion.div>
```

**GSAP with ScrollTrigger:**
```javascript
gsap.from('.element', {
  scrollTrigger: {
    trigger: '.element',
    start: 'top 80%',
    end: 'top 20%',
    scrub: true
  },
  y: 100,
  opacity: 0
});
```

### Performance Considerations

**Animation Performance:**
- Use transform and opacity (GPU-accelerated)
- Avoid animating width, height, top, left
- Use will-change sparingly
- Test on low-end devices

**Image Optimization:**
- Use WebP/AVIF formats
- Responsive images with srcset
- Lazy load below-fold images
- Compress and optimize

**Font Loading:**
- Use font-display: swap
- Preload critical fonts
- Subset fonts to needed characters
- Use variable fonts to reduce files

## Design Process

### 1. Discovery
- Define brand personality traits
- Identify target audience
- Research competitors (to differentiate)
- Gather inspiration (but don't copy)

### 2. Concept
- Create mood boards
- Explore typography directions
- Test color palettes
- Sketch layout concepts

### 3. Design
- Design key pages first
- Establish design system
- Create custom elements
- Design all states (hover, active, etc.)

### 4. Prototype
- Build interactive prototype
- Add animations and interactions
- Test on real devices
- Gather feedback

### 5. Refine
- Polish details
- Optimize performance
- Ensure accessibility
- Final authenticity check

## Evaluation Criteria

**Before Launch, Ask:**
1. Does this look like a template? → Redesign layout
2. Could another brand use this? → Add brand personality
3. Is the typography generic? → Choose unique fonts
4. Are the images stock? → Replace with authentic visuals
5. Are interactions boring? → Add micro-animations
6. Is the copy vague? → Make it specific and branded
7. Does it feel human-made? → Add custom details

**User Testing:**
- Show to target audience
- Ask: "What does this brand feel like?"
- Ask: "What makes this memorable?"
- Ask: "Would you trust this brand?"

## Common Mistakes to Avoid

**Typography:**
- Using only system fonts
- No hierarchy (everything same size)
- Poor contrast for readability
- Too many fonts (>4)

**Colors:**
- Using default framework colors
- Following trends blindly
- Poor contrast for accessibility
- Not testing in different lighting

**Layout:**
- Identical section patterns
- No whitespace
- Grid-only layouts
- Predictable structure

**Images:**
- Stock photos of "business people"
- Generic office scenes
- No consistent treatment
- Low-quality images

**Interactions:**
- No hover states
- Jerky animations
- Too many animations
- Animations that slow down site

**Content:**
- Buzzword overload
- Vague promises
- No specific details
- Generic testimonials

## Resources

**Inspiration:**
- Awwwards: awwwards.com
- Dribbble: dribbble.com
- Behance: behance.net
- Site Inspire: siteinspire.com

**Tools:**
- Figma: Design and prototyping
- Rive: Interactive animations
- Spline: 3D for web
- Lottie: After Effects animations

**Libraries:**
- shadcn/ui: Customizable components
- Radix UI: Unstyled primitives
- Tailwind CSS: Utility-first CSS
- Open Props: CSS custom properties

## Integration

Use this skill when:
1. Starting a new web design project
2. Redesigning an existing website
3. Reviewing a design for authenticity
4. Teaching others about authentic design

## Related Skills

- [[anti-slop-web-design]] - Detection and fixing
- [[aesthetic]] - General design principles
- [[frontend-design]] - Frontend patterns
- [[ui-styling]] - CSS techniques