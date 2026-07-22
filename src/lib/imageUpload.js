export async function optimizeImage(file, maxSize = 1200, quality = 0.82) {
  const img = await loadImage(file);
  let { width, height } = img;

  if (width <= maxSize && height <= maxSize && file.size < 300_000) {
    return file;
  }

  if (width > height) {
    if (width > maxSize) {
      height = Math.round(height * (maxSize / width));
      width = maxSize;
    }
  } else {
    if (height > maxSize) {
      width = Math.round(width * (maxSize / height));
      height = maxSize;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const isPNG = file.type === 'image/png';
  if (!isPNG) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }

  ctx.drawImage(img, 0, 0, width, height);

  const type = isPNG ? 'image/png' : 'image/jpeg';
  const blob = await new Promise(resolve => canvas.toBlob(resolve, type, quality));

  if (blob.size >= file.size) return file;

  const ext = isPNG ? 'png' : 'jpg';
  const baseName = file.name.replace(/\.[^.]+$/, '');
  return new File([blob], `${baseName}.${ext}`, { type });
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}