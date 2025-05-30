const fetch   = require('node-fetch');
const FormData = require('form-data');
const Busboy  = require('busboy');

// 1) Define your CORS headers once
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'OPTIONS, POST',
  'Access-Control-Allow-Headers': 'Content-Type'
};

exports.handler = async (event) => {
  // 2) Short-circuit OPTIONS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: CORS,
      body: ''
    };
  }

  // 3) Reject anything that isn’t POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        ...CORS,
        Allow: 'OPTIONS, POST'      // tell the client what’s allowed
      },
      body: 'Method Not Allowed'
    };
  }

  // 4) Your existing POST-handling code goes here…
  try {
    // parse with Busboy, create ticket, upload attachment, etc.

    // 5) On success, include CORS in the response
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ message: 'Ticket created successfully!' })
    };
  } catch (error) {
    // 6) On error, also include CORS
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ message: 'Unexpected server error' })
    };
  }
};
