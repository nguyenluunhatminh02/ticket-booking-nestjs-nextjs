---
name: anti-slop-web-design
description: Detects and fixes AI-generated looking web designs. Identifies generic patterns (template layouts, stock photos, cookie-cutter components) and transforms them into authentic, personality-driven designs. Use when reviewing or creating web designs to ensure they don't look AI-generated.
metadata:
  type: reference
  tags: [web-design, ai-slop, quality, authenticity]
---

# Anti-Slop Web Design Skill

## Purpose

Detect and eliminate AI slop patterns in web design to create authentic, memorable websites that feel human-made and reflect unique brand personality.

## AI Slop Indicators in Web Design

### Red Flags (Must Fix)

**Typography Issues:**
- Using only top 3 Google Fonts (Inter, Poppins, Roboto)
- No clear hierarchy (everything same size/weight)
- Default system fonts
- Poor font pairings

**Layout Problems:**
- Generic hero section: centered heading + subtitle + CTA
- Three-column feature sections with outline icons
- Identical section patterns throughout
- Cookie-cutter card-based layouts
- Predictable spacing (everything 16px or 24px)

**Visual Elements:**
- Stock photos of "business people" or generic offices
- Purple-to-blue or pink-to-orange gradients
- No custom illustrations or unique graphics
- Generic icon sets (Heroicons, Feather defaults)
- Missing whitespace, cramped design

**Content Issues:**
- Vague, buzzword-heavy copy ("innovative solutions", "cutting-edge")
- Generic testimonials with stock photos
- No brand-specific colors or personality
- Missing microcopy and personality

**Interaction Problems:**
- No animations or interactions beyond basic hover
- Predictable, boring transitions
- No scroll-triggered animations
- No micro-interactions

## Authentic Design Indicators

### Green Flags (Must Have)

**Typography:**
- Custom or lesser-known typefaces
- Unique typography combinations
- Clear hierarchy with varied sizes/weights
- Variable fonts for dynamic typography

**Visual Elements:**
- Custom illustrations or graphics
- Authentic photography (real team, product, customers)
- Custom icon set
- Unique patterns and textures

**Layout:**
- Asymmetric or unconventional layouts
- Generous whitespace and breathing room
- Varied section heights and layouts
- Intentional visual hierarchy

**Interactions:**
- Micro-animations on hover/click
- Scroll-triggered animations
- Smooth, natural transitions
- Custom cursor effects
- Unique loading states

**Content:**
- Specific, not vague copy
- Brand voice evident
- Authentic stories and details
- Personality-driven microcopy

## Validation Checklist

Before approving any web design, verify:

### Typography (Score 1-10)
- [ ] Using custom or unique fonts (not top 3 Google Fonts)
- [ ] Clear hierarchy with varied sizes/weights
- [ ] Font choices match brand personality
- [ ] Good readability and contrast

**Action if score < 7:**
1. Research alternative fonts on Font Squirrel or Adobe Fonts
2. Create custom font pairings (display + body + mono)
3. Establish clear type scale with varied sizes
4. Add custom letter-spacing and line-height

### Colors (Score 1-10)
- [ ] Brand-specific color palette
- [ ] Not using generic "tech blue" or trendy gradients
- [ ] Colors evoke intended emotions
- [ ] Good contrast for accessibility

**Action if score < 7:**
1. Generate unique palette on Coolors.co or Adobe Color
2. Avoid first 3 suggestions (too common)
3. Test palette in Realtime Colors
4. Ensure WCAG AA contrast compliance

### Imagery (Score 1-10)
- [ ] Custom illustrations or authentic photography
- [ ] No generic stock photos
- [ ] Images reflect actual brand/product/team
- [ ] Consistent visual treatment

**Action if score < 7:**
1. Commission custom illustrations or use AI-generated art with custom style
2. Replace stock photos with authentic images
3. Apply consistent filters/treatments
4. Create custom SVG graphics for key sections

### Layout (Score 1-10)
- [ ] Not using identical section patterns
- [ ] Asymmetric or varied layouts
- [ ] Generous whitespace
- [ ] Clear visual hierarchy

**Action if score < 7:**
1. Break grid intentionally with asymmetric layouts
2. Vary section heights (not all 100vh)
3. Add generous padding (48px+ between sections)
4. Create unexpected visual combinations

### Interactions (Score 1-10)
- [ ] Micro-animations on hover/click
- [ ] Scroll-triggered animations
- [ ] Smooth transitions
- [ ] Animations feel natural, not gimmicky

**Action if score < 7:**
1. Add hover effects to all interactive elements
2. Implement scroll-triggered reveals
3. Use Framer Motion or GSAP for smooth animations
4. Add custom cursor effects for personality

