---
name: web-design-quality-gate
description: Quality gate for web designs to ensure they avoid AI-generated aesthetics. Validates designs against authenticity criteria, provides actionable feedback, and suggests improvements. Use as final checkpoint before launching any web design.
metadata:
  type: reference
  tags: [web-design, quality-gate, validation, authenticity]
---

# Web Design Quality Gate Skill

## Purpose

Final validation checkpoint to ensure web designs are authentic, memorable, and don't exhibit AI-generated characteristics. Provides scoring, actionable feedback, and improvement suggestions.

## Quality Gate Process

### 1. Initial Assessment

**Collect Design Artifacts:**
- Screenshots or live URL
- Design system documentation
- Component library
- Style guide
- Content/copy

**Identify Scope:**
- Number of pages/sections
- Key user flows
- Interactive elements
- Responsive breakpoints

### 2. Authenticity Scoring

Score each category 1-10:

#### Typography (Weight: 20%)

**Criteria:**
- Font uniqueness (not top 3 Google Fonts)
- Clear hierarchy
- Brand-appropriate choices
- Readability and contrast
- Custom details (letter-spacing, line-height)

**Scoring Guide:**
- 9-10: Custom fonts, perfect hierarchy, brand-perfect
- 7-8: Good fonts, clear hierarchy, minor improvements
- 5-6: Acceptable fonts, some hierarchy issues
- 3-4: Generic fonts, poor hierarchy
- 1-2: System fonts only, no hierarchy

**Common Issues:**
- Using Inter/Poppins/Roboto
- No size variation
- Poor line-height
- Inconsistent font weights

**Improvement Suggestions:**
- Explore Font Squirrel for unique options
- Create 3-font system (display/body/mono)
- Establish clear type scale
- Add custom letter-spacing

#### Colors (Weight: 15%)

**Criteria:**
- Brand-specific palette
- Not generic "tech blue" or trendy gradients
- Emotional appropriateness
- Contrast and accessibility
- Consistent application

**Scoring Guide:**
- 9-10: Unique palette, perfect for brand, accessible
- 7-8: Good palette, mostly appropriate
- 5-6: Acceptable but generic
- 3-4: Very generic or poor contrast
- 1-2: Default colors, inaccessible

**Common Issues:**
- Default Tailwind/Bootstrap colors
- Purple-to-blue gradients everywhere
- Poor contrast ratios
- Too many colors

**Improvement Suggestions:**
- Generate palette on Coolors.co
- Test on Realtime Colors
- Ensure WCAG AA compliance
- Limit to 3-5 main colors

#### Imagery (Weight: 20%)

**Criteria:**
- Custom illustrations or authentic photos
- No generic stock photos
- Consistent visual treatment
- Brand-appropriate style
- High quality

**Scoring Guide:**
- 9-10: All custom, consistent, high-quality
- 7-8: Mostly custom, good quality
- 5-6: Mix of custom and stock
- 3-4: Mostly stock photos
- 1-2: All generic stock photos

**Common Issues:**
- Stock photos of "business people"
- Generic office scenes
- Inconsistent styles
- Low-resolution images

**Improvement Suggestions:**
- Commission custom illustrations
- Use authentic team/product photos
- Apply consistent filters
- Create custom SVG graphics

#### Layout (Weight: 15%)

**Criteria:**
- Not template-like
- Asymmetric/varied layouts
- Generous whitespace
- Clear visual hierarchy
- Intentional structure

**Scoring Guide:**
- 9-10: Unique, intentional, breathable
- 7-8: Good variety, mostly intentional
- 5-6: Some variety, acceptable
- 3-4: Template-like, cramped
- 1-2: Obvious template, no whitespace

**Common Issues:**
- Identical section patterns
- Three-column features everywhere
- Cramped spacing
- No visual hierarchy

**Improvement Suggestions:**
- Break grid intentionally
- Vary section heights
- Add generous padding (48px+)
- Create asymmetric layouts

#### Interactions (Weight: 15%)

**Criteria:**
- Micro-animations present
- Scroll-triggered animations
- Smooth transitions
- Natural feel
- Performance-optimized

