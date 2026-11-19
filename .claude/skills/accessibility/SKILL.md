---
name: accessibility
description: Web accessibility (a11y) guidelines, WCAG 2.1/2.2 compliance, screen reader optimization, keyboard navigation, ARIA attributes, color contrast, focus management, accessible forms, and inclusive design patterns. Use when building accessible interfaces, implementing WCAG standards, optimizing for screen readers, adding keyboard navigation, or ensuring inclusive user experiences.
license: MIT
version: 1.0.0
trigger: When building accessible interfaces, implementing WCAG standards, optimizing for screen readers, adding keyboard navigation, or ensuring inclusive user experiences.
---

# Accessibility Skill

Build inclusive web experiences with WCAG compliance, screen reader optimization, keyboard navigation, and accessible design patterns.

## When to Use

- Building accessible web interfaces
- Implementing WCAG 2.1/2.2 standards
- Optimizing for screen readers
- Adding keyboard navigation
- Designing accessible forms
- Improving color contrast
- Managing focus states
- Creating inclusive user experiences

## WCAG 2.1/2.2 Principles (POUR)

**Perceivable:**
- Provide text alternatives for images
- Add captions for videos
- Ensure sufficient color contrast (4.5:1 for text)
- Don't rely on color alone to convey information
- Support text resizing up to 200%

**Operable:**
- All functionality available via keyboard
- No keyboard traps
- Provide enough time to read content
- Don't design content that causes seizures
- Help users navigate and find content
- Support pointer gestures (not just mouse)

**Understandable:**
- Make text readable and understandable
- Make content appear and operate in predictable ways
- Help users avoid and correct mistakes
- Use clear language and instructions

**Robust:**
- Maximize compatibility with current and future user agents
- Support assistive technologies
- Use valid, semantic HTML
- Proper ARIA implementation

## Semantic HTML

**Use Proper Elements:**
```html
<!-- Good -->
<button>Click me</button>
<a href="/page">Link</a>
<nav>
  <ul>
    <li><a href="/">Home</a></li>
  </ul>
</nav>
<main>
  <article>
    <h1>Title</h1>
    <p>Content</p>
  </article>
</main>

<!-- Bad -->
<div onclick="handleClick()">Click me</div>
<span onclick="navigate()">Link</span>
<div class="nav">...</div>
```

**Heading Hierarchy:**
```html
<h1>Main Title</h1>
<h2>Section</h2>
<h3>Subsection</h3>
<h3>Another Subsection</h3>
<h2>Next Section</h2>
```

**Landmarks:**
```html
<header>Site header</header>
<nav>Primary navigation</nav>
<main>Main content</main>
<aside>Sidebar</aside>
<footer>Site footer</footer>
```

## Keyboard Navigation

**Focus Management:**
```css
/* Visible focus indicators */
button:focus,
a:focus,
input:focus {
  outline: 2px solid #0066cc;
  outline-offset: 2px;
}

/* Don't remove focus outlines */
button:focus {
  outline: none; /* BAD */
}
```

**Tab Order:**
```html
<!-- Logical tab order -->
<button tabindex="0">First</button>
<button tabindex="0">Second</button>
<button tabindex="0">Third</button>

<!-- Avoid positive tabindex -->
<button tabindex="5">Bad</button>
<button tabindex="10">Worse</button>
```

**Skip Links:**
```html
<a href="#main" class="skip-link">Skip to main content</a>

<style>
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: #000;
  color: #fff;
  padding: 8px;
  z-index: 100;
}

.skip-link:focus {
  top: 0;
}
</style>

<main id="main">
  <!-- Content -->
</main>
```

**Keyboard Event Handling:**
```javascript
// Support Enter and Space for custom buttons
element.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    handleClick();
  }
});

// Arrow keys for menus/toolbars
element.addEventListener('keydown', (e) => {
  switch(e.key) {
    case 'ArrowLeft':
      focusPrevious();
      break;
    case 'ArrowRight':
      focusNext();
      break;
    case 'Escape':
      closeMenu();
      break;
  }
});
```

## ARIA Attributes

**When to Use ARIA:**
- Custom widgets (tabs, accordions, modals)
- Dynamic content updates
- Complex UI patterns
- When semantic HTML isn't enough

**Don't Use ARIA When:**
- Semantic HTML element exists
- It duplicates native semantics
- You're not sure what it does

**Common ARIA Patterns:**

**Modal Dialog:**
```html
<div role="dialog" aria-labelledby="dialog-title" aria-modal="true">
  <h2 id="dialog-title">Confirm Action</h2>
  <p>Are you sure you want to proceed?</p>
  <button>Cancel</button>
  <button>Confirm</button>
</div>
```

**Tabs:**
```html
<div role="tablist">
  <button role="tab" aria-selected="true" aria-controls="panel-1">Tab 1</button>
  <button role="tab" aria-selected="false" aria-controls="panel-2">Tab 2</button>
</div>
<div role="tabpanel" id="panel-1">
  Content 1
</div>
<div role="tabpanel" id="panel-2" hidden>
  Content 2
</div>
```

**Live Regions:**
```html
<!-- Announce dynamic updates -->
<div aria-live="polite" aria-atomic="true">
  {{ statusMessage }}
</div>

<!-- Assertive for important updates -->
<div aria-live="assertive">
  {{ errorMessage }}
</div>
```

