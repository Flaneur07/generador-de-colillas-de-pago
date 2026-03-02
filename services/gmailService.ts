// Global type definition for Google Identity Services
declare global {
  interface Window {
    google: any;
  }
}

let tokenClient: any;

// Initialize the Token Client. This must be called once (usually when the component mounts or button clicked first time)
export const initTokenClient = (clientId: string, callback: (token: string) => void) => {
  if (typeof window !== 'undefined' && window.google) {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/gmail.send',
      callback: (response: any) => {
        if (response.access_token) {
          callback(response.access_token);
        }
      },
    });
  } else {
    console.error("Google Identity Services script not loaded.");
  }
};

// Trigger the popup to ask for permission
export const requestAccessToken = () => {
  if (tokenClient) {
    tokenClient.requestAccessToken({ prompt: '' });
  } else {
    throw new Error("El sistema de Google no está inicializado. Verifica tu Client ID.");
  }
};

// Send email using Gmail REST API
export const sendGmail = async (token: string, to: string, subject: string, body: string, pdfBase64: string) => {
  const boundary = "foo_bar_baz"; // MIME boundary
  
  // Construct the Raw MIME message
  // It handles mixed content: Text Body + PDF Attachment
  const messageParts = [
    `To: ${to}`,
    "Subject: " + subject,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=\"UTF-8\"",
    "MIME-Version: 1.0",
    "Content-Transfer-Encoding: 7bit",
    "",
    body,
    "",
    `--${boundary}`,
    "Content-Type: application/pdf",
    "MIME-Version: 1.0",
    "Content-Transfer-Encoding: base64",
    "Content-Disposition: attachment; filename=\"Recibo_Pago.pdf\"",
    "",
    pdfBase64,
    "",
    `--${boundary}--`
  ];

  const message = messageParts.join("\r\n");

  // Encode to Base64Url (Required by Gmail API)
  const encodedMessage = btoa(unescape(encodeURIComponent(message)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      raw: encodedMessage
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Error desconocido al enviar el correo.');
  }

  return await response.json();
};