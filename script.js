document
  .querySelector('form#contact-us')
  .addEventListener('submit', async e => {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);

    try {
      const res = await fetch(
        'https://fabulous-puppy-0af4eb.netlify.app/.netlify/functions/create-ticket',
        {
          method: 'POST',
          mode: 'cors',
          body: formData
        }
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Server returned ${res.status}: ${text}`);
      }

      const json = await res.json();
      console.log('Success:', json.message);

      // ✅ Show message and reset form
      const messageEl = document.getElementById('form-message');
      if (messageEl) {
        messageEl.textContent = 'Form Submitted';
        messageEl.style.display = 'block';
        setTimeout(() => {
          messageEl.style.display = 'none';
        }, 5000); // hide after 5 seconds
      }

      form.reset();

    } catch (err) {
      console.error('Submit error:', err);
    }
  });
