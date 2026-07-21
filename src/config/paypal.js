export const PAYPAL_CLIENT_ID = process.env.REACT_APP_PAYPAL_CLIENT_ID || 'YOUR_ACTUAL_PAYPAL_CLIENT_ID';

export const PAYPAL_OPTIONS = {
  'client-id': PAYPAL_CLIENT_ID,
  currency: 'EUR',
  components: 'buttons',
  'enable-funding': 'card,credit,paylater',
  'disable-funding': '',
};

export const PAYPAL_API = process.env.REACT_APP_PAYPAL_API || 'http://localhost:3001/api/paypal';
