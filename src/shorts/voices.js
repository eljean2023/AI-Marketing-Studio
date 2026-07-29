// Plain voice data only -- id, display name, and language. No code, UI, or
// logic from any other project. ShortName values must match Microsoft's
// Edge TTS voice list exactly.
const VOICES = [
  { id: 'es-ES-ElviraNeural', name: '🇪🇸 Elvira (España)', language: 'Spanish' },
  { id: 'es-ES-AlvaroNeural', name: '🇪🇸 Álvaro (España)', language: 'Spanish' },
  { id: 'es-MX-DaliaNeural', name: '🇲🇽 Dalia (México)', language: 'Spanish' },
  { id: 'es-MX-JorgeNeural', name: '🇲🇽 Jorge (México)', language: 'Spanish' },
  { id: 'es-US-PalomaNeural', name: '🇺🇸 Paloma (USA)', language: 'Spanish' },
  { id: 'es-CL-CatalinaNeural', name: '🇨🇱 Catalina (Chile)', language: 'Spanish' },
  { id: 'es-CL-LorenzoNeural', name: '🇨🇱 Lorenzo (Chile)', language: 'Spanish' },
  { id: 'es-PE-CamilaNeural', name: '🇵🇪 Camila (Perú)', language: 'Spanish' },
  { id: 'es-PE-AlexNeural', name: '🇵🇪 Alex (Perú)', language: 'Spanish' },
  { id: 'es-VE-PaolaNeural', name: '🇻🇪 Paola (Venezuela)', language: 'Spanish' },
  { id: 'es-VE-SebastianNeural', name: '🇻🇪 Sebastián (Venezuela)', language: 'Spanish' },
  { id: 'es-UY-ValentinaNeural', name: '🇺🇾 Valentina (Uruguay)', language: 'Spanish' },
  { id: 'es-UY-MateoNeural', name: '🇺🇾 Mateo (Uruguay)', language: 'Spanish' },
  { id: 'es-CR-MariaNeural', name: '🇨🇷 María (Costa Rica)', language: 'Spanish' },
  { id: 'es-CR-JuanNeural', name: '🇨🇷 Juan (Costa Rica)', language: 'Spanish' },
  { id: 'es-CO-SalomeNeural', name: '🇨🇴 Salomé (Colombia)', language: 'Spanish' },
  { id: 'es-CO-GonzaloNeural', name: '🇨🇴 Gonzalo (Colombia)', language: 'Spanish' },
  { id: 'es-AR-ElenaNeural', name: '🇦🇷 Elena (Argentina)', language: 'Spanish' },
  { id: 'es-AR-TomasNeural', name: '🇦🇷 Tomás (Argentina)', language: 'Spanish' },
  { id: 'en-US-JennyNeural', name: '🇺🇸 Jenny (USA)', language: 'English' },
  { id: 'en-US-GuyNeural', name: '🇺🇸 Guy (USA)', language: 'English' },
  { id: 'en-GB-LibbyNeural', name: '🇬🇧 Libby (UK)', language: 'English' },
  { id: 'en-GB-RyanNeural', name: '🇬🇧 Ryan (UK)', language: 'English' },
  { id: 'fr-FR-DeniseNeural', name: '🇫🇷 Denise (Francia)', language: 'French' },
  { id: 'fr-FR-HenriNeural', name: '🇫🇷 Henri (Francia)', language: 'French' },
  { id: 'de-DE-KatjaNeural', name: '🇩🇪 Katja (Alemania)', language: 'German' },
  { id: 'de-DE-KaiNeural', name: '🇩🇪 Kai (Alemania)', language: 'German' },
  { id: 'it-IT-ElsaNeural', name: '🇮🇹 Elsa (Italia)', language: 'Italian' },
  { id: 'it-IT-LorenzoNeural', name: '🇮🇹 Lorenzo (Italia)', language: 'Italian' },
  { id: 'pt-BR-FranciscaNeural', name: '🇧🇷 Francisca (Brasil)', language: 'Portuguese' },
  { id: 'pt-BR-AntonioNeural', name: '🇧🇷 Antonio (Brasil)', language: 'Portuguese' },
];

module.exports = { VOICES };
