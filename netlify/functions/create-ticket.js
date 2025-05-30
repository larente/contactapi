const fetch = require('node-fetch');
const FormData = require('form-data');
// Busboy in CJS mode exports the constructor directly—no `.default`
const Busboy = require('busboy');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed',
    };
  }

  try {
    // Netlify will set isBase64Encoded=true for binary bodies
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64')
      : Buffer.from(event.body, 'utf8');

    return await new Promise((resolve, reject) => {
      const fields = {};
      let fileBuffer;
      let fileName;

      const busboy = new Busboy({ headers: event.headers });

      busboy.on('file', (fieldname, file, filename) => {
        fileName = filename;
        const chunks = [];
        file.on('data', chunk => chunks.push(chunk));
        file.on('end', () => {
          fileBuffer = Buffer.concat(chunks);
        });
      });

      busboy.on('field', (fieldname, val) => {
        fields[fieldname] = val;
      });

      busboy.on('error', err => {
        console.error('Busboy error:', err);
        reject(err);
      });

      busboy.on('finish', async () => {
        try {
          // 1) Create the ticket
          const ticketRes = await fetch(
            'https://markanthonysandbox.freshdesk.com/api/v2/tickets',
            {
              method: 'POST',
              headers: {
                Authorization:
                  'Basic ' +
                  Buffer.from(process.env.FRESHDESK_API_KEY + ':X').toString(
                    'base64'
                  ),
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                name: fields.name,
                email: fields.email,
                subject: fields.subject,
                description: fields.description,
              }),
            }
          );
          const ticket = await ticketRes.json();

          // 2) Upload attachment (if any)
          if (fileBuffer) {
            const uploadForm = new FormData();
            uploadForm.append('attachments[]', fileBuffer, fileName);

            await fetch(
              `https://markanthonysandbox.freshdesk.com/api/v2/tickets/${ticket.id}/attachments`,
              {
                method: 'POST',
                headers: {
                  Authorization:
                    'Basic ' +
                    Buffer.from(
                      process.env.FRESHDESK_API_KEY + ':X'
                    ).toString('base64'),
                  ...uploadForm.getHeaders(),
                },
                body: uploadForm,
              }
            );
          }

          resolve({
            statusCode: 200,
            body: JSON.stringify({ message: 'Ticket created successfully!' }),
          });
        } catch (error) {
          console.error('Ticket or attachment upload failed:', error);
          resolve({
            statusCode: 500,
            body: JSON.stringify({ message: 'Ticket creation failed' }),
          });
        }
      });

      busboy.end(raw);
    });
  } catch (err) {
    console.error('General function error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Unexpected server error' }),
    };
  }
};
