import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || "http://localhost:3001";

/**
 * PayPal Webhook proxy — forwards the raw body + PayPal verification headers
 * to the Spring Boot backend for signature verification and event processing.
 *
 * PayPal sends these headers for verification:
 *  - paypal-transmission-id
 *  - paypal-transmission-time
 *  - paypal-transmission-sig
 *  - paypal-cert-url
 *  - paypal-auth-algo
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();

    // Forward all PayPal-specific headers
    const forwardHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const paypalHeaderKeys = [
      "paypal-transmission-id",
      "paypal-transmission-time",
      "paypal-transmission-sig",
      "paypal-cert-url",
      "paypal-auth-algo",
    ];
    for (const key of paypalHeaderKeys) {
      const value = request.headers.get(key);
      if (value) forwardHeaders[key] = value;
    }

    const backendRes = await fetch(
      `${BACKEND_URL}/api/v1/payments/webhook/paypal`,
      {
        method: "POST",
        headers: forwardHeaders,
        body,
      }
    );

    const status = backendRes.status;
    if (status >= 200 && status < 300) {
      return NextResponse.json({ status: "ok" }, { status: 200 });
    }

    const errorText = await backendRes.text().catch(() => "Unknown error");
    console.error(`[PayPal Webhook] Backend returned ${status}: ${errorText}`);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status }
    );
  } catch (error) {
    console.error("[PayPal Webhook] Proxy error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
