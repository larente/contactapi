const fetch = require('node-fetch');
const FormData = require('form-data');

exports.handler = async (event) => {
  try {
    const boundary = event.headers['content-type'].split('boundary=')[1];
    const raw = Buffer.from(event.body, 'base64');
    const Busboy = require('busboy');

    const busboy = new Busboy({
      headers: {
        'content-type': event.headers['content-type']
      }
    });

    return await new Promise((resolve, reject) => {
      const fields = {};
      let fileBuffer;
      let fileName;

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
        // Step 1: Create ticket
        const ticket = await fetch('https://markanthonysandbox.freshdesk.com/api/v2/tickets', {
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
        }).then(res => res.json());

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
      });

      busboy.end(raw);
    });
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error creating ticket' })
    };
  }
};
