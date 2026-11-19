"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            padding: 32,
            textAlign: "center",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <h2 style={{ fontSize: 24, fontWeight: 700 }}>
            Application error
          </h2>
          <p style={{ fontSize: 14, color: "#666", maxWidth: 420 }}>
            A critical error occurred. Please try again.
            {error.digest ? ` (ref: ${error.digest})` : ""}
          </p>
          <button
            onClick={() => reset()}
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              border: "1px solid #ccc",
              background: "#111",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
