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

  // Google Cloud Console: https://console.cloud.google.com/apis/credentials
  // 1. Create OAuth 2.0 Client ID (Web Application)
  // 2. Add Authorized JavaScript origins:
  //    - https://micro-saa-s-xi.vercel.app
  //    - http://localhost:8000
  //    - http://localhost:3000
  // 3. Copy the Client ID below
  GOOGLE: {
    CLIENT_ID: 'YOUR_GOOGLE_OAUTH_CLIENT_ID.apps.googleusercontent.com', // Replace with your actual Client ID
    API_KEY: 'YOUR_GOOGLE_API_KEY', // Optional: for Google Calendar API
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
