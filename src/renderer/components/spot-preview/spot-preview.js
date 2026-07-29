// Same phone-frame shell Shorts Creator builds inline (buildPhoneFrame in
// shorts-flow.js) -- reused here as Spot Creator's own component per the
// project's "reuse shared CSS, keep module JS isolated" convention. No new
// CSS: .phone-frame/.phone-notch/.phone-screen/.phone-home-indicator
// already exist in main.css.
export function renderSpotPreview(container, { videoSrc }) {
  container.innerHTML = '';

  const phoneFrame = document.createElement('div');
  phoneFrame.className = 'phone-frame';

  const phoneNotch = document.createElement('div');
  phoneNotch.className = 'phone-notch';
  phoneFrame.appendChild(phoneNotch);

  const phoneScreen = document.createElement('div');
  phoneScreen.className = 'phone-screen';

  const video = document.createElement('video');
  video.src = `file://${videoSrc}`;
  video.controls = true;
  phoneScreen.appendChild(video);
  phoneFrame.appendChild(phoneScreen);

  const phoneHomeIndicator = document.createElement('div');
  phoneHomeIndicator.className = 'phone-home-indicator';
  phoneFrame.appendChild(phoneHomeIndicator);

  container.appendChild(phoneFrame);
}
