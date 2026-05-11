import crypto from "crypto";

const VIPPS_BASE_URL = "[api.vipps.no](https://api.vipps.no)";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "[rett-fram.no](https://www.rett-fram.no)");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

async function getAccessToken() {
  const response = await fetch(`${VIPPS_BASE_URL}/accesstoken/get`, {
    method: "POST",
    headers: {
      client_id: process.env.VIPPS_CLIENT_ID,
      client_secret: process.env.VIPPS_CLIENT_SECRET,
      "Ocp-Apim-Subscription-Key": process.env.VIPPS_SUBSCRIPTION_KEY,
      "Merchant-Serial-Number": process.env.VIPPS_MSN
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

    if (!amount || amount < 1000) {
      return res.status(400).json({ error: "Ugyldig beløp" });
    }

    const accessToken = await getAccessToken();

    const payload = {
      pricing: {
        type: "LEGACY",
        amount: amount,
        currency: "NOK"
      },
      campaign: {
        type: "PERIODIC",
        interval: {
          unit: "MONTH",
          count: 1
        }
      },
      merchantRedirectUrl: "[rett-fram.no](https://www.rett-fram.no/takk)",
      merchantAgreementUrl: "[rett-fram.no](https://www.rett-fram.no)",
      productName: "Månedlig gave til Rett Fram",
      productDescription: "Fast månedlig gave til Rett Fram",
      scope: "name phoneNumber email",
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
        "Vipps-System-Name": "rettfram",
        "Vipps-System-Version": "1.0.0",
        "Vipps-System-Plugin-Name": "custom",
        "Vipps-System-Plugin-Version": "1.0.0"
      },
      body: JSON.stringify(payload)
    });

    const rawVippsText = await vippsResponse.text();

    let vippsData;
    try {
      vippsData = JSON.parse(rawVippsText);
    } catch {
      vippsData = { raw: rawVippsText };
    }

    if (!vippsResponse.ok) {
      return res.status(400).json({
        error: "Vipps-feil",
        sentPayload: payload,
        details: vippsData
      });
    }

    const url =
      vippsData.vippsConfirmationUrl ||
      vippsData.confirmationUrl ||
      vippsData.redirectUrl ||
      vippsData.url;

    if (!url) {
      return res.status(500).json({
        error: "Fant ingen Vipps-url i svaret",
        vippsData
      });
    }

    return res.status(200).json({
      url,
      vippsData
    });
  } catch (error) {
    return res.status(500).json({
      error: "Backend-feil",
      details: error.message
    });
  }
}
