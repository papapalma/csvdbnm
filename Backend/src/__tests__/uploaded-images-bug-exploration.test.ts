/**
 * Bug Condition Exploration Test - Uploaded Images Not Displaying
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**
 * 
 * **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * **DO NOT attempt to fix the test or the code when it fails**
 * 
 * This test encodes the expected behavior (images should display correctly).
 * It will validate the fix when it passes after implementation.
 * 
 * **GOAL**: Surface counterexamples that demonstrate uploaded images cannot be 
 * fetched or rendered. This includes:
 * - HTTP 404 errors
 * - CORS errors
 * - Connection refused errors
 * - Missing/incorrect BACKEND_URL configuration
 * - Next.js static file serving issues
 * 
 * Test approach:
 * 1. Upload test images through API (both tenant-scoped and legacy flat paths)
 * 2. Retrieve image paths from API responses
 * 3. Attempt to fetch images using constructed URLs
 * 4. Assert HTTP 200 status, correct Content-Type, and non-empty body
 * 
 * **EXPECTED OUTCOME**: Test FAILS with 404, CORS, or connection errors
 */

import axios from 'axios';
import { promises as fs } from 'fs';
import path from 'path';
import sharp from 'sharp';

// Test configuration
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const API_BASE_URL = `${BACKEND_URL}/api`;

// Test tenant IDs
const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const TEST_TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

// Test user credentials (assuming test database is seeded)
const SUPER_ADMIN_CREDENTIALS = {
  email: 'superadmin@bmdc.gov.ph',
  password: 'admin123',
};

/**
 * Helper: Generate a test image buffer (1x1 pixel JPEG)
 */
async function generateTestImage(color: { r: number; g: number; b: number } = { r: 255, g: 0, b: 0 }): Promise<Buffer> {
  return sharp({
    create: {
      width: 100,
      height: 100,
      channels: 3,
      background: color,
    },
  })
    .jpeg()
    .toBuffer();
}

/**
 * Helper: Login and get auth token
 */
async function loginAndGetToken(): Promise<string> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/auth/login`,
      SUPER_ADMIN_CREDENTIALS,
      {
        withCredentials: true,
        validateStatus: () => true, // Accept all status codes
      }
    );

    if (response.status !== 200) {
      throw new Error(`Login failed: ${response.status} - ${JSON.stringify(response.data)}`);
    }

    // Extract cookie from response headers
    const cookies = response.headers['set-cookie'];
    if (!cookies || cookies.length === 0) {
      throw new Error('No auth cookie received from login');
    }

    return cookies[0];
  } catch (error) {
    console.error('Login error:', error);
    throw new Error(`Failed to login: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Helper: Upload an image to tenant-scoped directory
 */
async function uploadTenantScopedImage(
  authCookie: string,
  category: string,
  filename: string
): Promise<string> {
  const imageBuffer = await generateTestImage({ r: 0, g: 255, b: 0 });
  const base64Data = imageBuffer.toString('base64');

  const response = await axios.post(
    `${API_BASE_URL}/upload/tenant`,
    {
      file: base64Data,
      category,
      filename,
      prefix: 'test',
    },
    {
      headers: {
        'Cookie': authCookie,
        'Content-Type': 'application/json',
      },
      withCredentials: true,
      validateStatus: () => true,
    }
  );

  if (response.status !== 200 && response.status !== 201) {
    throw new Error(`Upload failed: ${response.status} - ${JSON.stringify(response.data)}`);
  }

  // Response structure: { success: true, data: { filePath, url, thumbnailPath, thumbnailUrl }, message }
  return response.data.data?.filePath || response.data.data?.url || response.data.relativePath || response.data.url;
}

/**
 * Helper: Upload an image to legacy flat directory (simulated)
 */
async function uploadLegacyFlatImage(
  category: string,
  filename: string
): Promise<string> {
  const imageBuffer = await generateTestImage({ r: 0, g: 0, b: 255 });
  
  // Simulate legacy flat path structure: /uploads/images/{category}/{filename}
  const legacyDir = path.join(process.cwd(), 'public', 'uploads', 'images', category);
  await fs.mkdir(legacyDir, { recursive: true });
  
  const timestamp = Date.now();
  const randomHash = Math.random().toString(36).substring(7);
  const filenameWithTimestamp = `${filename.replace(/\.[^.]+$/, '')}_${timestamp}_${randomHash}.jpg`;
  const filePath = path.join(legacyDir, filenameWithTimestamp);
  
  await fs.writeFile(filePath, imageBuffer);
  
  return `/uploads/images/${category}/${filenameWithTimestamp}`;
}

/**
 * Helper: Construct Frontend-like URL using getFileUrl logic
 */
