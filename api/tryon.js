const fetch = require('node-fetch');
const { Client } = require('@gradio/client');

let clientInstance = null;

async function getClient() {
  if (!clientInstance) {
    clientInstance = await Client.connect("yisol/IDM-VTON", {
      hf_token: process.env.HF_TOKEN || undefined
    });
  }
  return clientInstance;
}

function base64ToBlob(base64Str) {
  const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  const type = matches[1];
  const buffer = Buffer.from(matches[2], 'base64');
  return new Blob([buffer], { type });
}

async function urlToBlob(url) {
  const res = await fetch(url);
  const arrayBuffer = await res.arrayBuffer();
  const contentType = res.headers.get('content-type') || 'image/jpeg';
  return new Blob([arrayBuffer], { type: contentType });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { userPhotoBase64, garmentImageUrl } = req.body;
    if (!userPhotoBase64 || !garmentImageUrl) {
      return res.status(400).json({ error: 'Missing photos' });
    }

    const client = await getClient();
    const humanBlob = base64ToBlob(userPhotoBase64);
    const garmentBlob = await urlToBlob(garmentImageUrl);

    const result = await client.predict("/tryon", {
      dict: { background: humanBlob, layers: [], composite: null },
      garm_img: garmentBlob,
      garment_des: "fur coat",
      is_checked: true,
      is_checked_crop: false,
      denoise_steps: 30,
      seed: 42
    });

    const outputData = result.data ? result.data[0] : null;
    const finalUrl = typeof outputData === 'object' ? outputData?.url : outputData;

    return res.status(200).json({ success: true, resultUrl: finalUrl });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
