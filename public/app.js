(() => {
  const birthdayMonth = 9; // Octubre, porque los meses en JavaScript empiezan en 0.
  const birthdayDay = 5;
  const birthYear = 2007;
  const celebrationOffsetHours = -5; // Hora local de la celebración (UTC−5).
  const $ = (selector) => document.querySelector(selector);

  function pad(value) { return String(value).padStart(2, '0'); }

  function birthdayAtMidnight(year) {
    return new Date(Date.UTC(year, birthdayMonth, birthdayDay, -celebrationOffsetHours, 0, 0));
  }

  function celebrationYear(now) {
    const shifted = new Date(now.getTime() + celebrationOffsetHours * 3600000);
    return shifted.getUTCFullYear();
  }

  function updateCountdown() {
    const now = new Date();
    const currentYear = celebrationYear(now);
    const thisBirthday = birthdayAtMidnight(currentYear);
    const birthdayEnds = new Date(thisBirthday.getTime() + 86400000);
    const isBirthday = now >= thisBirthday && now < birthdayEnds;
    const target = now < thisBirthday ? thisBirthday : birthdayAtMidnight(currentYear + 1);
    const seconds = isBirthday ? 0 : Math.max(0, Math.floor((target - now) / 1000));
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    $('#days').textContent = pad(days);
    $('#hours').textContent = pad(hours);
    $('#minutes').textContent = pad(minutes);
    $('#seconds').textContent = pad(remainingSeconds);

    const age = (isBirthday ? currentYear : target.getUTCFullYear()) - birthYear;
    $('#countdown-note').textContent = isBirthday
      ? '¡Hoy es tu día, Yoselin!'
      : `hasta las 00:00 del 5 de octubre · tus ${age} años`;
  }

  updateCountdown();
  window.setInterval(updateCountdown, 1000);

  $('[data-scroll-to]').addEventListener('click', () => $('#carta').scrollIntoView({ behavior: 'smooth', block: 'center' }));
  $('#open-letter').addEventListener('click', () => $('#carta').scrollIntoView({ behavior: 'smooth', block: 'center' }));

  const reasons = [...document.querySelectorAll('.reason-card')];
  let activeReason = 0;
  $('#reveal-reason').addEventListener('click', () => {
    reasons[activeReason].classList.remove('active');
    activeReason = (activeReason + 1) % reasons.length;
    reasons[activeReason].classList.add('active');
    $('#reveal-reason').innerHTML = activeReason === reasons.length - 1
      ? 'Volver a leer las razones <span aria-hidden="true">↻</span>'
      : 'Descubrir otra razón <span aria-hidden="true">→</span>';
  });

  const strip = $('#photo-strip');
  const defaultPhotos = [
    '1.jpeg', '11.jpeg', '2.jpeg', '22.jpeg', '3.jpeg', '33.jpeg',
    '4.jpeg', '4triktok.jpeg', '55.jpeg', '66.jpeg', '77.jpeg', '88.jpeg'
  ];
  const photosDatabase = 'cumpleamor-photos';
  const photosStore = 'photos';

  function openPhotosDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(photosDatabase, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(photosStore)) {
          request.result.createObjectStore(photosStore, { keyPath: 'id', autoIncrement: true });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function savedPhotos() {
    const database = await openPhotosDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(photosStore, 'readonly');
      const request = transaction.objectStore(photosStore).getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function savePhoto(file) {
    const database = await openPhotosDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(photosStore, 'readwrite');
      transaction.objectStore(photosStore).add({ image: file, name: file.name, createdAt: Date.now() });
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async function deleteSavedPhoto(id) {
    const database = await openPhotosDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(photosStore, 'readwrite');
      transaction.objectStore(photosStore).delete(id);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
  }

  function addPhotoCard(source, { removable = false, id, alt = 'Recuerdo compartido' } = {}) {
    const card = document.createElement('article');
    card.className = 'user-photo';
    const image = document.createElement('img');
    image.src = source;
    image.alt = alt;
    card.appendChild(image);

    if (removable) {
      const removeButton = document.createElement('button');
      removeButton.className = 'remove-photo';
      removeButton.type = 'button';
      removeButton.setAttribute('aria-label', 'Quitar esta foto');
      removeButton.textContent = '×';
      removeButton.addEventListener('click', async () => {
        await deleteSavedPhoto(id);
        card.remove();
      });
      card.appendChild(removeButton);
    }
    strip.appendChild(card);
  }

  async function loadPhotoAlbum() {
    defaultPhotos.forEach((filename, index) => {
      addPhotoCard(`/resources/${filename}`, { alt: `Recuerdo ${index + 1}` });
    });
    try {
      const photos = await savedPhotos();
      photos.sort((first, second) => first.createdAt - second.createdAt).forEach((photo) => {
        addPhotoCard(URL.createObjectURL(photo.image), { removable: true, id: photo.id, alt: photo.name || 'Recuerdo compartido' });
      });
    } catch (error) {
      console.warn('No fue posible recuperar las fotos guardadas.', error);
    }
  }

  $('#photo-input').addEventListener('change', async (event) => {
    const photos = [...event.target.files].filter((file) => file.type.startsWith('image/'));
    for (const photo of photos) {
      try {
        await savePhoto(photo);
      } catch (error) {
        console.warn('No fue posible guardar una foto.', error);
      }
    }
    event.target.value = '';
    strip.replaceChildren();
    loadPhotoAlbum();
  });

  loadPhotoAlbum();

  const canvas = $('#confetti-canvas');
  const context = canvas.getContext('2d');
  let particles = [];
  let frame;

  function resizeCanvas() { canvas.width = window.innerWidth * devicePixelRatio; canvas.height = window.innerHeight * devicePixelRatio; context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  function celebrate() {
    particles = Array.from({ length: 130 }, () => ({
      x: window.innerWidth / 2 + (Math.random() - .5) * 80,
      y: window.innerHeight * .35 + (Math.random() - .5) * 40,
      vx: (Math.random() - .5) * 9,
      vy: -Math.random() * 11 - 3,
      gravity: .18 + Math.random() * .08,
      size: 5 + Math.random() * 6,
      rotation: Math.random() * Math.PI,
      rotationSpeed: (Math.random() - .5) * .28,
      color: ['#a55263', '#f3d9c8', '#d8ad55', '#6e8064', '#fff8ef'][Math.floor(Math.random() * 5)],
      life: 1
    }));
    cancelAnimationFrame(frame);
    animateConfetti();
    $('#celebration-toast').classList.add('show');
    window.setTimeout(() => $('#celebration-toast').classList.remove('show'), 4200);
  }

  function animateConfetti() {
    context.clearRect(0, 0, window.innerWidth, window.innerHeight);
    particles.forEach((particle) => {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vy += particle.gravity;
      particle.rotation += particle.rotationSpeed;
      particle.life -= .008;
      context.save();
      context.translate(particle.x, particle.y);
      context.rotate(particle.rotation);
      context.fillStyle = particle.color;
      context.globalAlpha = Math.max(0, particle.life);
      context.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size * .65);
      context.restore();
    });
    particles = particles.filter((particle) => particle.life > 0 && particle.y < window.innerHeight + 30);
    if (particles.length) frame = requestAnimationFrame(animateConfetti);
  }

  $('#celebrate').addEventListener('click', celebrate);
})();