function constructFrontendImageUrl(relativePath: string): string {
  const TENANT_PATH_RE = /^\/uploads\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\//i;
  
  if (!relativePath) return '';
  if (relativePath.startsWith('http') || relativePath.startsWith('blob:') || relativePath.startsWith('data:')) {
    return relativePath;
  }

  // Tenant-scoped path → route through the secure API proxy
  if (TENANT_PATH_RE.test(relativePath)) {
    const withoutUploadsPrefix = relativePath.replace(/^\/uploads\//, '');
    return `${API_BASE_URL}/files/${withoutUploadsPrefix}`;
  }

  // Legacy flat path → serve directly from the public directory
  return `${BACKEND_URL}${relativePath}`;
}

/**
 * Helper: Attempt to fetch an image and validate response
 */
async function fetchAndValidateImage(
  imageUrl: string,
  authCookie?: string
): Promise<{ success: boolean; error?: string; status?: number }> {
  try {
    const response = await axios.get(imageUrl, {
      headers: authCookie ? { 'Cookie': authCookie } : {},
      withCredentials: true,
      responseType: 'arraybuffer',
      validateStatus: () => true, // Accept all status codes to inspect them
      timeout: 5000,
    });

    if (response.status !== 200) {
      return {
        success: false,
        error: `HTTP ${response.status}`,
        status: response.status,
      };
    }

    const contentType = response.headers['content-type'];
    if (!contentType || !contentType.startsWith('image/')) {
      return {
        success: false,
        error: `Wrong Content-Type: ${contentType}`,
        status: response.status,
      };
    }

    const body = response.data as Buffer;
    if (!body || body.length === 0) {
      return {
        success: false,
        error: 'Empty response body',
        status: response.status,
      };
    }

    return { success: true };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      return {
        success: false,
        error: error.code === 'ECONNREFUSED' 
          ? 'Connection refused - Backend server not running or wrong BACKEND_URL'
          : error.message,
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

describe('Bug Exploration: Uploaded Images Fail to Display', () => {
  let authCookie: string;
  const uploadedPaths: string[] = [];

  beforeAll(async () => {
    // Login to get auth cookie
    authCookie = await loginAndGetToken();
  }, 30000);

  afterAll(async () => {
    // Cleanup uploaded test images
    for (const relativePath of uploadedPaths) {
      try {
        if (relativePath.startsWith('/uploads/images/')) {
          // Legacy flat path
          const filePath = path.join(process.cwd(), 'public', relativePath);
          await fs.unlink(filePath);
        }
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  /**
   * Test Case 1: Tenant-Scoped Profile Image
   * 
   * Bug Condition: For uploaded images where resourceType = "uploaded_image" 
   * AND action = "fetch" AND filePath starts with "/uploads/{tenant_id}/"
   * 
   * Expected Behavior: System SHALL return HTTP 200 with correct Content-Type
   * and non-empty body when Frontend fetches the image through API proxy
   * 
   * Expected Outcome (UNFIXED): Test FAILS with 404, CORS error, or connection refused
   */
  test('Tenant-scoped profile image should be fetchable through API proxy', async () => {
    // Upload profile image to tenant-scoped directory
    const relativePath = await uploadTenantScopedImage(
      authCookie,
      'images/trainees',  // Use valid category
      'test-profile.jpg'
    );
    uploadedPaths.push(relativePath);

    console.log(`[TEST] Uploaded tenant-scoped profile image: ${relativePath}`);

    // Construct URL as Frontend would
    const imageUrl = constructFrontendImageUrl(relativePath);
    console.log(`[TEST] Fetching from URL: ${imageUrl}`);

    // Attempt to fetch image
    const result = await fetchAndValidateImage(imageUrl, authCookie);

    // Document counterexample if failed
    if (!result.success) {
      console.error(`[COUNTEREXAMPLE] Tenant-scoped profile image fetch failed:`);
      console.error(`  Path: ${relativePath}`);
      console.error(`  URL: ${imageUrl}`);
      console.error(`  Error: ${result.error}`);
      console.error(`  Status: ${result.status || 'N/A'}`);
    }

    // Assert expected behavior (will FAIL on unfixed code)
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  }, 30000);

  /**
   * Test Case 2: Legacy Flat Path Program Image
   * 
   * Bug Condition: For uploaded images where resourceType = "uploaded_image"
   * AND action = "fetch" AND filePath starts with "/uploads/images/"
   * 
   * Expected Behavior: System SHALL serve static file with HTTP 200, 
   * correct Content-Type, and CORS headers
   * 
   * Expected Outcome (UNFIXED): Test FAILS with 404 or CORS error
   */
  test('Legacy flat path program image should be fetchable as static file', async () => {
    // Upload program image to legacy flat directory
    const relativePath = await uploadLegacyFlatImage('programs', 'test-program.jpg');
    uploadedPaths.push(relativePath);

    console.log(`[TEST] Uploaded legacy flat program image: ${relativePath}`);

    // Construct URL as Frontend would
    const imageUrl = constructFrontendImageUrl(relativePath);
    console.log(`[TEST] Fetching from URL: ${imageUrl}`);

    // Attempt to fetch image (without auth for legacy public paths)
    const result = await fetchAndValidateImage(imageUrl);

    // Document counterexample if failed
    if (!result.success) {
      console.error(`[COUNTEREXAMPLE] Legacy flat program image fetch failed:`);
      console.error(`  Path: ${relativePath}`);
      console.error(`  URL: ${imageUrl}`);
      console.error(`  Error: ${result.error}`);
      console.error(`  Status: ${result.status || 'N/A'}`);
    }

    // Assert expected behavior (will FAIL on unfixed code)
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  }, 30000);

  /**
   * Test Case 3: QR Code Image
   * 
   * Bug Condition: For uploaded images where resourceType = "uploaded_image"
   * AND action = "display" AND filePath is QR code path
   * 
   * Expected Behavior: System SHALL successfully fetch and display QR code images
   * 
   * Expected Outcome (UNFIXED): Test FAILS with fetch error
   */
  test('Tenant-scoped QR code image should be fetchable', async () => {
    // Upload QR code to tenant-scoped directory
    const relativePath = await uploadTenantScopedImage(
      authCookie,
      'qrcodes/trainees',
      'test-qr.png'
    );
    uploadedPaths.push(relativePath);

    console.log(`[TEST] Uploaded tenant-scoped QR code: ${relativePath}`);

    // Construct URL as Frontend would
    const imageUrl = constructFrontendImageUrl(relativePath);
    console.log(`[TEST] Fetching from URL: ${imageUrl}`);

    // Attempt to fetch image
    const result = await fetchAndValidateImage(imageUrl, authCookie);

    // Document counterexample if failed
    if (!result.success) {
      console.error(`[COUNTEREXAMPLE] QR code image fetch failed:`);
      console.error(`  Path: ${relativePath}`);
      console.error(`  URL: ${imageUrl}`);
      console.error(`  Error: ${result.error}`);
      console.error(`  Status: ${result.status || 'N/A'}`);
    }

    // Assert expected behavior (will FAIL on unfixed code)
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  }, 30000);

  /**
   * Test Case 4: CMS Image
   * 
   * Bug Condition: For uploaded images where resourceType = "uploaded_image"
   * AND action = "display" AND filePath is CMS image path
   * 
   * Expected Behavior: System SHALL serve CMS images for public pages
   * 
   * Expected Outcome (UNFIXED): Test FAILS with fetch error
   */
  test('Legacy flat CMS image should be fetchable', async () => {
    // Upload CMS image to legacy flat directory
    const relativePath = await uploadLegacyFlatImage('cms', 'test-cms.jpg');
    uploadedPaths.push(relativePath);

    console.log(`[TEST] Uploaded legacy flat CMS image: ${relativePath}`);

    // Construct URL as Frontend would
    const imageUrl = constructFrontendImageUrl(relativePath);
    console.log(`[TEST] Fetching from URL: ${imageUrl}`);

    // Attempt to fetch image
    const result = await fetchAndValidateImage(imageUrl);

    // Document counterexample if failed
    if (!result.success) {
      console.error(`[COUNTEREXAMPLE] CMS image fetch failed:`);
      console.error(`  Path: ${relativePath}`);
      console.error(`  URL: ${imageUrl}`);
      console.error(`  Error: ${result.error}`);
      console.error(`  Status: ${result.status || 'N/A'}`);
    }

    // Assert expected behavior (will FAIL on unfixed code)
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  }, 30000);

  /**
   * Test Case 5: Frontend CORS Check
   * 
   * Bug Condition: Frontend on different origin cannot fetch Backend images
   * due to missing CORS headers
   * 
   * Expected Behavior: Backend SHALL include proper CORS headers on image responses
   * 
   * Expected Outcome (UNFIXED): Test may FAIL if CORS headers are missing
   */
  test('Backend should serve images with CORS headers', async () => {
    // Upload test image
    const relativePath = await uploadTenantScopedImage(
      authCookie,
      'images/items',
      'test-item.jpg'
    );
    uploadedPaths.push(relativePath);

    const imageUrl = constructFrontendImageUrl(relativePath);
    console.log(`[TEST] Checking CORS headers for: ${imageUrl}`);

    // Fetch with Origin header to simulate cross-origin request
    try {
      const response = await axios.get(imageUrl, {
        headers: {
          'Cookie': authCookie,
          'Origin': 'http://localhost:3000', // Simulate Frontend origin
        },
        withCredentials: true,
        responseType: 'arraybuffer',
        validateStatus: () => true,
      });

      const corsHeader = response.headers['access-control-allow-origin'];
      
      if (!corsHeader) {
        console.error(`[COUNTEREXAMPLE] Missing CORS headers:`);
        console.error(`  URL: ${imageUrl}`);
        console.error(`  Headers: ${JSON.stringify(response.headers, null, 2)}`);
      }

      // Assert CORS headers are present
      expect(corsHeader).toBeDefined();
      expect(response.status).toBe(200);
    } catch (error) {
      console.error(`[COUNTEREXAMPLE] CORS check failed with error:`, error);
      throw error;
    }
  }, 30000);
});