### Content (Score 1-10)
- [ ] Specific, not vague copy
- [ ] Brand voice evident
- [ ] No buzzword overload
- [ ] Authentic stories and details

**Action if score < 7:**
1. Replace vague phrases with specific details
2. Add brand personality to copy
3. Include real numbers and examples
4. Write custom microcopy for all UI elements

## Technical Implementation

### CSS Techniques for Unique Designs

**Asymmetric Layouts:**
```css
.asymmetric-grid {
  display: grid;
  grid-template-columns: 1fr 2fr 1fr;
  gap: 2rem;
}

.asymmetric-grid > :nth-child(2) {
  grid-row: span 2;
}
```

**Custom Typography Effects:**
```css
.text-gradient {
  background: linear-gradient(135deg, var(--color-1), var(--color-2));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.text-outline {
  -webkit-text-stroke: 2px var(--color-primary);
  color: transparent;
}
```

**Unique Hover Effects:**
```css
.magnetic-button {
  transition: transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.magnetic-button:hover {
  transform: translate(var(--x, 0), var(--y, 0)) scale(1.05);
}
```

**Scroll-Triggered Animations:**
```css
.reveal {
  opacity: 0;
  transform: translateY(30px);
  transition: opacity 0.6s ease, transform 0.6s ease;
}

.reveal.visible {
  opacity: 1;
  transform: translateY(0);
}
```

### Animation Libraries

**React-Specific:**
- Framer Motion - Declarative animations, gestures
- React Spring - Physics-based animations

**Framework-Agnostic:**
- GSAP - Professional-grade, ScrollTrigger
- Anime.js - Lightweight, simple API
- Motion One - Small, performant

### Component Libraries (Avoid Generic Look)

**Good Choices:**
- shadcn/ui - Customizable, not template-like
- Radix UI - Unstyled, accessible primitives
- Headless UI - Unstyled components

**Avoid:**
- Pre-styled template libraries
- Default themes that feel generic

## Quality Scoring

Calculate overall authenticity score:

```
Typography:    /10
Colors:        /10
Imagery:       /10
Layout:        /10
Interactions:  /10
Content:       /10
-------------------
Total:         /60

Authenticity Percentage: (Total / 60) * 100
```

**Scoring Guide:**
- 90-100%: Excellent - Truly authentic, memorable design
- 80-89%: Good - Mostly authentic, minor improvements needed
- 70-79%: Fair - Some AI slop patterns, needs work
- 60-69%: Poor - Obvious AI-generated look, major overhaul needed
- <60%: Critical - Template-like, complete redesign recommended

## Action Plan

Based on authenticity score:

**90-100%:** Ship it! Design is authentic and memorable.

**80-89%:** Minor polish:
- Add 2-3 more micro-interactions
- Refine typography details
- Enhance custom elements

**70-79%:** Significant improvements:
- Replace generic elements with custom ones
- Add more animations and interactions
- Rewrite vague copy

**60-69%:** Major overhaul:
- Redesign layout to break patterns
- Commission custom illustrations
- Rewrite all copy for personality
- Add comprehensive animations

**<60%:** Complete redesign:
- Start from scratch with brand personality
- Invest in custom visual elements
- Focus on unique interactions
- Ensure every detail reflects brand

## Case Studies

### Linear (linear.app)
- Custom illustrations, unique dark mode palette
- Smooth scroll animations
- Professional but modern personality

### Stripe (stripe.com)
- Custom gradients and animations
- Sophisticated micro-interactions
- Trustworthy, innovative feel

### Vercel (vercel.com)
- Minimalist but unique typography
- Geometric patterns
- Developer-focused, clean aesthetic

## Resources

**Typography:**
- Font Squirrel: Free unique fonts
- Adobe Fonts: Premium typefaces
- Fontjoy: AI-assisted pairing

**Colors:**
- Coolors.co: Palette generation
- Adobe Color: Color theory
- Realtime Colors: Test in UI

**Illustrations:**
- unDraw: Customizable illustrations
- Humaaans: Mix & match people
- Storyset: Animated illustrations

**Animations:**
- Framer Motion: React animations
- GSAP: Professional animations
- Lottie: After Effects for web

## Integration with Workflow

Use this skill:
1. **Before design review**: Run anti-slop checklist
2. **During implementation**: Reference technical patterns
3. **After completion**: Calculate authenticity score
4. **Before launch**: Final validation against all criteria

## Related Skills

- [[aesthetic]] - General design principles
- [[frontend-design]] - Frontend-specific patterns
- [[ui-styling]] - CSS and styling techniques