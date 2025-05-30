// script.js

document
  .querySelector('form#contact-us')
  .addEventListener('submit', async e => {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);

    try {
      const res = await fetch('/.netlify/functions/create-ticket', {
        method: 'POST',      // <-- must be POST
        body: formData        // <-- must send the form data
      });

      // if it’s an error status, grab the text and throw
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Server returned ${res.status}: ${text}`);
      }

      // otherwise parse JSON (your function returns JSON on 200)
      const json = await res.json();
      console.log('Success:', json.message);

    } catch (err) {
      console.error('Submit error:', err);
    }
  });
