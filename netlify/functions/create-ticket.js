const fetch = require('node-fetch');
const FormData = require('form-data');
const Busboy = require('busboy').default;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed',
    };
  }

  try {
    const boundary = event.headers['content-type'].split('boundary=')[1];
    const raw = Buffer.from(event.body, 'base64');

    return await new Promise((resolve, reject) => {
      const fields = {};
      let fileBuffer;
      let fileName;

      const busboy = new Busboy({
        headers: {
          'content-type': event.headers['content-type']
        }
      });

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

      busboy.on('finish', async () => {
        try {
          // Step 1: Create ticket
          const ticketRes = await fetch('https://markanthonysandbox.freshdesk.com/api/v2/tickets', {
            method: 'POST',
            headers: {
              'Authorization': 'Basic ' + Buffer.from(process.env.FRESHDESK_API_KEY + ':X').toString('base64'),
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              name: fields.name,
              email: fields.email,
              subject: fields.subject,
              description: fields.description
            })
          });

          const ticket = await ticketRes.json();

          // Step 2: Upload attachment if present
          if (fileBuffer) {
            const uploadForm = new FormData();
            uploadForm.append('attachments[]', fileBuffer, fileName);

            await fetch(`https://markanthonysandbox.freshdesk.com/api/v2/tickets/${ticket.id}/attachments`, {
              method: 'POST',
              headers: {
                'Authorization': 'Basic ' + Buffer.from(process.env.FRESHDESK_API_KEY + ':X').toString('base64'),
                ...uploadForm.getHeaders()
              },
              body: uploadForm
            });
          }

          resolve({
            statusCode: 200,
            body: JSON.stringify({ message: 'Ticket created successfully!' })
          });
        } catch (error) {
          console.error('Ticket or attachment upload failed:', error);
          resolve({
            statusCode: 500,
            body: JSON.stringify({ message: 'Ticket creation failed' })
          });
        }
      });

      busboy.end(raw);
    });

  } catch (err) {
    console.error('General function error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Unexpected server error' })
    };
  }
};
