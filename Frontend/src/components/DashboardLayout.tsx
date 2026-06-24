import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { getRoleDisplayName, getRoleBadgeColor } from '../utils/roles';
import { Button } from './ui/button';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Badge } from './ui/badge';
import { getFileUrl } from '../services/api';
import OverdueBellNotification from './OverdueBellNotification';
import { 
  LayoutDashboard, 
  Users, 
  User,
  Package, 
  FileText, 
  BarChart3, 
  Settings, 
  LogOut, 
  Menu, 
  Moon,
  Sun,
  GraduationCap,
  Globe,
  UserCog,
  Activity,
  AlertTriangle,
  ChevronDown,
  QrCode,
  Calendar,
  Activity as ActivityIcon,
  ClipboardList,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
}

interface NavItem {
  name: string;
  href?: string;
  icon: any;
  permission?: keyof import('../utils/roles').Permission;
  children?: NavItem[];
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Platform Admin', href: '/super-admin', icon: ActivityIcon },
  { name: 'Trainees', href: '/trainees', icon: Users, permission: 'canManageTrainees' },
  { name: 'Equipments', href: '/items', icon: Package, permission: 'canManageItems' },
  { name: 'Borrowing', href: '/lendings', icon: FileText, permission: 'canManageLendings' },
  { name: 'Programs', href: '/programs', icon: GraduationCap, permission: 'canManagePrograms' },
  { name: 'Reports', href: '/reports', icon: BarChart3, permission: 'canViewReports' },
  { 
    name: 'Settings', 
    icon: Settings, 
    children: [
      { name: 'Activity Logs', href: '/activity-logs', icon: Activity, permission: 'canViewActivityLogs' },
      { name: 'Data Quality', href: '/anomalies', icon: AlertTriangle, permission: 'canViewAnomalies' },
      { name: 'Non-Attendance Dates', href: '/non-attendance-dates', icon: Calendar, permission: 'canManagePrograms' },
      { name: 'Website Content', href: '/cms-settings', icon: Globe, permission: 'canManageCMS' },
      { name: 'Account', href: '/account-management', icon: UserCog, permission: 'canManageAccounts' },
    ]
  },
];

const mobileNavigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Platform Admin', href: '/super-admin', icon: ActivityIcon },
  { name: 'Trainees', href: '/trainees', icon: Users, permission: 'canManageTrainees' },
  { name: 'Equipments', href: '/items', icon: Package, permission: 'canManageItems' },
  { name: 'Borrowing', href: '/lendings', icon: FileText, permission: 'canManageLendings' },
  { name: 'Programs', href: '/programs', icon: GraduationCap, permission: 'canManagePrograms' },
  { name: 'Reports', href: '/reports', icon: BarChart3, permission: 'canViewReports' },
  { name: 'Activity Logs', href: '/activity-logs', icon: Activity, permission: 'canViewActivityLogs' },
  { name: 'Data Quality', href: '/anomalies', icon: AlertTriangle, permission: 'canViewAnomalies' },
  { name: 'Non-Attendance Dates', href: '/non-attendance-dates', icon: Calendar, permission: 'canManagePrograms' },
  { name: 'Website Content', href: '/cms-settings', icon: Globe, permission: 'canManageCMS' },
  { name: 'Account', href: '/account-management', icon: UserCog, permission: 'canManageAccounts' },
];

// Trainee-specific navigation
const traineeNavigation: NavItem[] = [
  { name: 'My Dashboard', href: '/trainee/dashboard', icon: LayoutDashboard },
  { name: 'My Profile', href: '/trainee/profile', icon: User },
  { name: 'Programs', href: '/trainee/programs', icon: GraduationCap },
];

const traineeeMobileNavigation: NavItem[] = [
  { name: 'My Dashboard', href: '/trainee/dashboard', icon: LayoutDashboard },
  { name: 'My Profile', href: '/trainee/profile', icon: User },
  { name: 'Programs', href: '/trainee/programs', icon: GraduationCap },
];

// Super Admin navigation — platform-level only, no tenant-scoped pages
const superAdminNavigation: NavItem[] = [
  { name: 'Platform Admin', href: '/super-admin', icon: ActivityIcon },
  { name: 'Platform Reports', href: '/super-admin/reports', icon: BarChart3 },
  { name: 'Activity Logs', href: '/activity-logs', icon: Activity },
  { name: 'Extension Requests', href: '/extension-requests', icon: ClipboardList },
  { name: 'Account', href: '/account-management', icon: UserCog },
];

