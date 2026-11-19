import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SocialLoginButtons } from "@/components/auth/social-login-buttons";

// Mock window.location
const mockLocation = {
  href: "",
};

describe("SocialLoginButtons", () => {
  beforeEach(() => {
    Object.defineProperty(window, "location", {
      value: mockLocation,
      writable: true,
    });
    mockLocation.href = "";
  });

  it("should render three social login buttons", () => {
    render(<SocialLoginButtons />);

    expect(screen.getByText("Google")).toBeTruthy();
    expect(screen.getByText("GitHub")).toBeTruthy();
    expect(screen.queryByText("Microsoft")).toBeNull();
  });

  it("should redirect to Google OAuth on click", () => {
    render(<SocialLoginButtons />);
    fireEvent.click(screen.getByText("Google"));
    expect(mockLocation.href).toContain("/oauth2/authorize/google");
  });

  it("should redirect to GitHub OAuth on click", () => {
    render(<SocialLoginButtons />);
    fireEvent.click(screen.getByText("GitHub"));
    expect(mockLocation.href).toContain("/oauth2/authorize/github");
  });

  it("should render exactly two providers", () => {
    render(<SocialLoginButtons />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(2);
  });

  it("should render buttons with type='button' to prevent form submission", () => {
    render(<SocialLoginButtons />);
    const buttons = screen.getAllByRole("button");
    buttons.forEach((button) => {
      expect(button.getAttribute("type")).toBe("button");
    });
  });

  it("should expose accessible labels", () => {
    render(<SocialLoginButtons />);
    expect(screen.getByLabelText("Sign in with Google")).toBeTruthy();
    expect(screen.getByLabelText("Sign in with GitHub")).toBeTruthy();
  });
});
