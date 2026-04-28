import crypto from "crypto";
import fetch from "node-fetch";

const VIPPS_BASE_URL = "https://api.vippsmobilepay.com";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "https://www.rett-fram.no");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

async function getAccessToken() {
  const response = await fetch(`${VIPPS_BASE_URL}/accesstoken/get`, {
    method: "POST",
    headers: {
      client_id: process.env.VIPPS_CLIENT_ID,
      client_secret: process.env.VIPPS_CLIENT_SECRET,
      "Ocp-Apim-Subscription-Key": process.env.VIPPS_SUBSCRIPTION_KEY
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error("Token-feil: " + JSON.stringify(data));
  }

  return data.access_token;
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Kun POST er tillatt" });
  }

  try {
    const { amount } = req.body || {};

    if (!amount) {
      return res.status(400).json({ error: "Mangler beløp" });
    }

    const accessToken = await getAccessToken();

    const payload = {
      interval: {
        unit: "MONTH",
        count: 1
      },
      merchantRedirectUrl: "https://www.rett-fram.no/takk",
      merchantAgreementUrl: "https://www.rett-fram.no",
      productName: "Månedlig gave til Rett Fram",
      productDescription: "Fast månedlig gave til Rett Fram Opplevelser",
      currency: "NOK",
      price: amount,
      externalId: crypto.randomUUID()
    };

    const vippsResponse = await fetch(`${VIPPS_BASE_URL}/recurring/v3/agreements`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Ocp-Apim-Subscription-Key": process.env.VIPPS_SUBSCRIPTION_KEY,
        "Merchant-Serial-Number": process.env.VIPPS_MSN,
        "Idempotency-Key": crypto.randomUUID(),
        "Content-Type": "application/json",
        "Vipps-System-Name": "rett-fram",
        "Vipps-System-Version": "1.0.0",
        "Vipps-System-Plugin-Name": "custom",
        "Vipps-System-Plugin-Version": "1.0.0"
      },
      body: JSON.stringify(payload)
    });

    const vippsData = await vippsResponse.json();

    if (!vippsResponse.ok) {
      return res.status(400).json({
        error: "Vipps-feil",
        details: vippsData
      });
    }

    return res.status(200).json({
      url: vippsData.vippsConfirmationUrl,
      vippsData
    });
  } catch (error) {
    return res.status(500).json({
      error: "Backend-feil",
      details: error.message
    });
  }
}
