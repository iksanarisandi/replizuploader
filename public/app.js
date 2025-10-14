// Login/Register page functionality

const authForm = document.getElementById('auth-form');
const loginBtn = document.getElementById('login-btn');
const registerBtn = document.getElementById('register-btn');
const errorMessage = document.getElementById('error-message');
const loading = document.getElementById('loading');

let isLoginMode = true;

// Handle login button click
loginBtn.addEventListener('click', (e) => {
  e.preventDefault();
  isLoginMode = true;
  loginBtn.classList.add('btn-primary');
  loginBtn.classList.remove('btn-secondary');
  registerBtn.classList.add('btn-secondary');
  registerBtn.classList.remove('btn-primary');
  // Submit form immediately
  authForm.dispatchEvent(new Event('submit'));
});

// Handle register button click
registerBtn.addEventListener('click', (e) => {
  e.preventDefault();
  isLoginMode = false;
  registerBtn.classList.add('btn-primary');
  registerBtn.classList.remove('btn-secondary');
  loginBtn.classList.add('btn-secondary');
  loginBtn.classList.remove('btn-primary');
  // Submit form immediately
  authForm.dispatchEvent(new Event('submit'));
});

// Handle form submission
authForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  // Hide error message
  errorMessage.classList.add('hidden');

  // Show loading
  authForm.classList.add('hidden');
  loading.classList.remove('hidden');

  try {
    const endpoint = isLoginMode ? '/api/login' : '/api/register';
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Authentication failed');
    }

    // Success - redirect to dashboard
    window.location.href = '/dashboard.html';
  } catch (error) {
    // Show error
    errorMessage.textContent = error.message;
    errorMessage.classList.remove('hidden');
    authForm.classList.remove('hidden');
    loading.classList.add('hidden');
  }
});
