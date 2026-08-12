import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.narozhnyy.solarstudio',
  appName: 'Solar Studio',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
};

export default config;
