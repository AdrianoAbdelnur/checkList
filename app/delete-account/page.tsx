import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Delete Account | DigiCheck",
  description: "Request deletion of your DigiCheck account and associated data.",
};

export default function DeleteAccountPage() {
  return (
    <main
      style={{
        maxWidth: "760px",
        margin: "0 auto",
        padding: "48px 16px",
        fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
        lineHeight: 1.6,
        color: "#111827",
      }}
    >
      <h1 style={{ margin: "0 0 24px", fontSize: "2rem", lineHeight: 1.2 }}>
        Delete Account - DigiCheck
      </h1>

      <p>
        To request deletion of your DigiCheck account and associated data,
        please contact us at:
      </p>

      <p>
        <a href="mailto:adrianoabdelnur08@gmail.com">
          adrianoabdelnur08@gmail.com
        </a>
      </p>

      <p>Include the email address associated with your account.</p>

      <p>
        We will process the request within a reasonable period. Some data may be
        retained when required for legal, security, operational, or compliance
        purposes.
      </p>
    </main>
  );
}
