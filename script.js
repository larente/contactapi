document.getElementById('contact-form').addEventListener('submit', async function (e) {
  e.preventDefault();

  const form = e.target;
  const formData = new FormData(form);

  const response = await fetch('/.netlify/functions/create-ticket', {
    method: 'POST',
    body: formData,
  });

  const result = await response.json();
  alert(result.message || 'Submission complete');
  if (response.ok) form.reset();
});
