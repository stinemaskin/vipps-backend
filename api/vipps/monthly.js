import crypto from "crypto";

const VIPPS_BASE_URL = "https://api.vippsmobilepay.com";

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
    throw new Error(JSON.stringify(data));
  }

  return data.access_token;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Kun POST" });
  }

  try {
    const { amount } = req.body;

    const accessToken = await getAccessToken();

    const payload = {
      interval: { unit: "MONTH", count: 1 },
      merchantRedirectUrl: "https://www.rett-fram.no/takk",
      merchantAgreementUrl: "https://www.rett-fram.no",
      productName: "Månedlig gave",
      productDescription: "Støtt Rett Fram",
      currency: "NOK",
      price: amount,
      externalId: crypto.randomUUID()
    };

    const vippsRes = await fetch(`${VIPPS_BASE_URL}/recurring/v3/agreements`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Ocp-Apim-Subscription-Key": process.env.VIPPS_SUBSCRIPTION_KEY,
        "Merchant-Serial-Number": process.env.VIPPS_MSN,
        "Idempotency-Key": crypto.randomUUID(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await vippsRes.json();

    return res.status(200).json({
      url: data.vippsConfirmationUrl
    });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
