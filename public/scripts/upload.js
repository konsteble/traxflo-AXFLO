document.getElementById('upload-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const formData = new FormData();
  formData.append('track', document.getElementById('track-file').files[0]);
  formData.append('title', document.getElementById('track-title').value);
  formData.append('artist', document.getElementById('artist-name').value);

  try {
    const response = await fetch('http://localhost:3001/upload', {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    alert('Трек успешно загружен!');
    window.location.href = '/';
  } catch (error) {
    console.error('Ошибка загрузки:', error);
  }
});