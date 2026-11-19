import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || "http://localhost:3001";

/**
 * Stripe Webhook proxy — forwards the raw body + Stripe-Signature header
 * to the Spring Boot backend for signature verification.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const stripeSignature = request.headers.get("stripe-signature") || "";

    const backendRes = await fetch(
      `${BACKEND_URL}/api/v1/payments/webhook/stripe`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Stripe-Signature": stripeSignature,
        },
        body,
      }
    );

    const status = backendRes.status;
    if (status >= 200 && status < 300) {
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const errorText = await backendRes.text().catch(() => "Unknown error");
    console.error(`[Stripe Webhook] Backend returned ${status}: ${errorText}`);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status }
    );
  } catch (error) {
    console.error("[Stripe Webhook] Proxy error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
