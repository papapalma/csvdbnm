import { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Settings, Save, RotateCcw, Eye, Image as ImageIcon, Globe, Phone, Target } from 'lucide-react';
import { toast } from 'sonner';
import ImageUpload from '../components/ImageUpload';
import { api, getFileUrl } from '../services/api';
import cmsSettingsService, { CMSSettings } from '../services/cmsSettingsService';

// Default empty settings - should be configured via CMS
const emptySettings: CMSSettings = {
  hero: {
    badge: '',
    title: '',
    subtitle: '',
    ctaPrimary: 'Enroll Now',
    ctaSecondary: 'Browse Programs',
  },
  appearance: {
    logo: '',
    heroBackground: '',
  },
  mission: '',
  vision: '',
  contact: {
    address: '',
    addressLine2: '',
    phone: '',
    email: '',
    facebook: '',
  },
  footer: {
    companyName: '',
    tagline: '',
  },
};

export default function CMSSettingsPage() {
  const [settings, setSettings] = useState<CMSSettings>(emptySettings);
  const [isSaving, setIsSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [backgroundPreview, setBackgroundPreview] = useState<string>('');

  const normalizeSettings = (saved: Partial<CMSSettings>): CMSSettings => ({
    ...emptySettings,
    ...saved,
    hero: { ...emptySettings.hero, ...saved.hero },
    appearance: { ...emptySettings.appearance, ...saved.appearance },
    contact: { ...emptySettings.contact, ...saved.contact },
    footer: { ...emptySettings.footer, ...saved.footer },
  });

  // Load settings from database (with localStorage fallback and migration)
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // Try to load from database first
        const data = await cmsSettingsService.getSettings();
        
        if (data) {
          // Settings found in database
          const parsed = normalizeSettings(data);
          setSettings(parsed);
          setLogoPreview(parsed.appearance.logo ? getFileUrl(parsed.appearance.logo) : '');
          setBackgroundPreview(parsed.appearance.heroBackground ? getFileUrl(parsed.appearance.heroBackground) : '');
        } else {
          // No settings in database, check localStorage for migration
          const saved = localStorage.getItem('bmdc-cms-settings');
          const migrated = localStorage.getItem('bmdc-cms-migrated');
          
          if (saved && !migrated) {
            // Migrate from localStorage to database
            toast.info('Migrating settings to database...');
            const success = await cmsSettingsService.migrateFromLocalStorage();
            if (success) {
              toast.success('Settings migrated successfully!');
              // Reload from database
              const migratedData = await cmsSettingsService.getSettings();
              if (migratedData) {
                const parsed = normalizeSettings(migratedData);
                setSettings(parsed);
                setLogoPreview(parsed.appearance.logo ? getFileUrl(parsed.appearance.logo) : '');
                setBackgroundPreview(parsed.appearance.heroBackground ? getFileUrl(parsed.appearance.heroBackground) : '');
              }
            }
          } else if (saved) {
            // Already migrated, just load from localStorage as fallback
            const parsed = normalizeSettings(JSON.parse(saved));
            setSettings(parsed);
            setLogoPreview(parsed.appearance.logo ? getFileUrl(parsed.appearance.logo) : '');
            setBackgroundPreview(parsed.appearance.heroBackground ? getFileUrl(parsed.appearance.heroBackground) : '');
          }
        }
      } catch (error) {
        console.error('Failed to load CMS settings:', error);
        toast.error('Failed to load settings');
      }
    };
    
    loadSettings();
  }, []);

  const toBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      let logoPath = settings.appearance.logo;
      let heroBackgroundPath = settings.appearance.heroBackground;

      // Upload new logo if one was selected
      if (logoFile) {
        const base64 = await toBase64(logoFile);
        const response = await api.post<{ filePath: string; url: string }>('/upload/tenant', {
          file: base64,
          category: 'images/cms',
          filename: logoFile.name,
          prefix: 'logo',
        });
        if (response.success && response.data?.filePath) {
          logoPath = response.data.filePath;
        } else {
          toast.error('Logo upload failed');
          setIsSaving(false);
          return;
        }
      }

      // Upload new hero background if one was selected
      if (backgroundFile) {
        const base64 = await toBase64(backgroundFile);
        const response = await api.post<{ filePath: string; url: string }>('/upload/tenant', {
          file: base64,
          category: 'images/cms',
          filename: backgroundFile.name,
          prefix: 'hero-background',
        });
        if (response.success && response.data?.filePath) {
          heroBackgroundPath = response.data.filePath;
        } else {
          toast.error('Hero background upload failed');
          setIsSaving(false);
          return;
        }
      }

      const updatedSettings = {
        ...settings,
        appearance: { ...settings.appearance, logo: logoPath, heroBackground: heroBackgroundPath },
      };
      
      // Save to database
      await cmsSettingsService.updateSettings(updatedSettings);
      
      // Also save to localStorage as backup
      localStorage.setItem('bmdc-cms-settings', JSON.stringify(updatedSettings));
      
      setSettings(updatedSettings);
      setLogoFile(null);
      setBackgroundFile(null);
      
      toast.success('Settings saved successfully!');
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (confirm('Are you sure you want to reset all settings? This cannot be undone.')) {
      try {
        setSettings(emptySettings);
        setLogoFile(null);
        setBackgroundFile(null);
        setLogoPreview('');
        setBackgroundPreview('');
        
        // Save empty settings to database
        await cmsSettingsService.updateSettings(emptySettings);
        
        // Also clear localStorage
        localStorage.setItem('bmdc-cms-settings', JSON.stringify(emptySettings));
        
        toast.success('Settings reset to default');
      } catch (error) {
        console.error('Reset error:', error);
        toast.error('Failed to reset settings');
      }
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2">
              <Settings className="size-8" />
              Website Settings
            </h1>
            <p className="text-muted-foreground">
              Customize your landing page content
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleReset}>
              <RotateCcw className="mr-2 size-4" />
              Reset to Default
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              <Save className="mr-2 size-4" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>

        {/* Hero Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="size-5" />
              Hero Section
            </CardTitle>
            <CardDescription>
              Customize the main banner and call-to-action on your landing page
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="hero-badge">Badge Text</Label>
              <Input
                id="hero-badge"
                value={settings.hero.badge}
                onChange={(e) => setSettings({
                  ...settings,
                  hero: { ...settings.hero, badge: e.target.value }
                })}
                placeholder="Quality Training & Development"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hero-title">Main Title</Label>
              <Input
                id="hero-title"
                value={settings.hero.title}
                onChange={(e) => setSettings({
                  ...settings,
                  hero: { ...settings.hero, title: e.target.value }
                })}
                placeholder="Discover Your Path"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hero-subtitle">Subtitle</Label>
              <Textarea
                id="hero-subtitle"
                value={settings.hero.subtitle}
                onChange={(e) => setSettings({
                  ...settings,
                  hero: { ...settings.hero, subtitle: e.target.value }
                })}
                rows={3}
                placeholder="Transform your future..."
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="hero-cta-primary">Primary Button Text</Label>
                <Input
                  id="hero-cta-primary"
                  value={settings.hero.ctaPrimary}
                  onChange={(e) => setSettings({
                    ...settings,
                    hero: { ...settings.hero, ctaPrimary: e.target.value }
                  })}
                  placeholder="Enroll Now"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="hero-cta-secondary">Secondary Button Text</Label>
                <Input
                  id="hero-cta-secondary"
                  value={settings.hero.ctaSecondary}
                  onChange={(e) => setSettings({
                    ...settings,
                    hero: { ...settings.hero, ctaSecondary: e.target.value }
                  })}
                  placeholder="Browse Programs"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Appearance Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="size-5" />
              Appearance
            </CardTitle>
            <CardDescription>
              Customize the visual elements of your website and hero banner
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Hero Background with live preview */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-semibold">Hero Background Image</Label>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    This image fills the entire landing page hero section. Use a high-quality landscape photo.
                  </p>
                </div>
                {(backgroundPreview || settings.appearance.heroBackground) && (
                  <Badge variant="outline" className="gap-1.5 text-green-600 border-green-300">
                    <Eye className="size-3" />
                    Preview below
                  </Badge>
                )}
              </div>

              <ImageUpload
                value={backgroundPreview || getFileUrl(settings.appearance.heroBackground)}
                onChange={(value) => {
                  setBackgroundPreview(value);
                  if (!value) {
                    setBackgroundFile(null);
                    setSettings({ ...settings, appearance: { ...settings.appearance, heroBackground: '' } });
                  }
                }}
                onFileChange={(file) => setBackgroundFile(file)}
                label=""
                description="Recommended: 1920×1080px or wider, landscape orientation, JPG/PNG/WebP"
              />

              {/* Live hero preview */}
              {(backgroundPreview || settings.appearance.heroBackground) && (
                <div className="overflow-hidden rounded-2xl border-2 border-dashed border-border">
                  <div className="relative h-52 w-full overflow-hidden bg-slate-950">
                    <img
                      src={backgroundPreview || getFileUrl(settings.appearance.heroBackground)}
                      alt="Hero preview"
                      className="h-full w-full object-cover opacity-70"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-slate-950/40 via-slate-950/30 to-slate-950/80" />
                    <div className="absolute inset-0 flex flex-col items-start justify-center px-8">
                      <div className="mb-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-white backdrop-blur-sm">
                        ✦ {settings.hero.badge || 'Quality Training & Development'}
                      </div>
                      <h3 className="text-2xl font-bold text-white drop-shadow-lg">
                        {settings.hero.title || 'Discover Your Path'}
                      </h3>
                      <p className="mt-1 max-w-sm text-xs text-white/70 line-clamp-2">
                        {settings.hero.subtitle || 'Transform your future with our programs.'}
                      </p>
                    </div>
                    <div className="absolute bottom-2 right-3">
                      <Badge className="bg-black/50 text-white text-xs backdrop-blur-sm border-white/20">
                        Live Preview
                      </Badge>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t pt-6 space-y-4">
              <div>
                <Label className="text-base font-semibold">Organization Logo</Label>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Displayed in the header and hero section. Use a square image with transparent background.
                </p>
              </div>
              <ImageUpload
                value={logoPreview || getFileUrl(settings.appearance.logo)}
                onChange={(value) => {
                  setLogoPreview(value);
                  if (!value) {
                    setLogoFile(null);
                    setSettings({ ...settings, appearance: { ...settings.appearance, logo: '' } });
                  }
                }}
                onFileChange={(file) => setLogoFile(file)}
                label=""
                description="Recommended: 256×256px, square format, PNG with transparent background"
              />
            </div>
          </CardContent>
        </Card>

        {/* Mission & Vision */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="size-5" />
              Mission & Vision
            </CardTitle>
            <CardDescription>
              Define your organization's purpose and aspirations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mission">Mission Statement</Label>
              <Textarea
                id="mission"
                value={settings.mission}
                onChange={(e) => setSettings({ ...settings, mission: e.target.value })}
                rows={5}
                placeholder="To provide accessible, quality training..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vision">Vision Statement</Label>
              <Textarea
                id="vision"
                value={settings.vision}
                onChange={(e) => setSettings({ ...settings, vision: e.target.value })}
                rows={5}
                placeholder="A community where every individual..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="size-5" />
              Contact Information
            </CardTitle>
            <CardDescription>
              Update your contact details for visitors
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="contact-address">Address Line 1</Label>
              <Input
                id="contact-address"
                value={settings.contact.address}
                onChange={(e) => setSettings({
                  ...settings,
                  contact: { ...settings.contact, address: e.target.value }
                })}
                placeholder="Bongabong, Oriental Mindoro"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-address2">Address Line 2</Label>
              <Input
                id="contact-address2"
                value={settings.contact.addressLine2}
                onChange={(e) => setSettings({
                  ...settings,
                  contact: { ...settings.contact, addressLine2: e.target.value }
                })}
                placeholder="Philippines"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-phone">Phone Number</Label>
              <Input
                id="contact-phone"
                value={settings.contact.phone}
                onChange={(e) => setSettings({
                  ...settings,
                  contact: { ...settings.contact, phone: e.target.value }
                })}
                placeholder="+63 XXX XXX XXXX"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-email">Email Address</Label>
              <Input
                id="contact-email"
                type="email"
                value={settings.contact.email}
                onChange={(e) => setSettings({
                  ...settings,
                  contact: { ...settings.contact, email: e.target.value }
                })}
                placeholder="info@bmdc.edu.ph"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-facebook">Facebook Page URL</Label>
              <Input
                id="contact-facebook"
                type="url"
                value={settings.contact.facebook}
                onChange={(e) => setSettings({
                  ...settings,
                  contact: { ...settings.contact, facebook: e.target.value }
                })}
                placeholder="https://facebook.com/your-page"
              />
            </div>
          </CardContent>
        </Card>

        {/* Footer Information */}
        <Card>
          <CardHeader>
            <CardTitle>Footer Information</CardTitle>
            <CardDescription>
              Company name and tagline displayed in the header and footer
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="footer-company">Company Name</Label>
              <Input
                id="footer-company"
                value={settings.footer.companyName}
                onChange={(e) => setSettings({
                  ...settings,
                  footer: { ...settings.footer, companyName: e.target.value }
                })}
                placeholder="Bongabong Manpower Development Center"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="footer-tagline">Tagline</Label>
              <Input
                id="footer-tagline"
                value={settings.footer.tagline}
                onChange={(e) => setSettings({
                  ...settings,
                  footer: { ...settings.footer, tagline: e.target.value }
                })}
                placeholder="Empowering Communities"
              />
            </div>
          </CardContent>
        </Card>

        {/* Save Button (Bottom) */}
        <div className="flex justify-end gap-2 border-t pt-6">
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="mr-2 size-4" />
            Reset to Default
          </Button>
          <Button onClick={handleSave} disabled={isSaving} size="lg">
            <Save className="mr-2 size-4" />
            {isSaving ? 'Saving...' : 'Save All Changes'}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}