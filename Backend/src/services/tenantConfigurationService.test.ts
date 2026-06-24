/**
 * Unit tests for the Tenant Configuration Service
 *
 * Validates Requirements 4.3, 4.4, 11.1, 11.2, 11.3, 11.4, 11.5:
 *   - 4.3  Local Admin configures Tenant_Configuration
 *   - 4.4  Local Admin customizes branding
 *   - 11.1 Logo validation (format and size)
 *   - 11.2 Primary and secondary brand color configuration
 *   - 11.3 Welcome message customization
 *   - 11.4 Contact information configuration
 *   - 11.5 Local announcements management
 *
 * These tests mock the supabaseAdmin client to avoid requiring a live
 * database connection.
 */

// ---------------------------------------------------------------------------
// Mock supabaseAdmin BEFORE importing the service
// ---------------------------------------------------------------------------

let fromCallCount = 0;
const fromResponses: Array<() => any> = [];

const mockFrom = jest.fn().mockImplementation((_table: string) => {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockImplementation(() => {
      const respFn = fromResponses[fromCallCount++];
      return respFn ? respFn() : Promise.resolve({ data: null, error: null });
    }),
    maybeSingle: jest.fn().mockImplementation(() => {
      const respFn = fromResponses[fromCallCount++];
      return respFn ? respFn() : Promise.resolve({ data: null, error: null });
    }),
  };
  return chain;
});

jest.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: mockFrom,
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import {
  validateHexColor,
  validateLogoUrl,
  validateBrandingUpdate,
  validateNotificationsUpdate,
  validateConfigurationUpdate,
  getTenantConfiguration,
  updateTenantConfiguration,
  addTenantAnnouncement,
  removeTenantAnnouncement,
  type FullTenantConfiguration,
  type ConfigurationUpdatePayload,
} from './tenantConfigurationService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSuccessResponse(data: any) {
  return () => Promise.resolve({ data, error: null });
}

function makeErrorResponse(message: string, code = 'PGRST000') {
  return () => Promise.resolve({ data: null, error: { message, code } });
}

const MOCK_TENANT_ID = 'tenant-uuid-0001';

const MOCK_CONFIGURATION: FullTenantConfiguration = {
  branding: {
    logoUrl: null,
    primaryColor: '#1a56db',
    secondaryColor: '#7e3af2',
    welcomeMessage: 'Welcome to Test LGU Training Management System',
  },
  features: {
    inventoryManagement: true,
    certificateGeneration: false,
    qrCodeAttendance: false,
    mobileAppAccess: false,
  },
  notifications: {
    whatsapp: null,
    email: null,
  },
  contact: undefined,
  announcements: [],
};

const MOCK_TENANT_ROW = {
  id: MOCK_TENANT_ID,
  configuration: MOCK_CONFIGURATION,
};

// ---------------------------------------------------------------------------
// validateHexColor
// ---------------------------------------------------------------------------

describe('validateHexColor', () => {
  it('returns null for valid 6-digit hex color', () => {
    expect(validateHexColor('#1a56db')).toBeNull();
    expect(validateHexColor('#FFFFFF')).toBeNull();
    expect(validateHexColor('#000000')).toBeNull();
  });

  it('returns null for valid 3-digit hex color', () => {
    expect(validateHexColor('#FFF')).toBeNull();
    expect(validateHexColor('#abc')).toBeNull();
  });

  it('returns error message for invalid hex color', () => {
    expect(validateHexColor('red')).not.toBeNull();
    expect(validateHexColor('#GGGGGG')).not.toBeNull();
    expect(validateHexColor('#12345')).not.toBeNull();
    expect(validateHexColor('1a56db')).not.toBeNull(); // missing #
  });
});

// ---------------------------------------------------------------------------
// validateLogoUrl (Req 11.1)
// ---------------------------------------------------------------------------

