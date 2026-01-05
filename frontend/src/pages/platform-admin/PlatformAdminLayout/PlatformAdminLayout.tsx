import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Stack,
  Nav,
  INavLink,
  INavStyles,
  Text,
  IconButton,
  Persona,
  PersonaSize,
  useTheme
} from '@fluentui/react';
import { useAppContext } from '../../../providers/AppProviders';
import styles from './PlatformAdminLayout.module.css';

const navStyles: Partial<INavStyles> = {
  root: {
    width: 250,
    height: '100vh',
    boxSizing: 'border-box',
    borderRight: '1px solid #edebe9',
    overflowY: 'auto',
  },
  link: {
    selectors: {
      '.ms-Nav-compositeLink:hover &': {
        backgroundColor: '#f3f2f1',
      },
    },
  },
};

export const PlatformAdminLayout: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAppContext();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const navLinkGroups = [
    {
      links: [
        {
          key: 'organizations',
          name: 'Organizations',
          url: '/platform-admin/organizations',
          icon: 'Group',
        },
        {
          key: 'pulse-data',
          name: 'Data Ingestion',
          url: '/platform-admin/pulse-data',
          icon: 'Database',
        },
        {
          key: 'credits',
          name: 'Credits',
          url: '/platform-admin/credits',
          icon: 'Money',
        },
        {
          key: 'settings',
          name: 'Subscription Tiers',
          url: '/platform-admin/settings',
          icon: 'Settings',
        },
      ],
    },
  ];

  const handleLinkClick = (ev?: React.MouseEvent<HTMLElement>, item?: INavLink) => {
    if (item && item.url) {
      ev?.preventDefault();
      navigate(item.url);
      setIsMobileNavOpen(false);
    }
  };

  return (
    <div className={styles.layout}>
      {/* Mobile Nav Toggle */}
      <div className={styles.mobileHeader}>
        <IconButton
          iconProps={{ iconName: 'GlobalNavButton' }}
          title="Menu"
          onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
          className={styles.mobileMenuButton}
        />
        <Text variant="large" className={styles.mobileTitle}>
          Platform Admin
        </Text>
      </div>

      {/* Sidebar */}
      <div className={`${styles.sidebar} ${isMobileNavOpen ? styles.sidebarOpen : ''}`}>
        <Stack tokens={{ padding: 20 }} styles={{ root: { borderBottom: '1px solid #edebe9' } }}>
          <Text variant="xxLarge" styles={{ root: { fontWeight: 600, color: theme.palette.themePrimary } }}>
            Platform Admin
          </Text>
          <Text variant="small" styles={{ root: { color: theme.palette.neutralSecondary } }}>
            Management Portal
          </Text>
        </Stack>

        <Nav
          groups={navLinkGroups}
          selectedKey={location.pathname.split('/').pop() || 'organizations'}
          styles={navStyles}
          onLinkClick={handleLinkClick}
        />

        <Stack
          tokens={{ padding: 20 }}
          styles={{
            root: {
              borderTop: '1px solid #edebe9',
              marginTop: 'auto',
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
            },
          }}
        >
          <Text variant="tiny" styles={{ root: { color: theme.palette.neutralTertiary } }}>
            v1.0.0
          </Text>
        </Stack>
      </div>

      {/* Mobile Overlay */}
      {isMobileNavOpen && (
        <div className={styles.overlay} onClick={() => setIsMobileNavOpen(false)} />
      )}

      {/* Main Content */}
      <div className={styles.mainContent}>
        {/* Top Navigation Bar */}
        <Stack
          horizontal
          horizontalAlign="space-between"
          verticalAlign="center"
          styles={{
            root: {
              height: 60,
              padding: '0 24px',
              borderBottom: '1px solid #edebe9',
              backgroundColor: '#ffffff',
            },
          }}
        >
          <div />

          <Stack horizontal tokens={{ childrenGap: 16 }} verticalAlign="center">
            <Stack horizontal tokens={{ childrenGap: 12 }} verticalAlign="center">
              <Persona
                text={user?.name || 'Admin User'}
                size={PersonaSize.size32}
                styles={{ root: { cursor: 'pointer' } }}
              />
              <Stack>
                <Text variant="medium" styles={{ root: { fontWeight: 600 } }}>
                  {user?.name || 'Admin User'}
                </Text>
                <Text variant="small" styles={{ root: { color: theme.palette.neutralSecondary } }}>
                  {user?.email || 'admin@example.com'}
                </Text>
              </Stack>
            </Stack>

            <IconButton
              iconProps={{ iconName: 'SignOut' }}
              title="Logout"
              onClick={() => navigate('/logout')}
            />
          </Stack>
        </Stack>

        {/* Page Content */}
        <div className={styles.pageContent}>
          <Outlet />
        </div>
      </div>
    </div>
  );
};