**Scoring Guide:**
- 9-10: Delightful, smooth, performant
- 7-8: Good animations, mostly smooth
- 5-6: Some animations, basic
- 3-4: Minimal animations, jerky
- 1-2: No animations or broken

**Common Issues:**
- No hover effects
- Jerky animations
- Too many animations
- Slow performance

**Improvement Suggestions:**
- Add hover effects to all interactive elements
- Implement scroll reveals
- Use Framer Motion or GSAP
- Optimize for performance

#### Content (Weight: 15%)

**Criteria:**
- Specific, not vague
- Brand voice evident
- No buzzword overload
- Authentic stories
- Good microcopy

**Scoring Guide:**
- 9-10: Specific, branded, authentic
- 7-8: Mostly specific, good voice
- 5-6: Acceptable but generic
- 3-4: Vague, buzzword-heavy
- 1-2: Completely generic

**Common Issues:**
- "Innovative solutions"
- "Cutting-edge technology"
- Generic testimonials
- No specific details

**Improvement Suggestions:**
- Replace vague phrases with specifics
- Add real numbers and examples
- Write custom microcopy
- Include authentic stories

### 3. Calculate Overall Score

```
Typography:    X / 10 × 0.20 = X.X
Colors:        X / 10 × 0.15 = X.X
Imagery:       X / 10 × 0.20 = X.X
Layout:        X / 10 × 0.15 = X.X
Interactions:  X / 10 × 0.15 = X.X
Content:       X / 10 × 0.15 = X.X
-----------------------------------
Total:         X.X / 10

Authenticity Percentage: X.X × 10 = XX%
```

### 4. Verdict

**90-100%: PASS - Ship It**
- Design is authentic and memorable
- Ready for launch
- Minor polish optional

**80-89%: CONDITIONAL PASS**
- Mostly authentic
- Address identified issues before launch
- 1-2 weeks of refinement

**70-79%: NEEDS WORK**
- Some AI slop patterns detected
- Significant improvements needed
- 2-4 weeks of work

**60-69%: MAJOR REVISION**
- Obvious AI-generated look
- Major overhaul required
- 4-8 weeks of work

**<60%: FAIL - Redesign**
- Template-like appearance
- Complete redesign recommended
- Start from scratch

### 5. Actionable Feedback

For each category scoring < 8, provide:

**Issue:** Specific problem identified
**Impact:** How it affects authenticity
**Priority:** High/Medium/Low
**Solution:** Concrete steps to fix
**Effort:** Time estimate
**Example:** Before/after or code snippet

### 6. Final Report

Generate comprehensive report:

```markdown
# Web Design Quality Gate Report

## Summary
- Overall Score: X.X / 10 (XX%)
- Verdict: PASS / CONDITIONAL / NEEDS WORK / MAJOR REVISION / FAIL
- Launch Readiness: Yes / No / After fixes

## Scores by Category
- Typography: X / 10
- Colors: X / 10
- Imagery: X / 10
- Layout: X / 10
- Interactions: X / 10
- Content: X / 10

## Critical Issues (Must Fix)
1. [Issue description]
   - Impact: [How it affects authenticity]
   - Solution: [How to fix]
   - Effort: [Time estimate]

## Recommended Improvements (Should Fix)
1. [Improvement description]
   - Impact: [How it improves design]
   - Solution: [How to implement]
   - Effort: [Time estimate]

## Nice-to-Have (Optional)
1. [Enhancement description]
   - Impact: [How it enhances design]
   - Solution: [How to implement]
   - Effort: [Time estimate]

## Next Steps
1. [Priority action]
2. [Next action]
3. [Final action]

## Timeline Estimate
- Critical fixes: X weeks
- Recommended improvements: X weeks
- Total to launch: X weeks
```

## Integration with Development Workflow

### When to Run Quality Gate

**Before Design Review:**
- Initial authenticity check
- Identify major issues early
- Set improvement targets

**During Development:**
- Check each component as built
- Ensure consistency across pages
- Validate interactions work

**Before Launch:**
- Final comprehensive check
- Ensure all fixes implemented
- Confirm launch readiness

**Post-Launch:**
- Periodic audits
- Check for drift
- Continuous improvement

