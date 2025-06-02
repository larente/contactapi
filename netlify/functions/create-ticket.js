const fetch = require('node-fetch');
const FormData = require('form-data');
const { IncomingForm } = require('formidable');
const fs = require('fs');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'OPTIONS, POST',
  'Access-Control-Allow-Headers': 'Content-Type'
};

exports.handler = async (event, context) => {
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

  // Parse form data using formidable
  const form = new IncomingForm({ multiples: false, keepExtensions: true, uploadDir: '/tmp' });

  const parsed = await new Promise((resolve, reject) => {
    // Netlify sends event.body as base64, so we convert it
    form.parse({
      headers: event.headers,
      method: event.httpMethod,
      url: '',
      body: Buffer.from(event.body, 'base64'),
      on: () => {}
    }, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });

  const { fields, files } = parsed;

  try {
    const FRESHDESK_API_KEY = process.env.FRESHDESK_API_KEY;
    const FRESHDESK_DOMAIN = process.env.FRESHDESK_DOMAIN;

    // Step 1: Create the ticket
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

    const ticketRes = await fetch(`https://${FRESHDESK_DOMAIN}.freshdesk.com/api/v2/tickets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${FRESHDESK_API_KEY}:X`).toString('base64')}`
      },
      body: JSON.stringify(ticketPayload)
    });

    const ticketData = await ticketRes.json();
    if (!ticketRes.ok) {
      throw new Error(`Ticket creation failed: ${JSON.stringify(ticketData)}`);
    }

    // Step 2: Upload file if one exists
    if (files.attachment && files.attachment.filepath) {
      const file = files.attachment;
      const formData = new FormData();
      formData.append('attachments[]', fs.createReadStream(file.filepath), file.originalFilename);

      const attachRes = await fetch(
        `https://${FRESHDESK_DOMAIN}.freshdesk.com/api/v2/tickets/${ticketData.id}/attachments`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${Buffer.from(`${FRESHDESK_API_KEY}:X`).toString('base64')}`,
            ...formData.getHeaders()
          },
          body: formData
        }
      );

      if (!attachRes.ok) {
        const text = await attachRes.text();
        throw new Error(`Attachment upload failed: ${text}`);
      }
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ message: 'Ticket created successfully!', ticket: ticketData })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ message: 'Unexpected server error', error: error.message })
    };
  }
};
