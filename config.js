/**
 * BookFlow Configuration File
 * Update these values with your own keys from the respective platforms.
 */

export const CONFIG = {
  // EmailJS: https://www.emailjs.com/
  EMAILJS: {
    PUBLIC_KEY: 'YOUR_EMAILJS_PUBLIC_KEY',
    SERVICE_ID: 'service_default',
    TEMPLATES: {
      CLIENT_CONFIRMATION: 'template_client_new',
      PROVIDER_NOTIFICATION: 'template_provider_new',
      STATUS_UPDATE: 'template_status_update'
    }
  },

  // Google Cloud Console: https://console.cloud.google.com/
  GOOGLE: {
    CLIENT_ID: '621517712971-2jh1vrbvnb1eb2l51n54etsre59i6skc.apps.googleusercontent.com',
    API_KEY: 'AIzaSyD_5G5R5R5R5R5R5R5R5R5R5R5R5R5',
    SCOPES: 'https://www.googleapis.com/auth/calendar.events'
  },

  // Stripe: https://dashboard.stripe.com/
  STRIPE: {
    PUBLIC_KEY: 'pk_test_YOUR_TEST_KEY',
    TEST_KEY: 'test_123456',
    PRICE_PRO_EGP: 'price_99egp_monthly',
    PRICE_BUSINESS_EGP: 'price_299egp_monthly'
  }
};