### Automated Checks

**CSS Analysis:**
- Detect default framework colors
- Identify generic font stacks
- Check for template patterns

**Image Analysis:**
- Flag stock photo URLs
- Check image dimensions
- Verify custom graphics

**Content Analysis:**
- Detect buzzwords
- Check specificity
- Validate brand voice

**Interaction Analysis:**
- Verify hover states exist
- Check animation performance
- Validate scroll effects

### Manual Review

**Visual Inspection:**
- Does it look like a template?
- Could another brand use this?
- Is it memorable?
- Does it feel human-made?

**User Testing:**
- Show to target audience
- Gather emotional response
- Test memorability
- Validate brand perception

## Common Patterns to Flag

### AI Slop Patterns

**Layout Patterns:**
- Hero: centered heading + subtitle + CTA
- Features: three columns with icons
- Testimonials: card grid with photos
- Pricing: three-tier comparison
- CTA: centered with gradient background

**Visual Patterns:**
- Purple-to-blue gradients
- Rounded cards with shadows
- Outline icons in circles
- Stock photos in rectangles
- Generic illustrations

**Typography Patterns:**
- Inter or Poppins everywhere
- Same size for all headings
- Default line-height
- No letter-spacing adjustments
- System font fallbacks

**Content Patterns:**
- "We're revolutionizing..."
- "Cutting-edge solutions"
- "Innovative platform"
- Generic testimonials
- Vague benefit statements

### Authentic Design Patterns

**Layout Patterns:**
- Asymmetric grids
- Overlapping elements
- Varied section heights
- Unexpected combinations
- Intentional whitespace

**Visual Patterns:**
- Custom illustrations
- Authentic photography
- Unique color palettes
- Custom patterns/textures
- Brand-specific graphics

**Typography Patterns:**
- Custom font choices
- Clear hierarchy
- Varied sizes/weights
- Custom letter-spacing
- Thoughtful pairings

**Content Patterns:**
- Specific details
- Real numbers
- Authentic stories
- Brand personality
- Clear value propositions

## Tools and Automation

### CSS Analysis Script

```javascript
// Detect generic patterns
const genericPatterns = {
  fonts: ['Inter', 'Poppins', 'Roboto', 'Open Sans'],
  colors: ['#6366f1', '#8b5cf6', '#ec4899'], // Common Tailwind
  gradients: ['linear-gradient(135deg, #667eea 0%, #764ba2 100%)']
};

function checkForGenericPatterns(css) {
  const issues = [];
  
  genericPatterns.fonts.forEach(font => {
    if (css.includes(`font-family: ${font}`)) {
      issues.push(`Generic font detected: ${font}`);
    }
  });
  
  // Add more checks...
  
  return issues;
}
```

### Content Analysis

```javascript
// Detect buzzwords
const buzzwords = [
  'innovative', 'cutting-edge', 'revolutionary',
  'synergy', 'leverage', 'paradigm'
];

function checkContent(text) {
  const issues = [];
  
  buzzwords.forEach(word => {
    if (text.toLowerCase().includes(word)) {
      issues.push(`Buzzword detected: ${word}`);
    }
  });
  
  return issues;
}
```

## Best Practices

### For Designers

1. **Start with brand personality** - Define traits first
2. **Invest in typography** - Choose unique fonts
3. **Create custom visuals** - No stock photos
4. **Break patterns** - Avoid templates
5. **Add details** - Micro-interactions matter

### For Developers

1. **Use modern CSS** - Grid, custom properties
2. **Optimize animations** - Performance first
3. **Build custom components** - Avoid defaults
4. **Test on devices** - Real-world testing
5. **Validate accessibility** - WCAG compliance

### For Teams

1. **Establish principles** - Define what's "yours"
2. **Review process** - Check against criteria
3. **User testing** - Validate perception
4. **Continuous improvement** - Regular audits
5. **Documentation** - Maintain standards

## Related Skills

- [[anti-slop-web-design]] - Detection and fixing
- [[authentic-web-design]] - Design guidelines
- [[aesthetic]] - General design principles
- [[frontend-design]] - Frontend patterns