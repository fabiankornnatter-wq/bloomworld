// Vorbereitung für Monetarisierung. Es findet KEINE echte Zahlung statt.
// Später: Zahlungsanbieter (z.B. Stripe Checkout über eine Vercel-Serverfunktion) oder
// Google Play Billing bei einer App-Version. Geheime Schlüssel nur serverseitig, nie im Frontend.
import { IAP, REWARDED_VIDEO } from './config.js';

export const PAYMENTS_ENABLED = false;
export const ADS_ENABLED = false;

export async function purchase(productId) {
  if (!IAP[productId]) return { ok: false, code: 'unknown', message: 'Dieses Angebot gibt es nicht.' };
  return { ok: false, code: 'not_available', message: 'Käufe mit Echtgeld sind noch nicht aktiv. Sie kommen in einem späteren Update.' };
}

export async function showRewardedVideo() {
  return { ok: false, code: 'not_available', message: `Belohnungsvideos kommen bald: freiwillig ein kurzes Video ansehen und ${REWARDED_VIDEO.reward} Münzen erhalten.` };
}

export const formatEUR = (v) => v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
