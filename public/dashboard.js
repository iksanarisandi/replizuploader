// Dashboard functionality

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
let availablePlatforms = [];

// Logout
document.getElementById('logout-btn').addEventListener('click', async () => {
  try {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/';
  } catch (error) {
    console.error('Logout error:', error);
    window.location.href = '/';
  }
});

// Save Keys Form
const keysForm = document.getElementById('keys-form');
const keysMessage = document.getElementById('keys-message');

keysForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const accessKey = document.getElementById('access-key').value;
  const secretKey = document.getElementById('secret-key').value;

  keysMessage.classList.add('hidden');

  try {
    const response = await fetch('/api/save-keys', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ accessKey, secretKey }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to save keys');
    }

    // Success
    keysMessage.textContent = 'Keys saved successfully!';
    keysMessage.classList.remove('error-message', 'info-message');
    keysMessage.classList.add('success-message');
    keysMessage.classList.remove('hidden');

    // Clear form
    keysForm.reset();
  } catch (error) {
    keysMessage.textContent = error.message;
    keysMessage.classList.remove('success-message', 'info-message');
    keysMessage.classList.add('error-message');
    keysMessage.classList.remove('hidden');
  }
});

// Fetch available platforms on page load
async function fetchPlatforms() {
  try {
    console.log('Fetching platforms...');
    const response = await fetch('/api/platforms');
    console.log('Platforms response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('Platforms data:', data);
      availablePlatforms = data.platforms || [];
      console.log('Available platforms:', availablePlatforms);
      renderPlatformCheckboxes();
    } else {
      const errorText = await response.text();
      console.error('Failed to fetch platforms:', response.status, errorText);
      document.getElementById('platforms-selection').innerHTML = 
        '<small style="color: #d32f2f;">Failed to load platforms: ' + errorText + '</small>';
    }
  } catch (error) {
    console.error('Failed to fetch platforms:', error);
    document.getElementById('platforms-selection').innerHTML = 
      '<small style="color: #d32f2f;">Failed to load platforms. Error: ' + error.message + '</small>';
  }
}

function renderPlatformCheckboxes() {
  const container = document.getElementById('platforms-selection');
  
  if (availablePlatforms.length === 0) {
    container.innerHTML = '<small style="color: #666;">No platforms available</small>';
    return;
  }
  
  container.innerHTML = '';
  const checkboxes = availablePlatforms.map((platform, index) => {
    const label = document.createElement('label');
    label.style.display = 'block';
    label.style.marginBottom = '8px';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.name = 'platform';
    checkbox.value = platform.type;
    checkbox.checked = true;
    checkbox.id = `platform-${platform.type}`;
    
    const icon = getPlatformIcon(platform.type);
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(` ${icon} ${platform.name} (${platform.type})`));
    
    return label;
  });
  
  checkboxes.forEach(cb => container.appendChild(cb));
}

function getPlatformIcon(type) {
  const icons = {
    'facebook': '📘',
    'instagram': '📷',
    'tiktok': '🎵',
    'youtube': '📺',
    'threads': '🧵',
    'twitter': '🐦',
    'linkedin': '💼'
  };
  return icons[type] || '📱';
}

// Upload Form
const uploadForm = document.getElementById('upload-form');
const uploadMessage = document.getElementById('upload-message');
const uploadProgress = document.getElementById('upload-progress');
const uploadResults = document.getElementById('upload-results');
const resultsList = document.getElementById('results-list');
const progressText = document.getElementById('progress-text');
const videoFileInput = document.getElementById('video-file');
const fileInfo = document.getElementById('file-info');
const uploadBtn = document.getElementById('upload-btn');

// Initialize platforms on load
fetchPlatforms();

// File input validation
videoFileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) {
    fileInfo.textContent = '';
    return;
  }

  const sizeMB = (file.size / 1024 / 1024).toFixed(2);
  
  if (file.size > MAX_FILE_SIZE) {
    fileInfo.textContent = `❌ File too large: ${sizeMB}MB (max 50MB)`;
    fileInfo.style.color = '#d32f2f';
    uploadBtn.disabled = true;
  } else {
    fileInfo.textContent = `✓ ${file.name} (${sizeMB}MB)`;
    fileInfo.style.color = '#2e7d32';
    uploadBtn.disabled = false;
  }
});

uploadForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const videoFile = videoFileInput.files[0];
  const title = document.getElementById('title').value;
  const description = document.getElementById('description').value;

  if (!videoFile) {
    uploadMessage.textContent = 'Please select a video file';
    uploadMessage.classList.remove('success-message', 'info-message');
    uploadMessage.classList.add('error-message');
    uploadMessage.classList.remove('hidden');
    return;
  }

  if (videoFile.size > MAX_FILE_SIZE) {
    uploadMessage.textContent = 'File size exceeds 50MB limit';
    uploadMessage.classList.remove('success-message', 'info-message');
    uploadMessage.classList.add('error-message');
    uploadMessage.classList.remove('hidden');
    return;
  }

  // Hide messages and results
  uploadMessage.classList.add('hidden');
  uploadResults.classList.add('hidden');

  // Show progress
  uploadProgress.classList.remove('hidden');
  progressText.textContent = 'Uploading video...';
  uploadBtn.disabled = true;

  try {
    // Get selected platforms
    const selectedPlatforms = Array.from(
      document.querySelectorAll('input[name="platform"]:checked')
    ).map(cb => cb.value);
    
    if (selectedPlatforms.length === 0) {
      throw new Error('Please select at least one platform');
    }
    
    // Create FormData
    const formData = new FormData();
    formData.append('video', videoFile);
    formData.append('title', title);
    formData.append('description', description);
    formData.append('platforms', selectedPlatforms.join(','));

    // Upload
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Upload failed');
    }

    // Success - show results
    uploadProgress.classList.add('hidden');
    uploadMessage.textContent = data.message || 'Upload completed!';
    uploadMessage.classList.remove('error-message', 'info-message');
    uploadMessage.classList.add('success-message');
    uploadMessage.classList.remove('hidden');

    // Display results
    if (data.results && data.results.length > 0) {
      resultsList.innerHTML = '';
      data.results.forEach((result) => {
        const resultItem = document.createElement('div');
        resultItem.className = `result-item ${result.status}`;

        const nameDiv = document.createElement('div');
        const namePart = document.createElement('div');
        namePart.className = 'result-name';
        namePart.textContent = result.accountName;
        const typePart = document.createElement('div');
        typePart.className = 'result-type';
        typePart.textContent = result.accountType;
        nameDiv.appendChild(namePart);
        nameDiv.appendChild(typePart);

        const statusSpan = document.createElement('span');
        statusSpan.className = `result-status ${result.status}`;
        statusSpan.textContent = result.status.toUpperCase();

        resultItem.appendChild(nameDiv);
        resultItem.appendChild(statusSpan);

        if (result.error) {
          const errorDiv = document.createElement('div');
          errorDiv.className = 'result-error';
          errorDiv.textContent = `Error: ${result.error}`;
          resultItem.appendChild(errorDiv);
        }

        resultsList.appendChild(resultItem);
      });

      uploadResults.classList.remove('hidden');
    }

    // Reset form
    uploadForm.reset();
    fileInfo.textContent = '';
    uploadBtn.disabled = false;
  } catch (error) {
    uploadProgress.classList.add('hidden');
    uploadMessage.textContent = error.message;
    uploadMessage.classList.remove('success-message', 'info-message');
    uploadMessage.classList.add('error-message');
    uploadMessage.classList.remove('hidden');
    uploadBtn.disabled = false;
  }
});
