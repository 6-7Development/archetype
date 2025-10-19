// Google Analytics 4 tracking utilities

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

export const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || '';

// Initialize GA4
export const initGA4 = () => {
  if (!GA_MEASUREMENT_ID || typeof window === 'undefined') return;

  // Load gtag script
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);

  // Initialize dataLayer
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: any[]) {
    window.dataLayer?.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID, {
    send_page_view: false, // Disable automatic page views - we track manually in Router
  });
};

// Track page views
export const trackPageView = (path: string) => {
  if (!GA_MEASUREMENT_ID || !window.gtag) return;
  
  window.gtag('config', GA_MEASUREMENT_ID, {
    page_path: path,
  });
};

// Track custom events
export const trackEvent = (eventName: string, params?: Record<string, any>) => {
  if (!GA_MEASUREMENT_ID || !window.gtag) return;
  
  window.gtag('event', eventName, params);
};

// Conversion tracking events
export const trackConversion = {
  // Lead capture (NO PII - don't send email addresses)
  leadCapture: (source: string = 'landing_page') => {
    trackEvent('generate_lead', {
      event_category: 'engagement',
      event_label: source,
      value: 1, // Count of leads
    });
  },

  // User signup/registration
  signup: (userId: string) => {
    trackEvent('sign_up', {
      event_category: 'engagement',
      user_id: userId,
    });
  },

  // Subscription purchase
  subscribe: (plan: string, value: number) => {
    trackEvent('purchase', {
      event_category: 'ecommerce',
      transaction_id: `sub_${Date.now()}`,
      value,
      currency: 'USD',
      items: [{
        item_id: plan,
        item_name: `${plan} Plan`,
        item_category: 'subscription',
        price: value,
        quantity: 1,
      }],
    });
  },

  // Template purchase
  templatePurchase: (templateId: string, templateName: string, price: number) => {
    trackEvent('purchase', {
      event_category: 'ecommerce',
      transaction_id: `template_${Date.now()}`,
      value: price,
      currency: 'USD',
      items: [{
        item_id: templateId,
        item_name: templateName,
        item_category: 'template',
        price,
        quantity: 1,
      }],
    });
  },

  // Project creation
  createProject: (projectType: string) => {
    trackEvent('create_project', {
      event_category: 'engagement',
      event_label: projectType,
    });
  },

  // AI generation
  aiGeneration: (projectType: string, tokensUsed: number) => {
    trackEvent('ai_generation', {
      event_category: 'engagement',
      event_label: projectType,
      value: tokensUsed,
    });
  },
};