const superAdminMobileNavigation: NavItem[] = [
  { name: 'Platform Admin', href: '/super-admin', icon: ActivityIcon },
  { name: 'Platform Reports', href: '/super-admin/reports', icon: BarChart3 },
  { name: 'Activity Logs', href: '/activity-logs', icon: Activity },
  { name: 'Extension Requests', href: '/extension-requests', icon: ClipboardList },
  { name: 'Account', href: '/account-management', icon: UserCog },
];

export default function DashboardLayout({ children, title }: DashboardLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, hasPermission } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cmsSettings, setCmsSettings] = useState<any>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // Helper function to get value from CMS settings
  const getValue = (setting: any): string => {
    if (!setting) return '';
    if (typeof setting === 'object' && 'value' in setting) {
      return setting.value;
    }
    return setting;
  };

  // Load CMS settings for logo
  useEffect(() => {
    const savedSettings = localStorage.getItem('bmdc-cms-settings');
    if (savedSettings) {
      setCmsSettings(JSON.parse(savedSettings));
    }
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const isActive = (path: string) => location.pathname === path;
  
  const isChildActive = (item: NavItem): boolean => {
    if (item.href && isActive(item.href)) return true;
    if (item.children) {
      return item.children.some(child => child.href && isActive(child.href));
    }
    return false;
  };

  const toggleDropdown = (name: string) => {
    setOpenDropdown(openDropdown === name ? null : name);
  };

  // Filter navigation items based on role
  const filteredNavigation = user?.role === 'trainee'
    ? traineeNavigation
    : user?.role === 'super_admin'
    ? superAdminNavigation
    : navigation.filter(item => {
        // Platform Admin never shows for non-super-admin
        if (item.href === '/super-admin') return false;
        if (item.children) {
          const filteredChildren = item.children.filter(child =>
            !child.permission || hasPermission(child.permission)
          );
          return filteredChildren.length > 0;
        }
        return !item.permission || hasPermission(item.permission);
      }).map(item => {
        if (item.children) {
          return {
            ...item,
            children: item.children.filter(child =>
              !child.permission || hasPermission(child.permission)
            ),
          };
        }
        return item;
      });

  const filteredMobileNavigation = user?.role === 'trainee'
    ? traineeeMobileNavigation
    : user?.role === 'super_admin'
    ? superAdminMobileNavigation
    : mobileNavigation.filter(item => {
        if (item.href === '/super-admin') return false;
        return !item.permission || hasPermission(item.permission);
      });

  return (
    <div className="min-h-screen bg-background ds-shell">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="ds-sidebar flex grow flex-col gap-y-5 overflow-y-auto border-r border-border bg-card px-6 pb-4">
          {/* Logo */}
          <div className="flex h-16 shrink-0 items-center gap-3">
            {cmsSettings?.appearance?.logo ? (
              <img 
                src={getFileUrl(cmsSettings.appearance.logo)} 
                alt="Logo" 
                className="size-10 rounded-lg object-contain shadow-sm"
              />
            ) : (
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary">
                <span className="text-primary-foreground text-xs font-bold">BMDC</span>
              </div>
            )}
            <div>
              <h3 className="text-sm">{user?.tenantName || getValue(cmsSettings?.footer?.companyName) || 'Bongabong'}</h3>
              <p className="text-xs text-muted-foreground truncate max-w-[140px]">{getValue(cmsSettings?.footer?.tagline) || 'MDC'}</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex flex-1 flex-col">
            <ul className="flex flex-1 flex-col gap-y-1">
              {filteredNavigation.map((item) => (
                <li key={item.name}>
                  {item.children ? (
                    // Dropdown menu item
                    <div>
                      <button
                        onClick={() => toggleDropdown(item.name)}
                        className={`ds-nav-item flex w-full items-center justify-between gap-x-3 rounded-lg px-3 py-2 transition-colors ${
                          isChildActive(item)
                            ? 'is-active bg-primary/10 text-primary'
                            : 'text-foreground hover:bg-muted'
                        }`}
                      >
                        <div className="flex items-center gap-x-3">
                          <item.icon className="size-5 shrink-0" />
                          {item.name}
                        </div>
                        <ChevronDown className={`size-4 transition-transform ${
                          openDropdown === item.name ? 'rotate-180' : ''
                        }`} />
                      </button>
                      {openDropdown === item.name && (
                        <ul className="mt-1 space-y-1 pl-4">
                          {item.children.map((child) => (
                            <li key={child.name}>
                              <Link
                                to={child.href!}
                                className={`ds-nav-item flex items-center gap-x-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                                  isActive(child.href!)
                                    ? 'is-active bg-primary text-primary-foreground'
                                    : 'text-foreground hover:bg-muted'
                                }`}
                              >
                                <child.icon className="size-4 shrink-0" />
                                {child.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : (
                    // Regular menu item
                    <Link
                      to={item.href!}
                      className={`ds-nav-item flex items-center gap-x-3 rounded-lg px-3 py-2 transition-colors ${
                        isActive(item.href!)
                          ? 'is-active bg-primary text-primary-foreground'
                          : 'text-foreground hover:bg-muted'
                      }`}
                    >
                      <item.icon className="size-5 shrink-0" />
                      {item.name}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>

          {/* User Profile */}
          <div className="border-t border-border pt-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="ds-nav-item flex w-full items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted">
                  <Avatar className="size-8">
                    <AvatarFallback className="bg-secondary text-secondary-foreground">
                      {user?.name.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm truncate">{user?.name}</p>
                    <div className="flex items-center gap-1">
                      <Badge className={`text-xs px-1.5 py-0 ${user ? getRoleBadgeColor(user.role) : ''}`}>
                        {user ? getRoleDisplayName(user.role) : 'User'}
                      </Badge>
                    </div>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={toggleTheme}>
                  {isDark ? <Sun className="mr-2 size-4" /> : <Moon className="mr-2 size-4" />}
                  {isDark ? 'Light Mode' : 'Dark Mode'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 size-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar */}
      {sidebarOpen && (
        <div className="relative z-50 lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="ds-sidebar fixed inset-y-0 left-0 w-64 bg-card">
            <div className="flex h-16 items-center px-6">
              <div className="flex items-center gap-3">
                {cmsSettings?.appearance?.logo ? (
                  <img 
                    src={getFileUrl(cmsSettings.appearance.logo)} 
                    alt="Logo" 
                    className="size-10 rounded-lg object-contain shadow-sm"
                  />
                ) : (
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary">
                    <span className="text-primary-foreground text-xs font-bold">BMDC</span>
                  </div>
                )}
                <div>
                  <h3 className="text-sm">{user?.tenantName || getValue(cmsSettings?.footer?.companyName) || 'Bongabong'}</h3>
                  <p className="text-xs text-muted-foreground truncate max-w-[100px]">{getValue(cmsSettings?.footer?.tagline) || 'MDC'}</p>
                </div>
              </div>
            </div>
            <nav className="px-4 py-4">
              <ul className="space-y-1">
                {user?.role === 'trainee' ? (
                  filteredMobileNavigation.map((item) => (
                    <li key={item.name}>
                      <Link
                        to={item.href!}
                        onClick={() => setSidebarOpen(false)}
                        className={`ds-nav-item flex items-center gap-x-3 rounded-lg px-3 py-2 ${
                          isActive(item.href!)
                            ? 'is-active bg-primary text-primary-foreground'
                            : 'text-foreground hover:bg-muted'
                        }`}
                      >
                        <item.icon className="size-5 shrink-0" />
                        {item.name}
                      </Link>
                    </li>
                  ))
                ) : (
                  // Admin/staff: show nav items with Settings group visually separated
                  (() => {
                    const mainItems = filteredMobileNavigation.filter(i =>
                      !['Activity Logs','Data Quality','Non-Attendance Dates','Website Content','Account'].includes(i.name)
                    );
                    const settingsItems = filteredMobileNavigation.filter(i =>
                      ['Activity Logs','Data Quality','Non-Attendance Dates','Website Content','Account'].includes(i.name)
                    );
                    return (
                      <>
                        {mainItems.map((item) => (
                          <li key={item.name}>
                            <Link
                              to={item.href!}
                              onClick={() => setSidebarOpen(false)}
                              className={`ds-nav-item flex items-center gap-x-3 rounded-lg px-3 py-2 ${
                                isActive(item.href!)
                                  ? 'is-active bg-primary text-primary-foreground'
                                  : 'text-foreground hover:bg-muted'
                              }`}
                            >
                              <item.icon className="size-5 shrink-0" />
                              {item.name}
                            </Link>
                          </li>
                        ))}
                        {settingsItems.length > 0 && (
                          <li>
                            <button
                              onClick={() => toggleDropdown('Settings')}
                              className={`ds-nav-item flex w-full items-center justify-between gap-x-3 rounded-lg px-3 py-2 transition-colors ${
                                settingsItems.some(i => i.href && isActive(i.href))
                                  ? 'is-active bg-primary/10 text-primary'
                                  : 'text-foreground hover:bg-muted'
                              }`}
                            >
                              <div className="flex items-center gap-x-3">
                                <Settings className="size-5 shrink-0" />
                                Settings
                              </div>
                              <ChevronDown className={`size-4 transition-transform ${openDropdown === 'Settings' ? 'rotate-180' : ''}`} />
                            </button>
                            {openDropdown === 'Settings' && (
                              <ul className="mt-1 space-y-1 pl-4">
                                {settingsItems.map((item) => (
                                  <li key={item.name}>
                                    <Link
                                      to={item.href!}
                                      onClick={() => setSidebarOpen(false)}
                                      className={`ds-nav-item flex items-center gap-x-3 rounded-lg px-3 py-2 text-sm ${
                                        isActive(item.href!)
                                          ? 'is-active bg-primary text-primary-foreground'
                                          : 'text-foreground hover:bg-muted'
                                      }`}
                                    >
                                      <item.icon className="size-4 shrink-0" />
                                      {item.name}
                                    </Link>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </li>
                        )}
                      </>
                    );
                  })()
                )}
              </ul>
              
              {/* Mobile Sidebar Footer - User & Logout */}
              <div className="mt-6 border-t border-border pt-4">
                <div className="flex items-center gap-3 px-3 py-2 mb-2">
                  <Avatar className="size-8">
                    <AvatarFallback className="bg-secondary text-secondary-foreground">
                      {user?.name.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{user?.name}</p>
                    <Badge className={`text-xs px-1.5 py-0 ${user ? getRoleBadgeColor(user.role) : ''}`}>
                      {user ? getRoleDisplayName(user.role) : 'User'}
                    </Badge>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSidebarOpen(false);
                    toggleTheme();
                  }}
                  className="ds-nav-item flex items-center gap-x-3 w-full rounded-lg px-3 py-2 text-foreground hover:bg-muted mb-1"
                >
                  {isDark ? <Sun className="size-5 shrink-0" /> : <Moon className="size-5 shrink-0" />}
                  {isDark ? 'Light Mode' : 'Dark Mode'}
                </button>
                <button
                  onClick={() => {
                    setSidebarOpen(false);
                    handleLogout();
                  }}
                  className="ds-nav-item flex items-center gap-x-3 w-full rounded-lg px-3 py-2 text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="size-5 shrink-0" />
                  Log out
                </button>
              </div>
            </nav>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="lg:pl-64">
        {/* Top Bar */}
        <div className="ds-topbar sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-border bg-card px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="size-5" />
          </Button>

          <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
            <div className="flex flex-1 items-center">
              {title && <h1 className="text-foreground">{title}</h1>}
            </div>
            <div className="flex items-center gap-x-2 lg:gap-x-6">
              {/* Tenant name badge — desktop only */}
              {user?.tenantName && (
                <span className="hidden lg:inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs text-primary font-medium">
                  {user.tenantName}
                </span>
              )}
              {/* Overdue Bell Notification - Only for super_admin, local_admin, staff_inventory_manager */}
              <OverdueBellNotification />
              
              {hasPermission('canScanQR') && (
                <Link to="/scan">
                  <Button variant="ghost" size="icon">
                    <QrCode className="size-5" />
                  </Button>
                </Link>
              )}
              
              {/* Mobile User Menu */}
              <div className="lg:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <Avatar className="size-6">
                        <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                          {user?.name.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user?.name}</p>
                        <p className="text-xs leading-none text-muted-foreground">
                          {user ? getRoleDisplayName(user.role) : 'User'}
                        </p>
                        {user?.tenantName && (
                          <p className="text-xs leading-none text-primary mt-1">{user.tenantName}</p>
                        )}
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={toggleTheme}>
                      {isDark ? <Sun className="mr-2 size-4" /> : <Moon className="mr-2 size-4" />}
                      {isDark ? 'Light Mode' : 'Dark Mode'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                      <LogOut className="mr-2 size-4" />
                      Log out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="hidden lg:flex"
              >
                {isDark ? <Sun className="size-5" /> : <Moon className="size-5" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Page Content */}
        <main className="pb-20 lg:pb-8">
          <div className="ds-page px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card lg:hidden">
        <nav className="flex items-center justify-around px-2 py-2">
          {filteredMobileNavigation.slice(0, 5).map((item) => (
            <Link
              key={item.name}
              to={item.href!}
              className={`ds-nav-item flex flex-col items-center gap-1 rounded-lg px-3 py-2 flex-1 ${
                isActive(item.href!)
                  ? 'is-active text-primary'
                  : 'text-muted-foreground'
              }`}
            >
              <item.icon className="size-5 shrink-0" />
              <span className="text-[10px] truncate w-full text-center">{item.name}</span>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}