describe('validateLogoUrl (Req 11.1)', () => {
  it('returns null for null/empty (logo removal)', () => {
    expect(validateLogoUrl('')).toBeNull();
  });

  it('returns null for valid PNG URL', () => {
    expect(validateLogoUrl('https://example.com/logo.png')).toBeNull();
  });

  it('returns null for valid JPG URL', () => {
    expect(validateLogoUrl('https://example.com/logo.jpg')).toBeNull();
  });

  it('returns null for valid JPEG URL', () => {
    expect(validateLogoUrl('https://example.com/logo.jpeg')).toBeNull();
  });

  it('returns null for valid SVG URL', () => {
    expect(validateLogoUrl('https://example.com/logo.svg')).toBeNull();
  });

  it('returns null for valid relative path', () => {
    expect(validateLogoUrl('/uploads/tenant-id/images/logo.png')).toBeNull();
  });

  it('returns error for unsupported format (GIF)', () => {
    expect(validateLogoUrl('https://example.com/logo.gif')).not.toBeNull();
  });

  it('returns error for unsupported format (BMP)', () => {
    expect(validateLogoUrl('https://example.com/logo.bmp')).not.toBeNull();
  });

  it('returns error for unsupported format (WEBP)', () => {
    expect(validateLogoUrl('https://example.com/logo.webp')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// validateBrandingUpdate (Req 11.1, 11.2, 11.3)
// ---------------------------------------------------------------------------

describe('validateBrandingUpdate', () => {
  it('returns no errors for a valid branding update', () => {
    const errors = validateBrandingUpdate({
      logoUrl: 'https://example.com/logo.png',
      primaryColor: '#1a56db',
      secondaryColor: '#7e3af2',
      welcomeMessage: 'Welcome to Our LGU',
    });
    expect(errors).toHaveLength(0);
  });

  it('returns no errors when only some fields are provided', () => {
    const errors = validateBrandingUpdate({ primaryColor: '#FF0000' });
    expect(errors).toHaveLength(0);
  });

  it('returns error for invalid primaryColor (Req 11.2)', () => {
    const errors = validateBrandingUpdate({ primaryColor: 'blue' });
    expect(errors.some(e => e.includes('primaryColor'))).toBe(true);
  });

  it('returns error for invalid secondaryColor (Req 11.2)', () => {
    const errors = validateBrandingUpdate({ secondaryColor: 'rgb(0,0,0)' });
    expect(errors.some(e => e.includes('secondaryColor'))).toBe(true);
  });

  it('returns error for empty welcomeMessage (Req 11.3)', () => {
    const errors = validateBrandingUpdate({ welcomeMessage: '   ' });
    expect(errors.some(e => e.includes('welcomeMessage'))).toBe(true);
  });

  it('returns error for welcomeMessage exceeding 500 characters (Req 11.3)', () => {
    const errors = validateBrandingUpdate({ welcomeMessage: 'a'.repeat(501) });
    expect(errors.some(e => e.includes('welcomeMessage'))).toBe(true);
  });

  it('returns error for invalid logo format (Req 11.1)', () => {
    const errors = validateBrandingUpdate({ logoUrl: 'https://example.com/logo.gif' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('allows null logoUrl (removes logo)', () => {
    const errors = validateBrandingUpdate({ logoUrl: null });
    expect(errors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// validateNotificationsUpdate (Req 11.4 — notification settings)
// ---------------------------------------------------------------------------

describe('validateNotificationsUpdate', () => {
  it('returns no errors for valid WhatsApp config', () => {
    const errors = validateNotificationsUpdate({
      whatsapp: {
        accessToken: 'token123',
        phoneNumberId: 'phone123',
        businessAccountId: 'biz123',
      },
    });
    expect(errors).toHaveLength(0);
  });

  it('returns no errors for valid email config', () => {
    const errors = validateNotificationsUpdate({
      email: {
        senderName: 'LGU Notifications',
        senderEmail: 'noreply@lgu.gov.ph',
        smtpHost: 'smtp.example.com',
        smtpPort: 587,
        useTls: true,
        smtpUsername: 'user',
        smtpPassword: 'pass',
      },
    });
    expect(errors).toHaveLength(0);
  });

  it('returns no errors when setting whatsapp to null (disabling)', () => {
    const errors = validateNotificationsUpdate({ whatsapp: null });
    expect(errors).toHaveLength(0);
  });

  it('returns error for missing WhatsApp accessToken', () => {
    const errors = validateNotificationsUpdate({
      whatsapp: {
        accessToken: '',
        phoneNumberId: 'phone123',
        businessAccountId: 'biz123',
      },
    });
    expect(errors.some(e => e.includes('accessToken'))).toBe(true);
  });

  it('returns error for invalid email senderEmail', () => {
    const errors = validateNotificationsUpdate({
      email: {
        senderName: 'LGU',
        senderEmail: 'not-an-email',
        smtpHost: 'smtp.example.com',
        smtpPort: 587,
        useTls: true,
        smtpUsername: 'user',
        smtpPassword: 'pass',
      },
    });
    expect(errors.some(e => e.includes('senderEmail'))).toBe(true);
  });

  it('returns error for invalid SMTP port (out of range)', () => {
    const errors = validateNotificationsUpdate({
      email: {
        senderName: 'LGU',
        senderEmail: 'noreply@lgu.gov.ph',
        smtpHost: 'smtp.example.com',
        smtpPort: 99999,
        useTls: true,
        smtpUsername: 'user',
        smtpPassword: 'pass',
      },
    });
    expect(errors.some(e => e.includes('smtpPort'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateConfigurationUpdate
// ---------------------------------------------------------------------------

describe('validateConfigurationUpdate', () => {
  it('returns no errors for a valid full configuration update', () => {
    const errors = validateConfigurationUpdate({
      branding: {
        primaryColor: '#1a56db',
        welcomeMessage: 'Welcome',
      },
      features: {
        inventoryManagement: true,
      },
      notifications: {
        whatsapp: null,
      },
      contact: {
        email: 'contact@lgu.gov.ph',
      },
    });
    expect(errors).toHaveLength(0);
  });

  it('returns error for invalid contact email', () => {
    const errors = validateConfigurationUpdate({
      contact: { email: 'not-an-email' },
    });
    expect(errors.some(e => e.includes('contact.email'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getTenantConfiguration
// ---------------------------------------------------------------------------

describe('getTenantConfiguration', () => {
  beforeEach(() => {
    fromCallCount = 0;
    fromResponses.length = 0;
    mockFrom.mockClear();
  });

  it('returns the configuration when tenant exists', async () => {
    fromResponses.push(makeSuccessResponse({ configuration: MOCK_CONFIGURATION }));

    const result = await getTenantConfiguration(MOCK_TENANT_ID);
    expect(result).toEqual(MOCK_CONFIGURATION);
  });

  it('returns null when tenant does not exist', async () => {
    fromResponses.push(makeSuccessResponse(null));

    const result = await getTenantConfiguration('non-existent-id');
    expect(result).toBeNull();
  });

  it('throws when database query fails', async () => {
    fromResponses.push(makeErrorResponse('Connection refused'));

    await expect(getTenantConfiguration(MOCK_TENANT_ID)).rejects.toThrow(
      'Failed to fetch tenant configuration'
    );
  });
});

// ---------------------------------------------------------------------------
// updateTenantConfiguration — happy path
// ---------------------------------------------------------------------------

describe('updateTenantConfiguration — happy path', () => {
  beforeEach(() => {
    fromCallCount = 0;
    fromResponses.length = 0;
    mockFrom.mockClear();
  });

  it('merges branding update while preserving other fields (Req 4.4)', async () => {
    const updatedConfig: FullTenantConfiguration = {
      ...MOCK_CONFIGURATION,
      branding: {
        ...MOCK_CONFIGURATION.branding,
        primaryColor: '#FF0000',
        welcomeMessage: 'New Welcome Message',
      },
    };

    // Fetch current config
    fromResponses.push(makeSuccessResponse(MOCK_TENANT_ROW));
    // Update and return
    fromResponses.push(makeSuccessResponse({ configuration: updatedConfig }));

    const result = await updateTenantConfiguration(MOCK_TENANT_ID, {
      branding: {
        primaryColor: '#FF0000',
        welcomeMessage: 'New Welcome Message',
      },
    });

    expect(result.branding.primaryColor).toBe('#FF0000');
    expect(result.branding.welcomeMessage).toBe('New Welcome Message');
    // Other branding fields preserved
    expect(result.branding.secondaryColor).toBe('#7e3af2');
    // Features unchanged
    expect(result.features).toEqual(MOCK_CONFIGURATION.features);
  });

  it('updates feature flags (Req 4.3)', async () => {
    const updatedConfig: FullTenantConfiguration = {
      ...MOCK_CONFIGURATION,
      features: {
        ...MOCK_CONFIGURATION.features,
        certificateGeneration: true,
      },
    };

    fromResponses.push(makeSuccessResponse(MOCK_TENANT_ROW));
    fromResponses.push(makeSuccessResponse({ configuration: updatedConfig }));

    const result = await updateTenantConfiguration(MOCK_TENANT_ID, {
      features: { certificateGeneration: true },
    });

    expect(result.features.certificateGeneration).toBe(true);
    // Other features preserved
    expect(result.features.inventoryManagement).toBe(true);
  });

  it('updates WhatsApp notification settings (Req 11.4)', async () => {
    const whatsappConfig = {
      accessToken: 'token123',
      phoneNumberId: 'phone123',
      businessAccountId: 'biz123',
    };
    const updatedConfig: FullTenantConfiguration = {
      ...MOCK_CONFIGURATION,
      notifications: {
        whatsapp: whatsappConfig,
        email: null,
      },
    };

    fromResponses.push(makeSuccessResponse(MOCK_TENANT_ROW));
    fromResponses.push(makeSuccessResponse({ configuration: updatedConfig }));

    const result = await updateTenantConfiguration(MOCK_TENANT_ID, {
      notifications: { whatsapp: whatsappConfig },
    });

    expect(result.notifications.whatsapp).toEqual(whatsappConfig);
    expect(result.notifications.email).toBeNull();
  });

  it('updates email notification settings (Req 11.4)', async () => {
    const emailConfig = {
      senderName: 'LGU Notifications',
      senderEmail: 'noreply@lgu.gov.ph',
      smtpHost: 'smtp.example.com',
      smtpPort: 587,
      useTls: true,
      smtpUsername: 'user',
      smtpPassword: 'pass',
    };
    const updatedConfig: FullTenantConfiguration = {
      ...MOCK_CONFIGURATION,
      notifications: {
        whatsapp: null,
        email: emailConfig,
      },
    };

    fromResponses.push(makeSuccessResponse(MOCK_TENANT_ROW));
    fromResponses.push(makeSuccessResponse({ configuration: updatedConfig }));

    const result = await updateTenantConfiguration(MOCK_TENANT_ID, {
      notifications: { email: emailConfig },
    });

    expect(result.notifications.email).toEqual(emailConfig);
  });

  it('updates contact information (Req 11.4)', async () => {
    const contactInfo = {
      phone: '+63-912-345-6789',
      email: 'contact@lgu.gov.ph',
      address: '123 Main St, City',
    };
    const updatedConfig: FullTenantConfiguration = {
      ...MOCK_CONFIGURATION,
      contact: contactInfo,
    };

    fromResponses.push(makeSuccessResponse(MOCK_TENANT_ROW));
    fromResponses.push(makeSuccessResponse({ configuration: updatedConfig }));

    const result = await updateTenantConfiguration(MOCK_TENANT_ID, {
      contact: contactInfo,
    });

    expect(result.contact).toEqual(contactInfo);
  });

  it('allows setting notification config to null (disabling)', async () => {
    const tenantWithWhatsApp = {
      ...MOCK_TENANT_ROW,
      configuration: {
        ...MOCK_CONFIGURATION,
        notifications: {
          whatsapp: { accessToken: 'token', phoneNumberId: 'phone', businessAccountId: 'biz' },
          email: null,
        },
      },
    };
    const updatedConfig: FullTenantConfiguration = {
      ...MOCK_CONFIGURATION,
      notifications: { whatsapp: null, email: null },
    };

    fromResponses.push(makeSuccessResponse(tenantWithWhatsApp));
    fromResponses.push(makeSuccessResponse({ configuration: updatedConfig }));

    const result = await updateTenantConfiguration(MOCK_TENANT_ID, {
      notifications: { whatsapp: null },
    });

    expect(result.notifications.whatsapp).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// updateTenantConfiguration — error cases
// ---------------------------------------------------------------------------

describe('updateTenantConfiguration — error cases', () => {
  beforeEach(() => {
    fromCallCount = 0;
    fromResponses.length = 0;
    mockFrom.mockClear();
  });

  it('throws when tenant is not found', async () => {
    fromResponses.push(makeSuccessResponse(null));

    await expect(
      updateTenantConfiguration('non-existent-id', { branding: { primaryColor: '#FF0000' } })
    ).rejects.toThrow('Tenant not found');
  });

  it('throws when database fetch fails', async () => {
    fromResponses.push(makeErrorResponse('Connection refused'));

    await expect(
      updateTenantConfiguration(MOCK_TENANT_ID, { branding: { primaryColor: '#FF0000' } })
    ).rejects.toThrow('Failed to fetch tenant');
  });

  it('throws when database update fails', async () => {
    fromResponses.push(makeSuccessResponse(MOCK_TENANT_ROW));
    fromResponses.push(makeErrorResponse('Write failed'));

    await expect(
      updateTenantConfiguration(MOCK_TENANT_ID, { branding: { primaryColor: '#FF0000' } })
    ).rejects.toThrow('Failed to update tenant configuration');
  });
});

// ---------------------------------------------------------------------------
// addTenantAnnouncement (Req 11.5)
// ---------------------------------------------------------------------------

describe('addTenantAnnouncement (Req 11.5)', () => {
  beforeEach(() => {
    fromCallCount = 0;
    fromResponses.length = 0;
    mockFrom.mockClear();
  });

  it('adds a new announcement to the tenant configuration', async () => {
    const newAnnouncement = {
      id: 'announcement-uuid',
      title: 'Important Notice',
      content: 'Training schedule has been updated.',
      createdAt: new Date().toISOString(),
      expiresAt: null,
    };
    const updatedConfig: FullTenantConfiguration = {
      ...MOCK_CONFIGURATION,
      announcements: [newAnnouncement],
    };

    // getTenantConfiguration call
    fromResponses.push(makeSuccessResponse({ configuration: MOCK_CONFIGURATION }));
    // update call
    fromResponses.push(makeSuccessResponse({ configuration: updatedConfig }));

    const result = await addTenantAnnouncement(MOCK_TENANT_ID, {
      title: 'Important Notice',
      content: 'Training schedule has been updated.',
    });

    expect(result.announcements).toHaveLength(1);
    expect(result.announcements![0].title).toBe('Important Notice');
    expect(result.announcements![0].content).toBe('Training schedule has been updated.');
  });

  it('throws when tenant is not found', async () => {
    fromResponses.push(makeSuccessResponse(null));

    await expect(
      addTenantAnnouncement('non-existent-id', {
        title: 'Test',
        content: 'Test content',
      })
    ).rejects.toThrow('Tenant not found');
  });
});

// ---------------------------------------------------------------------------
// removeTenantAnnouncement (Req 11.5)
// ---------------------------------------------------------------------------

describe('removeTenantAnnouncement (Req 11.5)', () => {
  beforeEach(() => {
    fromCallCount = 0;
    fromResponses.length = 0;
    mockFrom.mockClear();
  });

  it('removes an announcement by ID', async () => {
    const existingAnnouncement = {
      id: 'announcement-to-remove',
      title: 'Old Notice',
      content: 'This will be removed.',
      createdAt: new Date().toISOString(),
      expiresAt: null,
    };
    const configWithAnnouncement: FullTenantConfiguration = {
      ...MOCK_CONFIGURATION,
      announcements: [existingAnnouncement],
    };
    const updatedConfig: FullTenantConfiguration = {
      ...MOCK_CONFIGURATION,
      announcements: [],
    };

    // getTenantConfiguration call
    fromResponses.push(makeSuccessResponse({ configuration: configWithAnnouncement }));
    // update call
    fromResponses.push(makeSuccessResponse({ configuration: updatedConfig }));

    const result = await removeTenantAnnouncement(MOCK_TENANT_ID, 'announcement-to-remove');

    expect(result.announcements).toHaveLength(0);
  });

  it('throws when tenant is not found', async () => {
    fromResponses.push(makeSuccessResponse(null));

    await expect(
      removeTenantAnnouncement('non-existent-id', 'some-announcement-id')
    ).rejects.toThrow('Tenant not found');
  });
});