**Progress Indicators:**
```html
<div role="progressbar" 
     aria-valuenow="75" 
     aria-valuemin="0" 
     aria-valuemax="100"
     aria-label="Upload progress">
  75%
</div>
```

## Accessible Forms

**Labels:**
```html
<!-- Good -->
<label for="email">Email</label>
<input type="email" id="email" name="email">

<!-- Also good (implicit) -->
<label>
  Email
  <input type="email" name="email">
</label>

<!-- Bad -->
<input type="email" placeholder="Email">
```

**Error Messages:**
```html
<label for="password">Password</label>
<input type="password" 
       id="password" 
       aria-invalid="true"
       aria-describedby="password-error">
<span id="password-error" class="error">
  Password must be at least 8 characters
</span>
```

**Required Fields:**
```html
<label for="name">
  Name <span aria-hidden="true">*</span>
  <span class="sr-only">(required)</span>
</label>
<input type="text" id="name" required aria-required="true">
```

**Fieldsets for Related Inputs:**
```html
<fieldset>
  <legend>Shipping Address</legend>
  <label for="street">Street</label>
  <input type="text" id="street">
  
  <label for="city">City</label>
  <input type="text" id="city">
</fieldset>
```

## Color and Contrast

**Contrast Ratios:**
- Normal text: 4.5:1 minimum (WCAG AA)
- Large text (18pt+ or 14pt+ bold): 3:1 minimum
- Enhanced (WCAG AAA): 7:1 for normal text

**Testing Tools:**
```bash
# Check contrast with axe
npx axe-core-cli https://example.com

# Lighthouse audit
lighthouse https://example.com --view
```

**Don't Rely on Color Alone:**
```html
<!-- Bad -->
<span style="color: red">Error</span>

<!-- Good -->
<span style="color: red" role="alert">
  <svg aria-hidden="true">...</svg>
  Error: Invalid email format
</span>
```

## Screen Reader Optimization

**Hidden Content:**
```html
<!-- Visually hidden but accessible to screen readers -->
<span class="sr-only">This text is for screen readers only</span>

<style>
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>

<!-- Hide from screen readers -->
<span aria-hidden="true">Decorative icon</span>
```

**Alt Text:**
```html
<!-- Informative images -->
<img src="chart.png" alt="Sales increased 25% in Q4 2024">

<!-- Decorative images -->
<img src="decorative-line.png" alt="" role="presentation">

<!-- Complex images -->
<img src="infographic.png" alt="Company growth infographic">
<details>
  <summary>Text description</summary>
  <p>Detailed description of the infographic...</p>
</details>
```

**Icon Buttons:**
```html
<!-- Good -->
<button aria-label="Close dialog">
  <svg aria-hidden="true">...</svg>
</button>

<!-- Also good -->
<button>
  <svg aria-hidden="true">...</svg>
  <span class="sr-only">Close dialog</span>
</button>

<!-- Bad -->
<button>
  <svg>...</svg>
</button>
```

## Focus Management

**Modal Focus Trap:**
```javascript
function trapFocus(modal) {
  const focusableElements = modal.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const firstFocusable = focusableElements[0];
  const lastFocusable = focusableElements[focusableElements.length - 1];

  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable.focus();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable.focus();
        }
      }
    }
  });
}
```

**Return Focus:**
```javascript
let lastFocusedElement;

function openModal() {
  lastFocusedElement = document.activeElement;
  modal.focus();
}

function closeModal() {
  modal.hide();
  lastFocusedElement.focus();
}
```

## Testing Accessibility

**Automated Testing:**
```bash
# axe-core
npm install @axe-core/playwright

# Example test
test('page is accessible', async () => {
  const results = await axe.run(page);
  expect(results.violations).toHaveLength(0);
});
```

**Manual Testing Checklist:**
- [ ] Navigate entire site with keyboard only
- [ ] Test with screen reader (VoiceOver, NVDA, JAWS)
- [ ] Check color contrast
- [ ] Zoom to 200% and verify layout
- [ ] Disable CSS and verify content order
- [ ] Test with high contrast mode
- [ ] Check focus indicators are visible
- [ ] Verify all images have alt text
- [ ] Test forms without mouse
- [ ] Check for keyboard traps

**Browser Extensions:**
- axe DevTools
- Lighthouse
- WAVE Evaluation Tool
- Color Contrast Analyzer

## Common Patterns

**Accordion:**
```html
<div class="accordion">
  <h3>
    <button aria-expanded="false" aria-controls="panel-1">
      Section 1
    </button>
  </h3>
  <div id="panel-1" role="region" hidden>
    Content 1
  </div>
</div>
```

**Dropdown Menu:**
```html
<button aria-haspopup="true" aria-expanded="false">
  Menu
</button>
<ul role="menu" hidden>
  <li role="menuitem">Item 1</li>
  <li role="menuitem">Item 2</li>
</ul>
```

**Tooltip:**
```html
<button aria-describedby="tooltip-1">
  Help
</button>
<span id="tooltip-1" role="tooltip" hidden>
  Click for more information
</span>
```

## Resources

- WCAG 2.1: https://www.w3.org/WAI/WCAG21/quickref/
- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- ARIA Authoring Practices: https://www.w3.org/WAI/ARIA/apg/
- WebAIM: https://webaim.org/
- Inclusive Components: https://inclusive-components.design/
- A11y Project: https://www.a11yproject.com/
- MDN Accessibility: https://developer.mozilla.org/en-US/docs/Web/Accessibility
