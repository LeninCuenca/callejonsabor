import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.callejondelsabor.pos',
  appName: 'Callejon del Sabor',
  webDir: 'dist',
  plugins: {
    Camera: {
      permissions: ['camera', 'photos']
    }
  }
};

export default config;
