const fetch = require('node-fetch');
const Busboy = require('busboy');

// CORS headers
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'OPTIONS, POST',
  'Access-Control-Allow-Headers': 'Content-Type'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: CORS,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { ...CORS, Allow: 'OPTIONS, POST' },
      body: 'Method Not Allowed'
    };
  }

  // Parsing multipart form data with Busboy
  const contentType = event.headers['content-type'];
  const busboy = Busboy({ headers: { 'content-type': contentType } });

  const fields = {};
  const files = [];

  const busboyPromise = new Promise((resolve, reject) => {
    busboy.on('field', (fieldname, val) => {
      fields[fieldname] = val;
    });

    busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
      let buffer = Buffer.alloc(0);
      file.on('data', (data) => {
        buffer = Buffer.concat([buffer, data]);
      });
      file.on('end', () => {
        files.push({ fieldname, filename, buffer, encoding, mimetype });
      });
    });

    busboy.on('error', (error) => reject(error));
    busboy.on('finish', () => resolve());
    
    busboy.end(Buffer.from(event.body, 'base64'));
  });

  try {
    await busboyPromise;

    // Prepare your Freshdesk payload
    const FRESHDESK_API_KEY = process.env.FRESHDESK_API_KEY;
    const FRESHDESK_DOMAIN = process.env.FRESHDESK_DOMAIN;

    const ticketPayload = {
      description: fields.description || 'No description provided',
      subject: fields.subject || 'New Ticket',
      email: fields.email,
      status: 2,
      priority: 1,
    };

    const freshdeskResponse = await fetch(`https://${FRESHDESK_DOMAIN}.freshdesk.com/api/v2/tickets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${FRESHDESK_API_KEY}:X`).toString('base64')}`,
      },
      body: JSON.stringify(ticketPayload),
    });

    const freshdeskData = await freshdeskResponse.json();

    if (!freshdeskResponse.ok) {
      throw new Error(freshdeskData.message || 'Error creating Freshdesk ticket.');
    }

    // Return success
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ message: 'Ticket created successfully!', ticket: freshdeskData }),
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ message: 'Unexpected server error', error: error.message }),
    };
  }
};
