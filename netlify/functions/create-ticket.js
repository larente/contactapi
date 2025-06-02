const fetch = require('node-fetch');
const FormData = require('form-data');
const Busboy = require('busboy'); // ✅ works with v0.3.1

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'OPTIONS, POST',
  'Access-Control-Allow-Headers': 'Content-Type'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { ...CORS, Allow: 'OPTIONS, POST' },
      body: 'Method Not Allowed'
    };
  }

  const fields = {};
  let attachment = null;

  const busboy = new Busboy({ headers: { 'content-type': event.headers['content-type'] } });

  const parsePromise = new Promise((resolve, reject) => {
    busboy.on('field', (fieldname, value) => {
      fields[fieldname] = value;
    });

    busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
      const chunks = [];
      file.on('data', (data) => chunks.push(data));
      file.on('end', () => {
        attachment = {
          buffer: Buffer.concat(chunks),
          filename,
          mimetype
        };
      });
    });

    busboy.on('finish', resolve);
    busboy.on('error', reject);

    // Convert body from base64 to buffer
    busboy.end(Buffer.from(event.body, 'base64'));
  });

  try {
    await parsePromise;

    const FRESHDESK_API_KEY = process.env.FRESHDESK_API_KEY;
    const FRESHDESK_DOMAIN = process.env.FRESHDESK_DOMAIN;

    const ticketPayload = {
      description: fields.description,
      subject: fields.subject,
      email: fields.email,
      priority: 1,
      status: 2,
      type: fields.type,
      custom_fields: {
        cf_birthdate: fields.cf_birthdate
      }
    };

    const ticketResponse = await fetch(`https://${FRESHDESK_DOMAIN}.freshdesk.com/api/v2/tickets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${FRESHDESK_API_KEY}:X`).toString('base64')}`
      },
      body: JSON.stringify(ticketPayload)
    });

    const ticketData = await ticketResponse.json();

    if (!ticketResponse.ok) {
      throw new Error(`Freshdesk ticket creation failed: ${JSON.stringify(ticketData)}`);
    }

    // Step 2: upload attachment if present
   if (attachment && attachment.buffer && attachment.filename) {
  const formData = new FormData();
  formData.append('attachments[]', attachment.buffer, attachment.filename);

  const attachResponse = await fetch(
    `https://${FRESHDESK_DOMAIN}.freshdesk.com/api/v2/tickets/${ticketData.id}/attachments`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${FRESHDESK_API_KEY}:X`).toString('base64')}`,
        ...formData.getHeaders() // ✅ sets Content-Type + boundary properly
      },
      body: formData
    }
  );

  if (!attachResponse.ok) {
    const attachError = await attachResponse.text();
    throw new Error(`Attachment upload failed: ${attachError}`);
  }
}

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ message: 'Ticket and attachment created successfully!', ticket: ticketData })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ message: 'Unexpected server error', error: error.message })
    };
  }
};
