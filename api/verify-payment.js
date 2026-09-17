// api/verify-payment.js
// Vercel Serverless Function — runs on Vercel's servers, hidden from users.

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { reference, expectedAmount } = req.body;

  if (!reference || !expectedAmount) {
    return res.status(400).json({ error: 'Missing reference or expectedAmount' });
  }

  // Secret key is read from Vercel Environment Variables — NEVER visible to browser
  const SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

  if (!SECRET_KEY) {
    return res.status(500).json({ error: 'Server misconfigured: missing key' });
  }

  try {
    // Verify the transaction directly with Paystack using the SECRET key
    const paystackRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await paystackRes.json();

    // Paystack returns status: true and data.status: "success" for valid payments
    if (!data.status || data.data.status !== 'success') {
      return res.status(400).json({
        success: false,
        error: 'Payment not successful',
        details: data.data?.gateway_response || 'Unknown',
      });
    }

    const paidAmount = data.data.amount; // amount in kobo
    const expectedKobo = Number(expectedAmount) * 100;

    // Confirm the amount paid matches what we expected
    if (paidAmount < expectedKobo) {
      return res.status(400).json({
        success: false,
        error: 'Amount mismatch',
        paid: paidAmount / 100,
        expected: expectedAmount,
      });
    }

    // ✅ Payment is valid. Return success to the frontend.
    return res.status(200).json({
      success: true,
      reference: data.data.reference,
      amount: paidAmount / 100,
      email: data.data.customer.email,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Verification failed', details: err.message });
  }
}
