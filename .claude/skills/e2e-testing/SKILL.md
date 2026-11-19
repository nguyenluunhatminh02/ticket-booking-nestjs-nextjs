---
name: e2e-testing
description: End-to-end testing using MCP Playwright integration for browser automation, visual testing, and user workflow validation. Use when testing web applications, validating user journeys, capturing screenshots, or automating browser interactions.
license: MIT
version: 1.0.0
trigger: When implementing E2E tests, validating user workflows, testing web applications, or automating browser interactions.
---

# E2E Testing with MCP Playwright

Automate browser testing and validation using the Playwright MCP server integration.

## When to Use

- Testing web application user interfaces
- Validating complete user workflows
- Capturing screenshots for visual regression
- Automating form submissions and interactions
- Testing responsive design across viewports
- Debugging UI issues in real browsers
- Validating accessibility and performance

## Available Tools

The Playwright MCP server provides these tools:

### Navigation
- `browser_navigate` - Navigate to a URL
- `browser_navigate_back` - Go back to previous page
- `browser_tabs` - Manage browser tabs

### Interaction
- `browser_click` - Click on elements
- `browser_hover` - Hover over elements
- `browser_drag` - Drag elements
- `browser_drop` - Drop elements
- `browser_type` - Type text into inputs
- `browser_fill_form` - Fill form fields
- `browser_select_option` - Select dropdown options
- `browser_press_key` - Press keyboard keys
- `browser_file_upload` - Upload files

### Inspection
- `browser_snapshot` - Get accessibility tree snapshot
- `browser_take_screenshot` - Capture page screenshot
- `browser_find` - Find elements on page
- `browser_evaluate` - Execute JavaScript in browser context

### State & Debugging
- `browser_console_messages` - Get console logs
- `browser_network_requests` - Monitor network activity
- `browser_handle_dialog` - Handle alert/confirm/prompt dialogs
- `browser_wait_for` - Wait for conditions

### Browser Control
- `browser_resize` - Change viewport size
- `browser_emulate_media` - Emulate media types (print, screen)
- `browser_close` - Close browser

## Common Patterns

### Basic Navigation and Screenshot
```
1. browser_navigate(url: "https://example.com")
2. browser_take_screenshot(path: "screenshot.png")
3. browser_snapshot() // Get page structure
```

### Form Submission
```
1. browser_navigate(url: "https://example.com/login")
2. browser_fill_form(fields: [{selector: "#email", value: "user@example.com"}, {selector: "#password", value: "password123"}])
3. browser_click(selector: "button[type='submit']")
4. browser_wait_for(selector: ".dashboard")
5. browser_take_screenshot(path: "after-login.png")
```

### Testing User Workflow
```
1. browser_navigate(url: "http://localhost:3000")
2. browser_click(selector: "a[href='/products']")
3. browser_wait_for(selector: ".product-list")
4. browser_click(selector: ".product-card:first-child")
5. browser_click(selector: "button.add-to-cart")
6. browser_click(selector: ".cart-icon")
7. browser_snapshot() // Verify cart contents
```

### Responsive Testing
```
1. browser_resize(width: 375, height: 667) // iPhone SE
2. browser_navigate(url: "https://example.com")
3. browser_take_screenshot(path: "mobile.png")
4. browser_resize(width: 1920, height: 1080) // Desktop
5. browser_take_screenshot(path: "desktop.png")
```

### Network Monitoring
```
1. browser_navigate(url: "https://example.com")
2. browser_network_requests() // Check API calls
3. browser_console_messages() // Check for errors
```

## Best Practices

### Test Isolation
- Start each test with `browser_navigate` to a known state
- Clear cookies/storage between tests if needed
- Use unique test data to avoid conflicts

### Reliable Selectors
- Prefer data-testid attributes: `[data-testid="submit-button"]`
- Use role selectors: `role=button[name="Submit"]`
- Avoid brittle CSS selectors that change with styling

### Wait Strategies
- Use `browser_wait_for` instead of arbitrary delays
- Wait for specific elements or network idle
- Wait for animations to complete

### Error Handling
- Check `browser_console_messages` for JavaScript errors
- Monitor `browser_network_requests` for failed API calls
- Take screenshots on test failure for debugging

### Performance
- Close browser when done: `browser_close`
- Reuse browser sessions for related tests
- Parallelize independent test suites

## Debugging Techniques

### Visual Debugging
```
1. browser_take_screenshot(path: "debug.png")
2. browser_snapshot() // See accessibility tree
3. browser_evaluate(expression: "document.querySelector('.element').outerHTML")
```

### Network Debugging
```
1. browser_network_requests() // See all API calls
2. browser_console_messages() // Check logs and errors
```

### State Inspection
```
1. browser_evaluate(expression: "JSON.stringify(localStorage)")
2. browser_evaluate(expression: "document.cookie")
3. browser_snapshot() // Current page structure
```

## Integration with Testing Workflow

### Pre-Deployment Validation
```bash
# Run E2E tests before deployment
1. Start local server
2. browser_navigate(url: "http://localhost:3000")
3. Test critical user journeys
4. Capture screenshots for visual review
5. Check console for errors
```

### Visual Regression Testing
```
1. Capture baseline screenshots
2. Make UI changes
3. Capture new screenshots
4. Compare visually or use diff tools
```

### Accessibility Testing
```
1. browser_snapshot() // Get accessibility tree
2. Verify semantic structure
3. Check ARIA labels and roles
4. Test keyboard navigation with browser_press_key
```

## Troubleshooting

### Element Not Found
- Verify page has loaded: `browser_wait_for`
- Check selector syntax
- Use `browser_snapshot` to see available elements

### Timeout Issues
- Increase wait times for slow operations
- Check for network delays
- Verify element is actually interactable

### Flaky Tests
- Add explicit waits instead of implicit delays
- Ensure test data is isolated
- Check for race conditions in UI updates

## Resources

- Playwright Documentation: https://playwright.dev/
- MCP Playwright: https://github.com/anthropics/mcp-playwright
- Testing Best Practices: https://playwright.dev/docs/best-practices
