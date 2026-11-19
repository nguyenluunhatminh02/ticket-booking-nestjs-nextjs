import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || "http://localhost:3001";

/**
 * PayOS Webhook proxy — forwards the raw body to the Spring Boot backend
 * for HMAC-SHA256 checksum verification and payment processing.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();

    const backendRes = await fetch(
      `${BACKEND_URL}/api/v1/payments/webhook/payos`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body,
      }
    );

    const status = backendRes.status;
    if (status >= 200 && status < 300) {
      return NextResponse.json({ status: "ok" }, { status: 200 });
    }

    const errorText = await backendRes.text().catch(() => "Unknown error");
    console.error(`[PayOS Webhook] Backend returned ${status}: ${errorText}`);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status }
    );
  } catch (error) {
    console.error("[PayOS Webhook] Proxy error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
